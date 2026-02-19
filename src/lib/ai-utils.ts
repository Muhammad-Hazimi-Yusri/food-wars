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
export type OllamaCallOptions = {
  format?: "json" | Record<string, unknown>;
  temperature?: number;
  numPredict?: number;
  /** Set to false to disable thinking for reasoning models (e.g. qwen3) */
  think?: boolean;
  /** Override the default request timeout in milliseconds */
  timeout?: number;
};

export async function callOllama(
  ollamaUrl: string,
  model: string,
  prompt: string,
  system: string,
  options?: OllamaCallOptions,
): Promise<string> {
  const url = `${ollamaUrl.replace(/\/+$/, "")}/api/generate`;

  const body: Record<string, unknown> = {
    model,
    prompt,
    system,
    stream: false,
    options: {
      temperature: options?.temperature ?? 0.1,
      num_predict: options?.numPredict ?? 2048,
    },
  };

  if (options?.format) {
    body.format = options.format;
  }
  if (options?.think === false) {
    body.think = false;
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(options?.timeout ?? 55_000),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Ollama returned ${response.status}: ${text.slice(0, 200)}`
    );
  }

  const data = await response.json();
  const raw: string = data.response ?? "";
  // Strip <think> reasoning tags from thinking models (e.g. qwen3)
  return raw.replace(/<think>[\s\S]*?<\/think>\s*/g, "").trim();
}

/**
 * Call Ollama's /api/chat endpoint with a vision model and base64 image.
 * Used for VLM-based receipt scanning where the model reads the image directly.
 */
export async function callOllamaVision(
  ollamaUrl: string,
  model: string,
  prompt: string,
  system: string,
  imageBase64: string,
  options?: OllamaCallOptions,
): Promise<string> {
  const url = `${ollamaUrl.replace(/\/+$/, "")}/api/chat`;

  // Build messages — omit system message when empty (vision models often ignore it)
  const messages: Record<string, unknown>[] = [];
  if (system) messages.push({ role: "system", content: system });
  messages.push({ role: "user", content: prompt, images: [imageBase64] });

  const body: Record<string, unknown> = {
    model,
    messages,
    stream: false,
    options: {
      temperature: options?.temperature ?? 0.1,
      num_predict: options?.numPredict ?? 4096,
    },
  };

  if (options?.format) {
    body.format = options.format;
  }
  if (options?.think === false) {
    body.think = false;
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(options?.timeout ?? 90_000),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Ollama returned ${response.status}: ${text.slice(0, 200)}`
    );
  }

  const data = await response.json();
  const content: string = data.message?.content ?? "";
  // Thinking models (qwen3-vl) put reasoning in a separate "thinking" field.
  // When content is empty, the model spent all tokens thinking — fall back to it.
  const thinking: string =
    (data.message as Record<string, unknown> | undefined)?.thinking as string ?? "";
  let raw = content;
  if (!raw && thinking) {
    console.log("[callOllamaVision] Content empty, falling back to thinking field. Length:", thinking.length);
    raw = thinking;
  } else if (!raw) {
    console.log("[callOllamaVision] Empty content and no thinking. Response keys:", Object.keys(data));
  }
  // Strip <think> reasoning tags from thinking models (e.g. qwen3-vl)
  return raw.replace(/<think>[\s\S]*?<\/think>\s*/g, "").trim();
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
