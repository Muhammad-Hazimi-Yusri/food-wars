"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import Link from "next/link";

function ErrorContent() {
  const searchParams = useSearchParams();
  const reason = searchParams.get("reason");

  const messages: Record<string, string> = {
    household: "We couldn't set up your kitchen. Please try signing in again.",
    default: "Something went wrong during sign in. Please try again.",
  };

  const message = messages[reason ?? ""] ?? messages.default;

  return (
    <div className="bg-white p-8 rounded-lg shadow-md text-center space-y-4 max-w-sm">
      <h1 className="font-display text-2xl text-megumi">
        Oops! 失敗
      </h1>
      <p className="text-megumi-light">{message}</p>
      <div className="space-y-2">
        <Button asChild className="w-full">
          <Link href="/login">Try Again</Link>
        </Button>
        <Button asChild variant="outline" className="w-full">
          <Link href="/">Go Home</Link>
        </Button>
      </div>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-hayama-light">
      <Suspense fallback={<div className="text-megumi">Loading...</div>}>
        <ErrorContent />
      </Suspense>
    </div>
  );
}