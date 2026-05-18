import { createServiceClient } from "@/lib/supabase/server";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { isOAuthAccessToken, resolveAccessToken } from "@/lib/mcp/oauth/store";

/**
 * Verify a bearer token. Accepts two token forms:
 *   1. OAuth 2.1 access tokens (prefix `fwo_`) — issued via the consent flow
 *      at /oauth/authorize; looked up in `mcp_oauth_tokens`.
 *   2. Static household API tokens (prefix `fw_`) — generated in Settings →
 *      AI → API token; stored on `household_ai_settings.api_token`.
 *
 * Returns an AuthInfo with the householdId stashed in `extra.householdId`.
 * Tool handlers retrieve it via `extra.authInfo?.extra?.householdId`.
 * Returns undefined when no token is provided or it doesn't match — caller
 * (withMcpAuth) translates that into a 401 with WWW-Authenticate header.
 */
export async function verifyFoodWarsToken(
  _req: Request,
  bearerToken?: string,
): Promise<AuthInfo | undefined> {
  if (!bearerToken) return undefined;

  if (isOAuthAccessToken(bearerToken)) {
    const resolved = await resolveAccessToken(bearerToken);
    if (!resolved) return undefined;
    return {
      token: bearerToken,
      clientId: resolved.clientId,
      scopes: ["mcp"],
      extra: { householdId: resolved.householdId, clientId: resolved.clientId },
    };
  }

  let service;
  try {
    service = createServiceClient();
  } catch (e) {
    console.error("[mcp/auth] service client error:", e);
    return undefined;
  }

  const { data } = await service
    .from("household_ai_settings")
    .select("household_id")
    .eq("api_token", bearerToken)
    .maybeSingle();

  const householdId: string | null = data?.household_id ?? null;
  if (!householdId) return undefined;

  return {
    token: bearerToken,
    clientId: householdId,
    scopes: [],
    extra: { householdId },
  };
}

/**
 * Pull the household ID from a tool handler's extra.authInfo, throwing if
 * absent. `withMcpAuth({ required: true })` guarantees authInfo is present
 * for any tool call that reaches a handler, so this should never throw in
 * practice — but tools should fail closed if it ever does.
 */
export function requireHouseholdId(authInfo: AuthInfo | undefined): string {
  const householdId = (authInfo?.extra as { householdId?: string } | undefined)?.householdId;
  if (!householdId) throw new Error("Unauthorized: no household bound to this MCP session");
  return householdId;
}
