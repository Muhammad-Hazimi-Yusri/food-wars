"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  KeyRound,
  Copy,
  Check,
  RefreshCw,
  Trash2,
  ShieldAlert,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

type TokenStatus = {
  hasToken: boolean;
  lastFour: string | null;
};

type Props = {
  isGuest?: boolean;
};

export function ApiTokenSection({ isGuest }: Props) {
  const [status, setStatus] = useState<TokenStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [visibleToken, setVisibleToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isGuest) {
      setLoading(false);
      return;
    }
    fetch("/api/ai/api-token")
      .then((r) => r.json())
      .then((data) => {
        if (data.hasToken !== undefined) {
          setStatus({ hasToken: data.hasToken, lastFour: data.lastFour });
        }
      })
      .catch(() => {
        toast.error("Failed to load API token status");
      })
      .finally(() => setLoading(false));
  }, [isGuest]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/ai/api-token", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to generate token");
        return;
      }
      setVisibleToken(data.token);
      setStatus({ hasToken: true, lastFour: data.token.slice(-4) });
      toast.success("API token generated");
    } catch {
      toast.error("Failed to generate token");
    } finally {
      setGenerating(false);
    }
  };

  const handleRevoke = async () => {
    if (!confirm("Revoke this API token? External tools using it will stop working.")) {
      return;
    }
    setRevoking(true);
    try {
      const res = await fetch("/api/ai/api-token", { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Failed to revoke token");
        return;
      }
      setStatus({ hasToken: false, lastFour: null });
      setVisibleToken(null);
      toast.success("API token revoked");
    } catch {
      toast.error("Failed to revoke token");
    } finally {
      setRevoking(false);
    }
  };

  const handleCopy = async () => {
    if (!visibleToken) return;
    try {
      await navigator.clipboard.writeText(visibleToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Token copied");
    } catch {
      toast.error("Could not copy to clipboard");
    }
  };

  return (
    <section className="bg-white rounded-xl border p-6 mt-6">
      <div className="flex items-center gap-2 mb-1">
        <KeyRound className="h-5 w-5 text-megumi" />
        <h2 className="text-lg font-semibold text-megumi">Inventory API Token</h2>
      </div>
      <p className="text-sm text-gray-600 mb-4">
        Generate a secret token to let external LLM clients (Claude Desktop,
        ChatGPT custom GPT, curl, etc.) pull your current inventory as compact
        JSON. The JSON format is optimised for minimum token usage.
      </p>

      {isGuest ? (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 text-amber-800 text-sm">
          <ShieldAlert className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>Sign in with Google to enable API access.</span>
        </div>
      ) : loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading token status…
        </div>
      ) : (
        <div className="space-y-4">
          {visibleToken ? (
            <div className="space-y-2">
              <Label htmlFor="api-token-reveal" className="text-sm">
                Your new token (copy it now — you won&apos;t see it again)
              </Label>
              <div className="flex gap-2">
                <Input
                  id="api-token-reveal"
                  value={visibleToken}
                  readOnly
                  className="font-mono text-xs"
                />
                <Button variant="outline" size="sm" onClick={handleCopy}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                Store this somewhere safe. Closing this page will hide it
                permanently — you&apos;ll need to regenerate if you lose it.
              </p>
            </div>
          ) : status?.hasToken ? (
            <div className="text-sm text-gray-700">
              A token ending in{" "}
              <code className="px-1.5 py-0.5 bg-gray-100 rounded font-mono text-xs">
                …{status.lastFour}
              </code>{" "}
              is active. Regenerate to rotate, or revoke to disable external access.
            </div>
          ) : (
            <div className="text-sm text-gray-500">
              No API token yet. Generate one to enable external access.
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleGenerate}
              disabled={generating}
              size="sm"
              className="gap-1.5"
            >
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {status?.hasToken ? "Regenerate token" : "Generate token"}
            </Button>
            {status?.hasToken && (
              <Button
                onClick={handleRevoke}
                disabled={revoking}
                variant="outline"
                size="sm"
                className="gap-1.5 text-red-600 hover:text-red-700"
              >
                {revoking ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Revoke
              </Button>
            )}
          </div>

          <div className="pt-2 border-t">
            <p className="text-xs font-medium text-gray-500 mb-1.5">
              Example usage
            </p>
            <pre className="text-xs bg-gray-50 rounded p-2 overflow-x-auto">
              <code>{`curl -H "Authorization: Bearer <YOUR_TOKEN>" \\
  ${typeof window !== "undefined" ? window.location.origin : "https://YOUR_HOST"}/api/inventory/export`}</code>
            </pre>
            <p className="text-xs text-gray-500 mt-1.5">
              Query params: <code>?expiring=7</code> filter, <code>?preamble=1</code> plain-text.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
