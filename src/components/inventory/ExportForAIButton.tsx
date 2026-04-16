"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ClipboardCopy, Check, Link2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { exportInventoryForAI } from "@/lib/inventory-export";
import { copyDeferredText } from "@/lib/clipboard";

export function ExportForAIButton() {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  function handleCopyJson() {
    setBusy(true);
    const copyPromise = copyDeferredText(async () => {
      const result = await exportInventoryForAI();
      if (!result.success) throw new Error(result.error ?? "Export failed");
      return result.text!;
    });
    copyPromise
      .then((ok) => {
        if (!ok) {
          toast.error("Could not copy to clipboard");
          return;
        }
        toast.success("Copied inventory for AI");
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch((err: unknown) => {
        toast.error(err instanceof Error ? err.message : "Export failed");
      })
      .finally(() => setBusy(false));
  }

  function handleCopyApiUrl() {
    setBusy(true);
    const copyPromise = copyDeferredText(async () => {
      const res = await fetch("/api/ai/api-token?reveal=1");
      if (!res.ok) {
        if (res.status === 403) throw new Error("Sign in to use API tokens");
        throw new Error("Failed to fetch token");
      }
      const { token } = await res.json();
      if (!token) {
        throw new Error("No API token. Generate one in Settings first.");
      }
      return `${window.location.origin}/api/inventory/export?token=${encodeURIComponent(token)}`;
    });
    copyPromise
      .then((ok) => {
        if (!ok) {
          toast.error("Could not copy to clipboard");
          return;
        }
        toast.success("API URL copied");
      })
      .catch((err: unknown) => {
        toast.error(err instanceof Error ? err.message : "Failed to fetch token");
      })
      .finally(() => setBusy(false));
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          className="gap-1.5 text-xs text-muted-foreground hover:text-megumi"
          title="Share inventory with an AI"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-green-600" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          {busy ? "Working..." : copied ? "Copied" : "Export for AI"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleCopyJson} className="gap-2">
          <ClipboardCopy className="h-4 w-4" />
          Copy inventory JSON
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleCopyApiUrl} className="gap-2">
          <Link2 className="h-4 w-4" />
          Copy API URL
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
