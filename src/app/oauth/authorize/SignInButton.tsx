"use client";

import { createClient } from "@/lib/supabase/client";

export function SignInButton({ nextUrl }: { nextUrl: string }) {
  async function handleSignIn() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextUrl)}`,
      },
    });
  }

  return (
    <button
      onClick={handleSignIn}
      className="w-full py-2 rounded bg-red-600 text-white hover:bg-red-700"
    >
      Sign in with Google
    </button>
  );
}
