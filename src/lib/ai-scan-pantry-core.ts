import type { SupabaseClient } from "@supabase/supabase-js";
import {
  callOllama,
  callOllamaVision,
  isAiConfigured,
} from "@/lib/ai-utils";
import { parseAndMatchItems } from "@/lib/ai-parse-items";
import type { HouseholdAiSettings, ParsedStockItem } from "@/types/database";

export type ScanPantryInput = {
  imageBase64: string;
};

export type ScanPantryResult =
  | { ok: true; items: ParsedStockItem[]; rawResponse?: string }
  | { ok: false; status: number; error: string };

/**
 * Core pantry-scanning pipeline. Filters all master-data queries by householdId
 * so it is safe to call with either a cookie-session client or a service-role
 * client.
 */
export async function scanPantryCore(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  householdId: string,
  aiSettings: HouseholdAiSettings | null,
  input: ScanPantryInput,
): Promise<ScanPantryResult> {
  if (!isAiConfigured(aiSettings)) {
    return { ok: false, status: 404, error: "AI not configured. Go to Settings to connect Ollama." };
  }
  const settings = aiSettings!;

  const { imageBase64 } = input;
  if (!imageBase64 || typeof imageBase64 !== "string") {
    return { ok: false, status: 400, error: "imageBase64 is required" };
  }
  if (!settings.vision_model) {
    return { ok: false, status: 400, error: "No vision model configured. Go to Settings to select one." };
  }

  const [productsRes, unitsRes, storesRes, locsRes] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, qu_id_stock, qu_id_purchase, location_id, shopping_location_id, default_due_days")
      .eq("household_id", householdId)
      .eq("active", true)
      .order("name")
      .limit(150),
    supabase
      .from("quantity_units")
      .select("id, name, name_plural")
      .eq("household_id", householdId)
      .eq("active", true),
    supabase
      .from("shopping_locations")
      .select("id, name")
      .eq("household_id", householdId)
      .eq("active", true),
    supabase
      .from("locations")
      .select("id, name")
      .eq("household_id", householdId)
      .eq("active", true),
  ]);

  const products = productsRes.data ?? [];
  const units = unitsRes.data ?? [];
  const stores = storesRes.data ?? [];
  const locations = locsRes.data ?? [];

  const productCtx = products.length > 0
    ? products.map((p) => `${p.name} [id:${p.id}]`).join(", ")
    : "None";
  const unitCtx = units.length > 0
    ? units.map((u) => u.name + (u.name_plural ? `/${u.name_plural}` : "")).join(", ")
    : "piece";
  const locCtx = locations.length > 0 ? locations.map((l) => l.name).join(", ") : "None";

  const vlmPrompt = `Look at this photo of food storage (pantry, fridge, shelf, etc.). Identify all visible food products and estimate their quantities.
Return ONLY a JSON object: {"items":[...]}
Each item: {product_name, product_id, amount, unit_name, best_before_date, store_name, price, location_name, note}
- Match products to: ${productCtx}
- Units: ${unitCtx} | Storage locations: ${locCtx}
- product_id: use [id:...] from list if matched, else null. Do NOT invent IDs.
- amount: count visible items of same product (e.g. 3 cans of beans). Default 1.
- unit_name: use "" unless weight/volume is clearly visible on packaging.
- best_before_date: null unless clearly visible on packaging.
- price: null (not applicable for pantry scanning)
- store_name: ""
- location_name: ""
- note: add brief description if identification is uncertain (e.g. "partially obscured label")
- Focus on clearly identifiable products. Skip items you cannot identify.`;

  let rawResponse = await callOllamaVision(
    settings.ollama_url!,
    settings.vision_model!,
    vlmPrompt,
    "",
    imageBase64,
    { think: false, format: "json" },
  );

  const firstPassItems = parseAndMatchItems(rawResponse, products, units, stores, locations);
  if (firstPassItems.length === 0 && rawResponse.length > 50) {
    const extractPrompt = `Extract all food/product items from the text below into JSON.
Return: {"items":[{"product_name":"...","product_id":null,"amount":1,"unit_name":"","best_before_date":null,"store_name":"","price":null,"location_name":"","note":""}]}
Match products to: ${productCtx}
Do NOT invent product IDs — only use [id:...] values from the list above.

TEXT:
${rawResponse.slice(0, 4000)}`;

    rawResponse = await callOllama(
      settings.ollama_url!,
      settings.text_model!,
      extractPrompt,
      "You extract structured JSON from text. Return only valid JSON.",
      { think: false, format: "json", numPredict: 4096, timeout: 120_000 },
    );
  }

  const items = parseAndMatchItems(rawResponse, products, units, stores, locations);
  return {
    ok: true,
    items,
    ...(items.length === 0 ? { rawResponse: rawResponse.slice(0, 500) } : {}),
  };
}
