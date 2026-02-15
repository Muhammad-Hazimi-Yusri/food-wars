import { HouseholdAiSettings } from "@/types/database";
import { createClient } from "@/lib/supabase/server";

/**
 * Fetch AI settings for a household from the database.
 * Uses the server-side Supabase client (cookie-based auth + RLS).
 */
export async function getAiSettings(
  householdId: string
): Promise<HouseholdAiSettings | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("household_ai_settings")
    .select("*")
    .eq("household_id", householdId)
    .single();
  return data;
}

/**
 * Check whether AI features are configured for a household.
 */
export function isAiConfigured(
  settings: HouseholdAiSettings | null
): boolean {
  return !!(settings?.ollama_url && settings?.text_model);
}

/**
 * Call Ollama's /api/generate endpoint and return the parsed response text.
 * Throws on network errors or non-OK status.
 */
export async function callOllama(
  ollamaUrl: string,
  model: string,
  prompt: string,
  system: string
): Promise<string> {
  const url = `${ollamaUrl.replace(/\/+$/, "")}/api/generate`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt,
      system,
      stream: false,
      format: "json",
      options: {
        temperature: 0.1,
        num_predict: 2048,
      },
    }),
    signal: AbortSignal.timeout(55_000), // just under Vercel's 60s max
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Ollama returned ${response.status}: ${text.slice(0, 200)}`
    );
  }

  const data = await response.json();
  return data.response;
}

/**
 * Fetch the list of models from an Ollama instance.
 * Returns model names or throws on failure.
 */
export async function fetchOllamaModels(
  ollamaUrl: string
): Promise<{ name: string; size: number; modified_at: string }[]> {
  const url = `${ollamaUrl.replace(/\/+$/, "")}/api/tags`;

  const response = await fetch(url, {
    signal: AbortSignal.timeout(5_000),
  });

  if (!response.ok) {
    throw new Error(`Ollama returned ${response.status}`);
  }

  const data = await response.json();
  return data.models ?? [];
}
