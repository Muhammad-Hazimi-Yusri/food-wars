import { NextResponse } from "next/server";
import { exchangeCodeForToken } from "@/lib/mcp/oauth/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * RFC 6749 + RFC 7636 token endpoint.
 * Supports only grant_type=authorization_code with PKCE.
 * Accepts both application/x-www-form-urlencoded and application/json bodies.
 */
async function parseBody(request: Request): Promise<Record<string, string>> {
  const ct = request.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    const json = await request.json();
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(json)) {
      if (typeof v === "string") out[k] = v;
    }
    return out;
  }
  // urlencoded fallback (the OAuth spec default)
  const text = await request.text();
  const params = new URLSearchParams(text);
  const out: Record<string, string> = {};
  for (const [k, v] of params) out[k] = v;
  return out;
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "no-store",
};

export async function POST(request: Request): Promise<Response> {
  const body = await parseBody(request);

  if (body.grant_type !== "authorization_code") {
    return NextResponse.json(
      { error: "unsupported_grant_type" },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  // client_id may also arrive via HTTP Basic; spec compliance is light here.
  let clientId = body.client_id;
  let clientSecret = body.client_secret;
  const basic = request.headers.get("authorization");
  if (basic?.toLowerCase().startsWith("basic ")) {
    try {
      const decoded = Buffer.from(basic.slice(6).trim(), "base64").toString("utf8");
      const idx = decoded.indexOf(":");
      if (idx > -1) {
        clientId = clientId ?? decoded.slice(0, idx);
        clientSecret = clientSecret ?? decoded.slice(idx + 1);
      }
    } catch {
      // ignore — fall through to body-based credentials
    }
  }

  const required = ["code", "redirect_uri", "code_verifier"] as const;
  for (const key of required) {
    if (!body[key]) {
      return NextResponse.json(
        { error: "invalid_request", error_description: `Missing ${key}` },
        { status: 400, headers: CORS_HEADERS },
      );
    }
  }
  if (!clientId) {
    return NextResponse.json(
      { error: "invalid_request", error_description: "Missing client_id" },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const result = await exchangeCodeForToken({
    code: body.code,
    clientId,
    clientSecret,
    redirectUri: body.redirect_uri,
    codeVerifier: body.code_verifier,
  });

  if (!result.ok) {
    const status = result.error === "invalid_client" ? 401 : 400;
    return NextResponse.json({ error: result.error }, { status, headers: CORS_HEADERS });
  }

  return NextResponse.json(
    {
      access_token: result.token,
      token_type: "Bearer",
      expires_in: result.expiresIn,
      scope: "mcp",
    },
    { headers: CORS_HEADERS },
  );
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
