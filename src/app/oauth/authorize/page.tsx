import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { resolveCurrentHouseholdId } from "@/lib/inventory-export-core";
import { SignInButton } from "./SignInButton";

export const dynamic = "force-dynamic";

type SearchParams = {
  response_type?: string;
  client_id?: string;
  redirect_uri?: string;
  code_challenge?: string;
  code_challenge_method?: string;
  scope?: string;
  state?: string;
};

/**
 * OAuth 2.1 authorization endpoint (consent page).
 * Validates query params, ensures the user is signed in as a real (non-guest)
 * Google account with a household, then renders an Allow / Deny form that
 * POSTs to /api/oauth/authorize.
 */
export default async function AuthorizePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  // Spec compliance: validate up-front so we can show a clear error rather
  // than redirecting to a half-built callback.
  const errors: string[] = [];
  if (params.response_type !== "code") errors.push("response_type must be 'code'");
  if (!params.client_id) errors.push("client_id is required");
  if (!params.redirect_uri) errors.push("redirect_uri is required");
  if (!params.code_challenge) errors.push("code_challenge is required (PKCE is required)");
  if (params.code_challenge_method && params.code_challenge_method !== "S256") {
    errors.push("code_challenge_method must be 'S256'");
  }

  if (errors.length === 0 && params.client_id) {
    // Confirm the client exists, otherwise the rest is wasted effort
    const service = createServiceClient();
    const { data: client } = await service
      .from("mcp_oauth_clients")
      .select("client_id, redirect_uris, client_name")
      .eq("client_id", params.client_id)
      .maybeSingle();
    if (!client) {
      errors.push("Unknown client_id — register the client first");
    } else if (!client.redirect_uris.includes(params.redirect_uri!)) {
      errors.push("redirect_uri is not in this client's registered list");
    }
  }

  if (errors.length > 0) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-lg shadow p-6 space-y-4">
          <h1 className="text-xl font-semibold">Authorization request rejected</h1>
          <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1">
            {errors.map((e) => <li key={e}>{e}</li>)}
          </ul>
        </div>
      </main>
    );
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const currentUrl = "/oauth/authorize?" + new URLSearchParams(params as Record<string, string>).toString();

  if (!user || user.is_anonymous) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-lg shadow p-6 space-y-4">
          <h1 className="text-xl font-semibold">Sign in to authorize Claude</h1>
          <p className="text-sm text-slate-700">
            An MCP client wants access to your Food Wars household. Sign in with your Google
            account first — guest mode can&apos;t authorize external clients because the guest
            household is shared.
          </p>
          <SignInButton nextUrl={currentUrl} />
        </div>
      </main>
    );
  }

  const householdId = await resolveCurrentHouseholdId(supabase);
  if (!householdId) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-lg shadow p-6 space-y-4">
          <h1 className="text-xl font-semibold">No household found</h1>
          <p className="text-sm text-slate-700">
            Your account has no household yet. Open the app and complete setup, then come back.
          </p>
        </div>
      </main>
    );
  }

  // All good — render the consent form. Approving POSTs to /api/oauth/authorize
  // which issues a code and 302-redirects to redirect_uri.
  const clientLabel = params.client_id ?? "Unknown client";

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow p-6 space-y-5">
        <div className="space-y-2">
          <h1 className="text-xl font-semibold">Authorize Claude</h1>
          <p className="text-sm text-slate-700">
            Allow this Claude client to access your Food Wars household? It will be able to:
          </p>
          <ul className="text-sm text-slate-700 list-disc pl-5 space-y-1">
            <li>Read your inventory, recipes and shopping lists</li>
            <li>Add, consume, transfer and correct stock</li>
            <li>Parse receipt and pantry photos you send it</li>
            <li>Detect and (with your explicit confirmation) repair data issues</li>
          </ul>
          <p className="text-xs text-slate-500 break-all pt-2">Client: <code>{clientLabel}</code></p>
        </div>

        <form action="/api/oauth/authorize" method="POST" className="flex gap-3">
          <input type="hidden" name="client_id" value={params.client_id ?? ""} />
          <input type="hidden" name="redirect_uri" value={params.redirect_uri ?? ""} />
          <input type="hidden" name="code_challenge" value={params.code_challenge ?? ""} />
          <input type="hidden" name="code_challenge_method" value={params.code_challenge_method ?? "S256"} />
          <input type="hidden" name="state" value={params.state ?? ""} />
          <button
            type="submit"
            name="decision"
            value="deny"
            className="flex-1 py-2 rounded border border-slate-300 text-slate-700 hover:bg-slate-50"
          >
            Deny
          </button>
          <button
            type="submit"
            name="decision"
            value="allow"
            className="flex-1 py-2 rounded bg-red-600 text-white hover:bg-red-700"
          >
            Allow
          </button>
        </form>
      </div>
    </main>
  );
}
