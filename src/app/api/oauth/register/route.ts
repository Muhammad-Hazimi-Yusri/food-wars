import { NextResponse } from "next/server";
import { registerClient } from "@/lib/mcp/oauth/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * RFC 7591 Dynamic Client Registration.
 * Accepts a minimal body: { client_name?, redirect_uris[], token_endpoint_auth_method? }.
 * Returns the registered client. Public clients (token_endpoint_auth_method='none')
 * get no client_secret and must use PKCE.
 *
 * No CORS restriction — DCR is meant to be open. The user-consent step is
 * where authorisation actually happens.
 */
export async function POST(request: Request): Promise<Response> {
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_client_metadata", error_description: "Body must be JSON" },
      { status: 400, headers: { "Access-Control-Allow-Origin": "*" } },
    );
  }

  const redirectUris = Array.isArray(body.redirect_uris) ? body.redirect_uris.filter((u): u is string => typeof u === "string") : [];
  if (redirectUris.length === 0) {
    return NextResponse.json(
      { error: "invalid_redirect_uri", error_description: "At least one redirect_uri is required" },
      { status: 400, headers: { "Access-Control-Allow-Origin": "*" } },
    );
  }

  const authMethod = typeof body.token_endpoint_auth_method === "string" ? body.token_endpoint_auth_method : "none";
  const isPublic = authMethod === "none";
  const clientName = typeof body.client_name === "string" ? body.client_name : null;

  try {
    const client = await registerClient({
      client_name: clientName ?? undefined,
      redirect_uris: redirectUris,
      public: isPublic,
    });

    return NextResponse.json(
      {
        client_id: client.client_id,
        ...(client.client_secret ? { client_secret: client.client_secret } : {}),
        client_name: client.client_name,
        redirect_uris: client.redirect_uris,
        token_endpoint_auth_method: isPublic ? "none" : "client_secret_post",
        grant_types: ["authorization_code"],
        response_types: ["code"],
      },
      { status: 201, headers: { "Access-Control-Allow-Origin": "*" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Registration failed";
    return NextResponse.json(
      { error: "server_error", error_description: message },
      { status: 500, headers: { "Access-Control-Allow-Origin": "*" } },
    );
  }
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
