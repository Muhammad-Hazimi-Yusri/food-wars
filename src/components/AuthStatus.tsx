"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import type { User } from "@supabase/supabase-js";

export function AuthStatus() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
    });
  }, []);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
  };

  if (loading) return <p className="text-sm">Loading...</p>;

  if (!user) {
    return (
      <p className="text-sm">
        Guest mode —{" "}
        <a href="/login" className="text-soma underline">
          Sign in
        </a>
      </p>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <span>Signed in as {user.email}</span>
      <Button variant="outline" size="sm" onClick={handleSignOut}>
        Sign out
      </Button>
    </div>
  );
}