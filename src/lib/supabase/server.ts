import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from Server Component — ignore
          }
        },
      },
    }
  );
}

/**
 * Service-role Supabase client that bypasses RLS.
 *
 * Use ONLY in API routes that authenticate via a bearer token
 * (e.g. /api/inventory/export). Routes using this MUST filter by
 * household_id manually — RLS is not enforced.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in the environment. Throws on
 * startup if missing so misconfiguration fails loud.
 */
export function createServiceClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Token-authenticated routes require the service role key."
    );
  }

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {
          // no-op: service-role client never sets cookies
        },
      },
    }
  );
}