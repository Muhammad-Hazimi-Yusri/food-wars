/**
 * Compute the public-facing origin from the request, honouring reverse-proxy
 * headers (Vercel, Cloudflare, etc.). Mirrors `mcp-handler`'s helper of the
 * same name so our metadata documents agree with the WWW-Authenticate
 * resource_metadata URL that withMcpAuth emits.
 */
export function getPublicOrigin(request: Request): string {
  const url = new URL(request.url);
  const xfProto = request.headers.get("x-forwarded-proto");
  const xfHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = xfProto ?? url.protocol.replace(":", "");
  const host = xfHost ?? url.host;
  return `${proto}://${host}`;
}

export type AuthorizationServerMetadata = {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint: string;
  response_types_supported: string[];
  grant_types_supported: string[];
  code_challenge_methods_supported: string[];
  token_endpoint_auth_methods_supported: string[];
  scopes_supported?: string[];
};

export function buildAuthorizationServerMetadata(origin: string): AuthorizationServerMetadata {
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/api/oauth/token`,
    registration_endpoint: `${origin}/api/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none", "client_secret_post"],
    scopes_supported: ["mcp"],
  };
}

export type ProtectedResourceMetadata = {
  resource: string;
  authorization_servers: string[];
  bearer_methods_supported: string[];
  scopes_supported?: string[];
};

export function buildProtectedResourceMetadata(origin: string): ProtectedResourceMetadata {
  return {
    resource: `${origin}/api/mcp`,
    authorization_servers: [origin],
    bearer_methods_supported: ["header"],
    scopes_supported: ["mcp"],
  };
}
