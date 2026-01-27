"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function WelcomeModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const hasVisited = localStorage.getItem("hasVisitedBefore");
    if (hasVisited) return;

    // Check if already signed in
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) return; // Already signed in, don't show

      // Show modal after 500ms delay
      const timer = setTimeout(() => setOpen(true), 500);
      return () => clearTimeout(timer);
    });
  }, []);

  const handleSignIn = async () => {
    localStorage.setItem("hasVisitedBefore", "true");
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  const handleGuest = async () => {
    localStorage.setItem("hasVisitedBefore", "true");
    const supabase = createClient();
    
    const { error } = await supabase.auth.signInAnonymously();
    
    if (error) {
      console.error("Guest sign-in failed:", error.message);
    }
    
    setOpen(false);
    window.location.reload();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) {
        handleGuest();
      }
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-[family-name:var(--font-display)] text-2xl text-megumi text-center">
            いらっしゃいませ!
          </DialogTitle>
          <DialogDescription className="text-center">
            Welcome to Food Wars
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-3 pt-4">
          <Button onClick={handleSignIn} className="w-full">
            Sign in with Google
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Sync across devices & backup your data
          </p>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">or</span>
            </div>
          </div>

          <Button variant="outline" onClick={handleGuest} className="w-full">
            Continue as Guest
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Demo mode — data is shared and may reset
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}