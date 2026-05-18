import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { resolveCurrentHouseholdId } from "@/lib/inventory-export-core";
import { issueAuthorizationCode } from "@/lib/mcp/oauth/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST handler for the consent form on /oauth/authorize.
 * On Allow: issues an auth code and 302-redirects to redirect_uri with code+state.
 * On Deny: 302-redirects with error=access_denied.
 * On any error: 302-redirects with error=server_error so the client can show
 * something rather than a blank page.
 */
export async function POST(request: Request): Promise<Response> {
  const form = await request.formData();
  const decision = form.get("decision");
  const clientId = String(form.get("client_id") ?? "");
  const redirectUri = String(form.get("redirect_uri") ?? "");
  const codeChallenge = String(form.get("code_challenge") ?? "");
  const codeChallengeMethod = (String(form.get("code_challenge_method") ?? "S256")) as "S256" | "plain";
  const state = String(form.get("state") ?? "");

  function redirectWithError(error: string): Response {
    if (!redirectUri) {
      return NextResponse.json({ error }, { status: 400 });
    }
    const u = new URL(redirectUri);
    u.searchParams.set("error", error);
    if (state) u.searchParams.set("state", state);
    return NextResponse.redirect(u.toString(), 302);
  }

  if (!clientId || !redirectUri || !codeChallenge) {
    return redirectWithError("invalid_request");
  }

  // Re-validate the client and redirect_uri server-side; the hidden inputs
  // are user-controllable so the page-render check isn't sufficient.
  const service = createServiceClient();
  const { data: client } = await service
    .from("mcp_oauth_clients")
    .select("client_id, redirect_uris")
    .eq("client_id", clientId)
    .maybeSingle();
  if (!client) return redirectWithError("unauthorized_client");
  if (!client.redirect_uris.includes(redirectUri)) {
    return redirectWithError("invalid_request");
  }

  if (decision !== "allow") {
    return redirectWithError("access_denied");
  }

  // Authenticate the user via cookie session.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) {
    return redirectWithError("access_denied");
  }
  const householdId = await resolveCurrentHouseholdId(supabase);
  if (!householdId) return redirectWithError("server_error");

  try {
    const code = await issueAuthorizationCode({
      clientId,
      redirectUri,
      codeChallenge,
      codeChallengeMethod,
      householdId,
      userId: user.id,
    });

    const u = new URL(redirectUri);
    u.searchParams.set("code", code);
    if (state) u.searchParams.set("state", state);
    return NextResponse.redirect(u.toString(), 302);
  } catch (err) {
    console.error("[oauth/authorize] issuance failed:", err);
    return redirectWithError("server_error");
  }
}
