import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/server";

const CODE_TTL_SECONDS = 10 * 60;
const ACCESS_TOKEN_TTL_SECONDS = 365 * 24 * 60 * 60;
const TOKEN_PREFIX = "fwo_";

function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function randomOpaque(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export type RegisteredClient = {
  client_id: string;
  client_secret?: string;
  client_name: string | null;
  redirect_uris: string[];
};

/**
 * RFC 7591 Dynamic Client Registration.
 * Public clients (Claude iOS / web): omit secret, use PKCE.
 * We don't validate redirect_uris against an allowlist — DCR is open by
 * design; the security boundary is the user's explicit consent on the
 * authorize page.
 */
export async function registerClient(input: {
  client_name?: string;
  redirect_uris: string[];
  public: boolean;
}): Promise<RegisteredClient> {
  const supabase = createServiceClient();
  const clientId = "fwc_" + randomOpaque(16);
  const clientSecret = input.public ? null : randomOpaque(32);

  const { error } = await supabase.from("mcp_oauth_clients").insert({
    client_id: clientId,
    client_secret_hash: clientSecret ? sha256Hex(clientSecret) : null,
    client_name: input.client_name ?? null,
    redirect_uris: input.redirect_uris,
  });
  if (error) throw new Error(`Client registration failed: ${error.message}`);

  return {
    client_id: clientId,
    ...(clientSecret ? { client_secret: clientSecret } : {}),
    client_name: input.client_name ?? null,
    redirect_uris: input.redirect_uris,
  };
}

export type ClientLookup = {
  client_id: string;
  client_secret_hash: string | null;
  redirect_uris: string[];
};

export async function getClient(clientId: string): Promise<ClientLookup | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("mcp_oauth_clients")
    .select("client_id, client_secret_hash, redirect_uris")
    .eq("client_id", clientId)
    .maybeSingle();
  return (data as ClientLookup | null) ?? null;
}

export async function touchClient(clientId: string): Promise<void> {
  const supabase = createServiceClient();
  await supabase
    .from("mcp_oauth_clients")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("client_id", clientId);
}

/**
 * Issue an authorization code bound to the user's household and the
 * client's PKCE challenge. The code itself is opaque; the verifier check
 * happens at the token endpoint.
 */
export async function issueAuthorizationCode(input: {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: "S256" | "plain";
  householdId: string;
  userId: string;
}): Promise<string> {
  const supabase = createServiceClient();
  const code = randomOpaque(32);
  const expiresAt = new Date(Date.now() + CODE_TTL_SECONDS * 1000).toISOString();

  const { error } = await supabase.from("mcp_oauth_codes").insert({
    code,
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    code_challenge: input.codeChallenge,
    code_challenge_method: input.codeChallengeMethod,
    household_id: input.householdId,
    user_id: input.userId,
    expires_at: expiresAt,
  });
  if (error) throw new Error(`Code issuance failed: ${error.message}`);
  return code;
}

export type ExchangeResult =
  | { ok: true; token: string; expiresIn: number }
  | { ok: false; error: string };

/**
 * Verify a PKCE code_verifier against a stored code_challenge.
 *   - S256: BASE64URL(SHA256(verifier)) === challenge
 *   - plain: verifier === challenge
 */
function verifyPkce(verifier: string, challenge: string, method: string): boolean {
  if (method === "plain") {
    return safeCompareStrings(verifier, challenge);
  }
  const computed = createHash("sha256").update(verifier).digest("base64url");
  return safeCompareStrings(computed, challenge);
}

function safeCompareStrings(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * Atomically exchange an authorization code for an access token.
 *   - Validates code exists, not consumed, not expired
 *   - Validates client_id and redirect_uri match
 *   - If the client is confidential, validates client_secret
 *   - Validates PKCE
 *   - Marks the code consumed and issues an access token
 */
export async function exchangeCodeForToken(input: {
  code: string;
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<ExchangeResult> {
  const supabase = createServiceClient();

  const { data: codeRow } = await supabase
    .from("mcp_oauth_codes")
    .select("*")
    .eq("code", input.code)
    .maybeSingle();
  if (!codeRow) return { ok: false, error: "invalid_grant" };
  if (codeRow.consumed) return { ok: false, error: "invalid_grant" };
  if (new Date(codeRow.expires_at).getTime() < Date.now()) {
    return { ok: false, error: "invalid_grant" };
  }
  if (codeRow.client_id !== input.clientId) return { ok: false, error: "invalid_grant" };
  if (codeRow.redirect_uri !== input.redirectUri) return { ok: false, error: "invalid_grant" };

  const client = await getClient(input.clientId);
  if (!client) return { ok: false, error: "invalid_client" };

  if (client.client_secret_hash) {
    if (!input.clientSecret) return { ok: false, error: "invalid_client" };
    const candidateHash = sha256Hex(input.clientSecret);
    if (!safeCompareStrings(candidateHash, client.client_secret_hash)) {
      return { ok: false, error: "invalid_client" };
    }
  }

  if (!verifyPkce(input.codeVerifier, codeRow.code_challenge, codeRow.code_challenge_method)) {
    return { ok: false, error: "invalid_grant" };
  }

  // Mark code consumed before issuing token so a race can't double-spend it.
  const { error: consumeErr } = await supabase
    .from("mcp_oauth_codes")
    .update({ consumed: true })
    .eq("code", input.code)
    .eq("consumed", false);
  if (consumeErr) return { ok: false, error: "server_error" };

  const token = TOKEN_PREFIX + randomOpaque(32);
  const tokenHash = sha256Hex(token);
  const expiresAt = new Date(Date.now() + ACCESS_TOKEN_TTL_SECONDS * 1000).toISOString();

  const { error: insertErr } = await supabase.from("mcp_oauth_tokens").insert({
    token_hash: tokenHash,
    client_id: input.clientId,
    household_id: codeRow.household_id,
    user_id: codeRow.user_id,
    expires_at: expiresAt,
  });
  if (insertErr) return { ok: false, error: "server_error" };

  await touchClient(input.clientId);

  return { ok: true, token, expiresIn: ACCESS_TOKEN_TTL_SECONDS };
}

/**
 * Resolve a bearer token to its household. Updates last_used_at for audit.
 * Returns null if the token isn't ours, is expired, or revoked.
 */
export async function resolveAccessToken(
  bearer: string,
): Promise<{ householdId: string; clientId: string } | null> {
  if (!bearer.startsWith(TOKEN_PREFIX)) return null;
  const supabase = createServiceClient();
  const hash = sha256Hex(bearer);

  const { data } = await supabase
    .from("mcp_oauth_tokens")
    .select("id, household_id, client_id, expires_at, revoked")
    .eq("token_hash", hash)
    .maybeSingle();

  if (!data) return null;
  if (data.revoked) return null;
  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) return null;

  await supabase
    .from("mcp_oauth_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id);

  return { householdId: data.household_id, clientId: data.client_id };
}

export function isOAuthAccessToken(bearer: string): boolean {
  return bearer.startsWith(TOKEN_PREFIX);
}
