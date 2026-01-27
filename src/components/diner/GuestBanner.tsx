"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AlertTriangle } from "lucide-react";

export function GuestBanner() {
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setIsGuest(data.user?.is_anonymous ?? false);
    });
  }, []);

  if (!isGuest) return null;

  return (
    <div className="bg-takumi/20 border-b border-takumi/30 px-4 py-2">
      <div className="max-w-5xl mx-auto flex items-center justify-center gap-2 text-sm text-takumi-dark">
        <AlertTriangle className="h-4 w-4" />
        <span>
          <strong>Guest Mode</strong> — Data is shared with other guests and may reset anytime.{" "}
          <button
            onClick={async () => {
              const supabase = createClient();
              await supabase.auth.signInWithOAuth({
                provider: "google",
                options: {
                  redirectTo: `${window.location.origin}/auth/callback`,
                },
              });
            }}
            className="underline hover:no-underline font-medium"
          >
            Sign in
          </button>
          {" "}to save your data.
        </span>
      </div>
    </div>
  );
}