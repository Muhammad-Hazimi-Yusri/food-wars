import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Snapshot auth cookie presence BEFORE getUser(), because a failed refresh
  // may clear them via setAll.
  const hadAuthCookies = request.cookies
    .getAll()
    .some((c) => c.name.includes("auth-token"));

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Auto-recover expired sessions: if the request had auth cookies but
  // getUser() returned no user, the session has expired. Sign in anonymously
  // so the page renders with guest data instead of an empty state.
  if (!user && hadAuthCookies) {
    await supabase.auth.signInAnonymously();
  }

  // Skip access check for restricted and auth pages to avoid redirect loops
  const { pathname } = request.nextUrl;
  const isExcluded =
    pathname.startsWith("/restricted") || pathname.startsWith("/auth");

  if (!isExcluded && user && !user.is_anonymous) {
    const allowedEmails = (process.env.ALLOWED_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    const userEmail = (user.email ?? "").toLowerCase();
    const isAllowed = allowedEmails.length > 0 && allowedEmails.includes(userEmail);

    if (!isAllowed) {
      const url = request.nextUrl.clone();
      url.pathname = "/restricted";
      const redirectResponse = NextResponse.redirect(url);
      supabaseResponse.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
      });
      return redirectResponse;
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
