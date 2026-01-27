"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Noren } from "@/components/diner/Noren";
import { RefreshCw, CheckCircle, XCircle } from "lucide-react";

export default function AdminPage() {
  const [secret, setSecret] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const handleReset = async () => {
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/admin/reset-guest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret }),
      });

      const data = await response.json();

      if (response.ok) {
        setResult({ success: true, message: data.message });
      } else {
        setResult({ success: false, message: data.error || "Failed to reset" });
      }
    } catch (error) {
      setResult({ success: false, message: "Network error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-hayama">
      <Noren />
      <main className="p-4 sm:p-6 max-w-md mx-auto">
        <h1 className="text-2xl font-bold text-megumi mb-6">Admin</h1>

        <div className="bg-white rounded-lg p-6 shadow-sm space-y-4">
          <div>
            <Label htmlFor="secret">Admin Secret</Label>
            <Input
              id="secret"
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="Enter admin secret"
              className="mt-1"
            />
          </div>

          <Button
            onClick={handleReset}
            disabled={loading || !secret}
            className="w-full"
          >
            {loading ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Reset Guest Data
          </Button>

          {result && (
            <div
              className={`flex items-center gap-2 p-3 rounded-lg ${
                result.success
                  ? "bg-green-50 text-green-800"
                  : "bg-red-50 text-red-800"
              }`}
            >
              {result.success ? (
                <CheckCircle className="h-5 w-5" />
              ) : (
                <XCircle className="h-5 w-5" />
              )}
              <span>{result.message}</span>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}