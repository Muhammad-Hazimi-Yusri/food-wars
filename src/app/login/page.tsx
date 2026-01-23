"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const handleGoogleLogin = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-hayama-light">
      <div className="bg-white p-8 rounded-lg shadow-md text-center space-y-4">
        <h1 className="font-[family-name:var(--font-display)] text-2xl text-megumi">
          Food Wars 食戟
        </h1>
        <p className="text-megumi-light">Sign in to save your inventory</p>
        <Button onClick={handleGoogleLogin} className="w-full">
          Sign in with Google
        </Button>
        <p className="text-sm text-muted-foreground">
          Or continue as guest on the home page
        </p>
      </div>
    </div>
  );
}