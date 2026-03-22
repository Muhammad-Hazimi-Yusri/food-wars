"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ClipboardCopy, Check } from "lucide-react";
import { toast } from "sonner";
import { exportInventoryForAI } from "@/lib/inventory-export";

export function ExportForAIButton() {
  const [copying, setCopying] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleExport() {
    setCopying(true);
    try {
      const result = await exportInventoryForAI();
      if (!result.success) {
        toast.error(result.error ?? "Export failed");
        return;
      }
      try {
        await navigator.clipboard.writeText(result.text!);
      } catch {
        toast.error("Could not copy to clipboard");
        return;
      }
      toast.success("Copied inventory for AI");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } finally {
      setCopying(false);
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleExport}
      disabled={copying}
      className="gap-1.5 text-xs text-muted-foreground hover:text-megumi"
      title="Copy inventory summary for AI chat"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-green-600" />
      ) : (
        <ClipboardCopy className="h-3.5 w-3.5" />
      )}
      {copying ? "Copying..." : copied ? "Copied" : "Export for AI"}
    </Button>
  );
}
