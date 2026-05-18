-- ============================================
-- v0.17.0: MCP OAuth 2.1 authorization server
-- Required for Claude iOS, claude.ai web, and any MCP client that
-- doesn't support a static Authorization header (which most don't).
-- ============================================

-- Dynamically-registered MCP clients (RFC 7591).
-- Claude iOS / claude.ai will POST to /api/oauth/register and get a
-- client_id back. Public clients use PKCE with no secret.
CREATE TABLE mcp_oauth_clients (
  client_id TEXT PRIMARY KEY,
  client_secret_hash TEXT,
  client_name TEXT,
  redirect_uris TEXT[] NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ
);

-- Short-lived authorization codes (~10 minutes).
-- code_challenge + method bind a PKCE verifier that the client must
-- present at the token endpoint.
CREATE TABLE mcp_oauth_codes (
  code TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES mcp_oauth_clients(client_id) ON DELETE CASCADE,
  redirect_uri TEXT NOT NULL,
  code_challenge TEXT NOT NULL,
  code_challenge_method TEXT NOT NULL DEFAULT 'S256',
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_mcp_oauth_codes_expires_at ON mcp_oauth_codes(expires_at);

-- Long-lived access tokens (default 1 year).
-- token_hash = sha256(token). The plaintext is shown to the client once
-- at the token endpoint and never stored.
CREATE TABLE mcp_oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash TEXT UNIQUE NOT NULL,
  client_id TEXT NOT NULL REFERENCES mcp_oauth_clients(client_id) ON DELETE CASCADE,
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  expires_at TIMESTAMPTZ,
  revoked BOOLEAN NOT NULL DEFAULT FALSE,
  revoked_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_mcp_oauth_tokens_token_hash ON mcp_oauth_tokens(token_hash);
CREATE INDEX idx_mcp_oauth_tokens_household ON mcp_oauth_tokens(household_id);

-- Owners can list their tokens (for a future revocation UI) and revoke them.
-- All issuance flows run through service-role API routes; there is no
-- user-facing INSERT/UPDATE path that needs RLS rights.
ALTER TABLE mcp_oauth_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own household oauth tokens"
  ON mcp_oauth_tokens FOR SELECT USING (
    household_id IN (SELECT id FROM households WHERE owner_id = auth.uid())
  );

CREATE POLICY "Users can revoke own household oauth tokens"
  ON mcp_oauth_tokens FOR UPDATE USING (
    household_id IN (SELECT id FROM households WHERE owner_id = auth.uid())
  );

-- Clients and codes are managed exclusively via service-role routes, so RLS
-- is left disabled. (Enabling without policies would silently break the
-- service-role flows.)
