import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { GUEST_HOUSEHOLD_ID } from "@/lib/constants";
import { getAiSettings, isAiConfigured, callOllama, callOllamaVision } from "@/lib/ai-utils";
import { parseAndMatchItems } from "@/lib/ai-parse-items";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const householdId = user.is_anonymous
      ? GUEST_HOUSEHOLD_ID
      : (
          await supabase
            .from("households")
            .select("id")
            .eq("owner_id", user.id)
            .single()
        ).data?.id;

    if (!householdId) {
      return NextResponse.json(
        { error: "No household found" },
        { status: 404 },
      );
    }

    const aiSettings = await getAiSettings(householdId);
    if (!isAiConfigured(aiSettings)) {
      return NextResponse.json(
        { error: "AI not configured. Go to Settings to connect Ollama." },
        { status: 404 },
      );
    }

    const body = await request.json();
    const { imageBase64 } = body as { imageBase64?: string };

    if (!imageBase64 || typeof imageBase64 !== "string") {
      return NextResponse.json(
        { error: "imageBase64 is required" },
        { status: 400 },
      );
    }
    if (!aiSettings!.vision_model) {
      return NextResponse.json(
        { error: "No vision model configured. Go to Settings to select one." },
        { status: 400 },
      );
    }

    // Fetch household context in parallel
    const [productsRes, unitsRes, storesRes, locsRes] = await Promise.all([
      supabase
        .from("products")
        .select("id, name, qu_id_stock, qu_id_purchase, location_id, shopping_location_id, default_due_days")
        .eq("active", true)
        .order("name")
        .limit(150),
      supabase
        .from("quantity_units")
        .select("id, name, name_plural")
        .eq("active", true),
      supabase
        .from("shopping_locations")
        .select("id, name")
        .eq("active", true),
      supabase
        .from("locations")
        .select("id, name")
        .eq("active", true),
    ]);

    const products = productsRes.data ?? [];
    const units = unitsRes.data ?? [];
    const stores = storesRes.data ?? [];
    const locations = locsRes.data ?? [];

    // Build compact context strings for the VLM prompt
    const productCtx = products.length > 0
      ? products.map((p) => `${p.name} [id:${p.id}]`).join(", ")
      : "None";
    const unitCtx = units.length > 0
      ? units.map((u) => u.name + (u.name_plural ? `/${u.name_plural}` : "")).join(", ")
      : "piece";
    const locCtx = locations.length > 0
      ? locations.map((l) => l.name).join(", ")
      : "None";

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

    console.log("[scan-pantry] model:", aiSettings!.vision_model,
      "| prompt length:", vlmPrompt.length);

    let rawResponse = await callOllamaVision(
      aiSettings!.ollama_url!,
      aiSettings!.vision_model!,
      vlmPrompt,
      "",
      imageBase64,
      { think: false, format: "json" },
    );

    // Two-pass fallback: if VLM produced thinking text instead of JSON,
    // send it through the text model to extract structured items.
    const firstPassItems = parseAndMatchItems(rawResponse, products, units, stores, locations);
    if (firstPassItems.length === 0 && rawResponse.length > 50) {
      console.log("[scan-pantry] VLM first pass yielded 0 items, attempting text-model extraction...");

      const extractPrompt = `Extract all food/product items from the text below into JSON.
Return: {"items":[{"product_name":"...","product_id":null,"amount":1,"unit_name":"","best_before_date":null,"store_name":"","price":null,"location_name":"","note":""}]}
Match products to: ${productCtx}
Do NOT invent product IDs — only use [id:...] values from the list above.

TEXT:
${rawResponse.slice(0, 4000)}`;

      const secondResponse = await callOllama(
        aiSettings!.ollama_url!,
        aiSettings!.text_model!,
        extractPrompt,
        "You extract structured JSON from text. Return only valid JSON.",
        { think: false, format: "json", numPredict: 4096, timeout: 120_000 },
      );
      console.log("[scan-pantry] VLM second pass response length:", secondResponse.length);
      rawResponse = secondResponse;
    }

    console.log("[scan-pantry] Ollama raw response:", rawResponse);

    const items = parseAndMatchItems(rawResponse, products, units, stores, locations);

    return NextResponse.json({
      items,
      ...(items.length === 0 && { rawResponse: rawResponse.slice(0, 500) }),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Pantry scan failed";

    const isNetworkError =
      message.includes("fetch failed") ||
      message.includes("ECONNREFUSED") ||
      message.includes("abort") ||
      message.includes("timeout");

    const is403 = message.includes("403");

    return NextResponse.json(
      {
        error: isNetworkError
          ? "Could not reach Ollama. Check Settings and ensure Ollama is running."
          : is403
            ? "Ollama returned 403 Forbidden. If using a tunnel (e.g. Cloudflare Tunnel), check that access policies allow unauthenticated requests."
            : `AI scan error: ${message}`,
      },
      { status: 502 },
    );
  }
}
