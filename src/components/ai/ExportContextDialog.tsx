"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ClipboardCopy, Download, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { copyText } from "@/lib/clipboard";
import { getImportContextAction } from "@/lib/ai-import-actions";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ExportContextDialog({ open, onOpenChange }: Props) {
  const [bundle, setBundle] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loading = open && bundle === null && error === null;

  useEffect(() => {
    if (!open || bundle !== null || error !== null) return;
    let cancelled = false;
    getImportContextAction()
      .then((res) => {
        if (cancelled) return;
        if (res.success) setBundle(res.text);
        else setError(res.error);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load");
      });
    return () => {
      cancelled = true;
    };
  }, [open, bundle, error]);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setBundle(null);
      setError(null);
    }
    onOpenChange(next);
  };

  const handleCopy = async () => {
    if (!bundle) return;
    const ok = await copyText(bundle);
    if (ok) toast.success("Copied to clipboard");
    else toast.error("Could not copy to clipboard");
  };

  const handleDownload = () => {
    if (!bundle) return;
    const blob = new Blob([bundle], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "food-wars-ai-context.md";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-megumi" />
            Export context for external AI
          </DialogTitle>
          <DialogDescription>
            Copy this bundle into Claude.ai or ChatGPT, then send it photos of
            your items or receipts. Paste the JSON response into &quot;Import from AI
            JSON&quot; to add everything to stock.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 flex flex-col gap-3">
          {loading && (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-megumi" />
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          {bundle && (
            <>
              <Textarea
                value={bundle}
                readOnly
                spellCheck={false}
                className="flex-1 min-h-[200px] font-mono text-xs"
                onFocus={(e) => e.currentTarget.select()}
              />
              <div className="flex gap-2">
                <Button onClick={handleCopy} className="flex-1 bg-megumi hover:bg-megumi/90 gap-2">
                  <ClipboardCopy className="h-4 w-4" />
                  Copy
                </Button>
                <Button onClick={handleDownload} variant="outline" className="gap-2">
                  <Download className="h-4 w-4" />
                  Download .md
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Tip: in Claude.ai, attach this as a Project knowledge file so
                you can reuse it across imports without re-pasting.
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
