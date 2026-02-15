"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Bot, Loader2, CheckCircle2, AlertTriangle, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { HouseholdAiSettings } from "@/types/database";

type OllamaModel = {
  name: string;
  size: number;
  modified_at: string;
};

type Props = {
  initialSettings: HouseholdAiSettings | null;
};

export function AiSettingsClient({ initialSettings }: Props) {
  const [ollamaUrl, setOllamaUrl] = useState(
    initialSettings?.ollama_url ?? ""
  );
  const [textModel, setTextModel] = useState(
    initialSettings?.text_model ?? ""
  );
  const [visionModel, setVisionModel] = useState(
    initialSettings?.vision_model ?? ""
  );

  const [models, setModels] = useState<OllamaModel[]>([]);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(
    null
  );
  const [testError, setTestError] = useState("");
  const [saving, setSaving] = useState(false);

  // If we already have settings with models selected, pre-populate
  // model list on first render so dropdowns aren't empty
  const hasExistingModels = !!(
    initialSettings?.text_model || initialSettings?.vision_model
  );

  const handleTestConnection = async () => {
    if (!ollamaUrl.trim()) {
      toast.error("Enter an Ollama URL first");
      return;
    }

    setTesting(true);
    setTestResult(null);
    setTestError("");

    try {
      const res = await fetch("/api/ai/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ollama_url: ollamaUrl.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setTestResult("error");
        setTestError(data.error ?? "Connection failed");
        return;
      }

      setModels(data.models);
      setTestResult("success");
      toast(`Connected — ${data.models.length} model(s) found`);
    } catch {
      setTestResult("error");
      setTestError("Network error — could not reach the server");
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);

    try {
      const res = await fetch("/api/ai/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ollama_url: ollamaUrl.trim() || null,
          text_model: textModel || null,
          vision_model: visionModel || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? "Failed to save settings");
        return;
      }

      toast("AI settings saved");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const formatSize = (bytes: number) => {
    const gb = bytes / 1_000_000_000;
    return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(bytes / 1_000_000).toFixed(0)} MB`;
  };

  const modelOptions = models.length > 0 ? models : [];

  // Show dropdowns if we have fetched models OR if there are saved values
  const showModelSelectors = modelOptions.length > 0 || hasExistingModels;

  return (
    <div className="space-y-6">
      {/* AI Section Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-megumi/10">
          <Bot className="h-5 w-5 text-megumi" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-megumi">AI Smart Input</h2>
          <p className="text-sm text-gray-500">
            Connect your self-hosted Ollama instance for natural language stock
            entry and receipt scanning.
          </p>
        </div>
      </div>

      {/* Privacy Warning */}
      <div className="flex gap-3 p-4 rounded-lg bg-amber-50 border border-amber-200">
        <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-sm text-amber-800">
          <p className="font-medium mb-1">Privacy notice</p>
          <p>
            Your Ollama URL is stored in our database and AI requests are proxied
            through our server. For full privacy, self-host Food Wars.
          </p>
        </div>
      </div>

      {/* Ollama URL */}
      <div className="space-y-2">
        <Label htmlFor="ollama-url">Ollama URL</Label>
        <div className="flex gap-2">
          <Input
            id="ollama-url"
            type="url"
            value={ollamaUrl}
            onChange={(e) => {
              setOllamaUrl(e.target.value);
              setTestResult(null);
            }}
            placeholder="http://192.168.1.100:11434"
            className="flex-1"
          />
          <Button
            type="button"
            variant="outline"
            onClick={handleTestConnection}
            disabled={testing || !ollamaUrl.trim()}
          >
            {testing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Testing...
              </>
            ) : (
              "Test Connection"
            )}
          </Button>
        </div>

        {/* Test result feedback */}
        {testResult === "success" && (
          <p className="text-sm text-green-600 flex items-center gap-1">
            <CheckCircle2 className="h-4 w-4" />
            Connected — {models.length} model(s) available
          </p>
        )}
        {testResult === "error" && (
          <p className="text-sm text-red-600 flex items-center gap-1">
            <AlertTriangle className="h-4 w-4" />
            {testError}
          </p>
        )}
      </div>

      {/* Model Selection */}
      {showModelSelectors && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="text-model">Text Model</Label>
            <Select value={textModel} onValueChange={setTextModel}>
              <SelectTrigger>
                <SelectValue placeholder="Select text model" />
              </SelectTrigger>
              <SelectContent>
                {modelOptions.length > 0 ? (
                  modelOptions.map((m) => (
                    <SelectItem key={m.name} value={m.name}>
                      {m.name}{" "}
                      <span className="text-gray-400">
                        ({formatSize(m.size)})
                      </span>
                    </SelectItem>
                  ))
                ) : (
                  // Show saved value as only option when models haven't been fetched
                  textModel && (
                    <SelectItem value={textModel}>{textModel}</SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">
              Used for parsing natural language and receipts
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="vision-model">
              Vision Model{" "}
              <span className="text-gray-400 font-normal">(optional)</span>
            </Label>
            <Select value={visionModel} onValueChange={setVisionModel}>
              <SelectTrigger>
                <SelectValue placeholder="Select vision model" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {modelOptions.length > 0 ? (
                  modelOptions.map((m) => (
                    <SelectItem key={m.name} value={m.name}>
                      {m.name}{" "}
                      <span className="text-gray-400">
                        ({formatSize(m.size)})
                      </span>
                    </SelectItem>
                  ))
                ) : (
                  visionModel &&
                  visionModel !== "none" && (
                    <SelectItem value={visionModel}>{visionModel}</SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">
              Reserved for future pantry scanning features
            </p>
          </div>
        </div>
      )}

      {/* Save */}
      <div className="flex gap-2 pt-2">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-soma hover:bg-soma/90"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Saving...
            </>
          ) : (
            "Save Settings"
          )}
        </Button>
      </div>
    </div>
  );
}
