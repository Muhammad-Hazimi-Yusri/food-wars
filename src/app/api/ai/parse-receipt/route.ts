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
        { status: 404 }
      );
    }

    // Validate AI is configured
    const aiSettings = await getAiSettings(householdId);
    if (!isAiConfigured(aiSettings)) {
      return NextResponse.json(
        { error: "AI not configured. Go to Settings to connect Ollama." },
        { status: 404 }
      );
    }

    // Parse + validate request body
    const body = await request.json();
    const { text, mode, imageBase64, currentItems } = body as {
      text?: string;
      mode: "ocr" | "vlm" | "refine";
      imageBase64?: string;
      currentItems?: unknown[];
    };

    // Mode-specific validation
    if (mode === "ocr") {
      if (!text || typeof text !== "string" || !text.trim()) {
        return NextResponse.json({ error: "text is required for OCR mode" }, { status: 400 });
      }
      if (text.length > 5000) {
        return NextResponse.json({ error: "Input too long (max 5000 characters)" }, { status: 400 });
      }
      // Check OCR text quality — Tesseract sometimes produces garbage
      const words = text.trim().split(/\s+/).filter((w: string) => w.length > 1);
      if (words.length < 3) {
        return NextResponse.json({
          error: "OCR could not read the receipt clearly. Try a clearer photo or switch to Vision AI mode.",
        }, { status: 400 });
      }
    } else if (mode === "vlm") {
      if (!imageBase64 || typeof imageBase64 !== "string") {
        return NextResponse.json({ error: "imageBase64 is required for VLM mode" }, { status: 400 });
      }
      if (!aiSettings!.vision_model) {
        return NextResponse.json({ error: "No vision model configured. Go to Settings to select one." }, { status: 400 });
      }
    } else if (mode === "refine") {
      if (!text || typeof text !== "string" || !text.trim()) {
        return NextResponse.json({ error: "text instruction is required for refine mode" }, { status: 400 });
      }
      if (!currentItems || !Array.isArray(currentItems)) {
        return NextResponse.json({ error: "currentItems is required for refine mode" }, { status: 400 });
      }
    } else {
      return NextResponse.json({ error: "Invalid mode. Use 'ocr', 'vlm', or 'refine'." }, { status: 400 });
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

    // Build compact context strings for the system prompt
    const productCtx = products.length > 0
      ? products.map((p) => `${p.name} [id:${p.id}]`).join(", ")
      : "None";
    const unitCtx = units.length > 0
      ? units.map((u) => u.name + (u.name_plural ? `/${u.name_plural}` : "")).join(", ")
      : "piece";
    const storeCtx = stores.length > 0
      ? stores.map((s) => s.name).join(", ")
      : "None";
    const locCtx = locations.length > 0
      ? locations.map((l) => l.name).join(", ")
      : "None";

    const today = new Date().toISOString().split("T")[0];

    // Build prompt based on mode
    let rawResponse: string;

    if (mode === "refine") {
      const refineSystemPrompt = `You are a kitchen inventory assistant. The user has a list of parsed receipt items and wants to modify them via natural language.

AVAILABLE DATA:
Products: ${productCtx}
Units: ${unitCtx}
Stores: ${storeCtx}
Storage locations: ${locCtx}

CURRENT ITEMS:
${JSON.stringify(currentItems, null, 2)}

RULES:
1. Apply the user's instruction to modify the items list.
2. Return a JSON object with key "items" containing the updated array.
3. Each item has: product_name, product_id (from [id:...] or null), amount, unit_name, best_before_date (YYYY-MM-DD or null), store_name, price (number or null), location_name, note.
4. When removing items, simply exclude them from the result.
5. When modifying items, keep all other fields the same.
6. When the user says "remove total/subtotal", remove any items that look like receipt totals (e.g. "TOTAL", "SUBTOTAL", "TAX", "BALANCE", "CHANGE").
7. Do NOT invent product IDs. Only use IDs from the products list above.`;

      rawResponse = await callOllama(
        aiSettings!.ollama_url!,
        aiSettings!.text_model!,
        text!.trim(),
        refineSystemPrompt,
        { format: "json" },
      );
    } else {
      const receiptSystemPrompt = `You are a kitchen inventory assistant. Parse the shopping receipt into structured stock entries.

AVAILABLE DATA:
Products: ${productCtx}
Units: ${unitCtx}
Stores: ${storeCtx}
Storage locations: ${locCtx}

TODAY'S DATE: ${today}

RULES:
1. Return a JSON object with key "items" containing an array of purchased items.
2. Each item has these fields:
   - product_name: the product on the receipt (match to existing products when possible, use their exact name)
   - product_id: the [id:...] value from the products list if matched, otherwise null
   - amount: numeric quantity (default 1 if not specified)
   - unit_name: the unit if mentioned (e.g. "kg", "pack", "piece"). Use "" if not mentioned.
   - best_before_date: null (receipts rarely have expiry dates)
   - store_name: the store name if visible on the receipt, otherwise ""
   - price: price per item as a number (strip currency symbols), otherwise null
   - location_name: "" (receipts don't indicate storage location)
   - note: any extra info (e.g. discounts, special offers), otherwise ""
3. IGNORE these receipt lines — do NOT include them as items:
   - Totals, subtotals, tax, VAT lines
   - Payment method (CARD, CASH, CHANGE)
   - Receipt metadata (date, time, transaction ID, address, phone)
   - Loyalty card / points lines
   - "X items sold" summary lines
4. Split multi-quantity lines: "Tomatoes x3" → amount: 3
5. If a price has a quantity multiplier like "2 @ £1.50" → amount: 2, price: 1.50
6. If a product name closely matches an existing product, use the existing name and id.
7. Do NOT invent product IDs. Only use IDs from the products list above.

EXAMPLE receipt text:
TESCO EXPRESS
Whole Milk 2.25
Bread 800g 1.10
Tomatoes x3 0.85
TOTAL 4.20

EXAMPLE OUTPUT:
{"items":[{"product_name":"Whole Milk","product_id":null,"amount":1,"unit_name":"","best_before_date":null,"store_name":"Tesco","price":2.25,"location_name":"","note":""},{"product_name":"Bread","product_id":null,"amount":800,"unit_name":"g","best_before_date":null,"store_name":"Tesco","price":1.10,"location_name":"","note":""},{"product_name":"Tomatoes","product_id":null,"amount":3,"unit_name":"","best_before_date":null,"store_name":"Tesco","price":0.85,"location_name":"","note":""}]}`;

      if (mode === "vlm") {
        // Shorter VLM prompt — vision models work better with concise instructions
        const vlmPrompt = `Parse this shopping receipt image. Return ONLY a JSON object: {"items":[...]}
Each item: {product_name, product_id, amount, unit_name, best_before_date, store_name, price, location_name, note}
- Match products to: ${productCtx}
- Units: ${unitCtx} | Stores: ${storeCtx}
- Ignore totals, tax, payment lines. price = number (no currency symbol). amount default 1.
- product_id: use [id:...] from list if matched, else null. Do NOT invent IDs.`;

        console.log("[parse-receipt] mode: vlm | model:", aiSettings!.vision_model,
          "| prompt length:", vlmPrompt.length);

        rawResponse = await callOllamaVision(
          aiSettings!.ollama_url!,
          aiSettings!.vision_model!,
          vlmPrompt,
          "",
          imageBase64!,
          { think: false, format: "json" },
        );

        // Two-pass fallback: if VLM produced thinking text instead of JSON,
        // send it through the text model to extract structured items.
        const firstPassItems = parseAndMatchItems(rawResponse, products, units, stores, locations);
        if (firstPassItems.length === 0 && rawResponse.length > 50) {
          console.log("[parse-receipt] VLM first pass yielded 0 items, attempting text-model extraction...");

          const extractPrompt = `Extract all receipt items from the text below into JSON.
Return: {"items":[{"product_name":"...","product_id":null,"amount":1,"unit_name":"","best_before_date":null,"store_name":"","price":0.00,"location_name":"","note":""}]}
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
          console.log("[parse-receipt] VLM second pass response length:", secondResponse.length);
          rawResponse = secondResponse;
        }
      } else {
        const userPrompt = `Parse this receipt text into structured stock entries. Return a JSON object with an "items" array.\n\nRECEIPT TEXT:\n${text!.trim()}`;
        console.log("[parse-receipt] mode: ocr | model:", aiSettings!.text_model,
          "| system prompt length:", receiptSystemPrompt.length,
          "| user prompt preview:", userPrompt.slice(0, 120));

        rawResponse = await callOllama(
          aiSettings!.ollama_url!,
          aiSettings!.text_model!,
          userPrompt,
          receiptSystemPrompt,
          { think: false, format: "json", numPredict: 4096, timeout: 120_000 },
        );
      }
    }

    console.log("[parse-receipt] Ollama raw response:", rawResponse);

    // Parse and fuzzy-match using shared parser
    const items = parseAndMatchItems(rawResponse, products, units, stores, locations);

    return NextResponse.json({
      items,
      // Include raw AI response when parsing yields no items (helps debugging)
      ...(items.length === 0 && { rawResponse: rawResponse.slice(0, 500) }),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Parse failed";

    const isNetworkError =
      message.includes("fetch failed") ||
      message.includes("ECONNREFUSED") ||
      message.includes("abort") ||
      message.includes("timeout");

    return NextResponse.json(
      {
        error: isNetworkError
          ? "Could not reach Ollama. Check Settings and ensure Ollama is running."
          : `AI parse error: ${message}`,
      },
      { status: 502 }
    );
  }
}
