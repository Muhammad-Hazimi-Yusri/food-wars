/**
 * CORS for the MCP endpoint.
 *
 * claude.ai web Custom Connectors call `/api/mcp` from a browser context and
 * need permissive CORS. Claude Code and Claude Desktop don't (they're
 * server-to-server) but allowing them costs nothing.
 *
 * We allow `https://claude.ai` plus localhost dev origins. Echoing arbitrary
 * Origin is intentionally avoided to keep token-bearing requests scoped.
 */

const ALLOWED_ORIGINS = new Set<string>([
  "https://claude.ai",
  "http://localhost:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3000",
]);

const ALLOWED_HEADERS = "Authorization, Content-Type, Mcp-Session-Id, Mcp-Protocol-Version, Accept";
const ALLOWED_METHODS = "GET, POST, DELETE, OPTIONS";

export function corsHeadersFor(request: Request): Record<string, string> {
  const origin = request.headers.get("origin");
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": ALLOWED_METHODS,
    "Access-Control-Allow-Headers": ALLOWED_HEADERS,
    "Access-Control-Expose-Headers": "Mcp-Session-Id",
    "Access-Control-Max-Age": "86400",
  };
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Vary"] = "Origin";
  }
  return headers;
}

export function preflightResponse(request: Request): Response {
  return new Response(null, { status: 204, headers: corsHeadersFor(request) });
}

export function withCors(request: Request, response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(corsHeadersFor(request))) {
    headers.set(k, v);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
