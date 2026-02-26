"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Noren } from "@/components/diner/Noren";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  UserRound,
  Mail,
  Linkedin,
  Github,
  MessageCircle,
  Server,
  Loader2,
  LogOut,
} from "lucide-react";

export default function RestrictedPage() {
  const [loading, setLoading] = useState<"guest" | "signout" | null>(null);

  const handleContinueAsGuest = async () => {
    setLoading("guest");
    const supabase = createClient();
    await supabase.auth.signOut();
    await supabase.auth.signInAnonymously();
    window.location.href = "/";
  };

  const handleSignOut = async () => {
    setLoading("signout");
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  return (
    <div className="min-h-screen bg-hayama-light">
      <Noren />
      <main className="flex items-center justify-center p-4 py-12">
        <div className="bg-white rounded-lg shadow-md w-full max-w-md p-8 space-y-6">
          {/* Header */}
          <div className="text-center space-y-1">
            <h1 className="font-[family-name:var(--font-display)] text-2xl text-megumi">
              Early Access 限定公開
            </h1>
            <p className="text-sm text-gray-500">
              Food Wars is currently in single-user early access on the hosted
              instance.
            </p>
          </div>

          <p className="text-sm text-megumi-light font-medium text-center">
            To use the full app, you can:
          </p>

          {/* Option 1: Guest Mode */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-megumi font-medium text-sm">
              <UserRound className="h-4 w-4 shrink-0" />
              <span>Use Guest Mode</span>
            </div>
            <p className="text-xs text-gray-500 pl-6">
              Explore with shared demo data — no sign-in required.
            </p>
            <div className="pl-6">
              <Button
                onClick={handleContinueAsGuest}
                disabled={loading !== null}
                className="w-full bg-soma hover:bg-soma/90"
              >
                {loading === "guest" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Signing in as guest...
                  </>
                ) : (
                  "Continue as Guest"
                )}
              </Button>
            </div>
          </div>

          {/* Option 2: Request Access */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-megumi font-medium text-sm">
              <Mail className="h-4 w-4 shrink-0" />
              <span>Request Access</span>
            </div>
            <p className="text-xs text-gray-500 pl-6">
              Contact me to request a personal account or discuss access:
            </p>
            <ul className="pl-6 space-y-1.5">
              <li>
                <a
                  href="mailto:muhammadhazimiyusri@gmail.com"
                  className="inline-flex items-center gap-2 text-sm text-megumi hover:underline font-medium"
                >
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  muhammadhazimiyusri@gmail.com
                </a>
              </li>
              <li>
                <a
                  href="https://www.linkedin.com/in/muhammadhazimiyusri/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-megumi hover:underline font-medium"
                >
                  <Linkedin className="h-3.5 w-3.5 shrink-0" />
                  LinkedIn
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/Muhammad-Hazimi-Yusri"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-megumi hover:underline font-medium"
                >
                  <Github className="h-3.5 w-3.5 shrink-0" />
                  GitHub
                </a>
              </li>
              <li>
                <a
                  href="https://www.reddit.com/user/muhammadhazimiyusri/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-megumi hover:underline font-medium"
                >
                  <MessageCircle className="h-3.5 w-3.5 shrink-0" />
                  Reddit
                </a>
              </li>
            </ul>
          </div>

          {/* Option 3: Self-Host */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-megumi font-medium text-sm">
              <Server className="h-4 w-4 shrink-0" />
              <span>Self-Host</span>
            </div>
            <p className="text-xs text-gray-500 pl-6">
              Deploy your own instance — free with Vercel + Supabase.
            </p>
            <div className="pl-6">
              <Link
                href="https://github.com/Muhammad-Hazimi-Yusri/food-wars#self-hosting"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-megumi hover:underline font-medium"
              >
                Self-Hosting Guide →
              </Link>
            </div>
          </div>

          {/* Divider + Sign Out */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-gray-400">or</span>
            </div>
          </div>

          <Button
            variant="outline"
            onClick={handleSignOut}
            disabled={loading !== null}
            className="w-full"
          >
            {loading === "signout" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Signing out...
              </>
            ) : (
              <>
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </>
            )}
          </Button>
        </div>
      </main>
    </div>
  );
}
