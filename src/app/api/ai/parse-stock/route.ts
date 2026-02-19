import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { GUEST_HOUSEHOLD_ID } from "@/lib/constants";
import { getAiSettings, isAiConfigured, callOllama } from "@/lib/ai-utils";
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
    const { text } = await request.json();
    if (!text || typeof text !== "string" || !text.trim()) {
      return NextResponse.json(
        { error: "text is required" },
        { status: 400 }
      );
    }
    if (text.length > 500) {
      return NextResponse.json(
        { error: "Input too long (max 500 characters)" },
        { status: 400 }
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

    const systemPrompt = `You are a kitchen inventory assistant. Parse the user's natural language input into structured stock entries.

AVAILABLE DATA:
Products: ${productCtx}
Units: ${unitCtx}
Stores: ${storeCtx}
Storage locations: ${locCtx}

TODAY'S DATE: ${today}

RULES:
1. Return a JSON object with key "items" containing an array.
2. Each item has these fields:
   - product_name: the product mentioned (match to existing products when possible, use their exact name)
   - product_id: the [id:...] value from the products list if matched, otherwise null
   - amount: numeric quantity (default 1 if not specified)
   - unit_name: the unit mentioned (e.g. "can", "kg", "piece"). Use "" if not mentioned.
   - best_before_date: ISO date (YYYY-MM-DD). For month names like "march", use the last day of that month in the current or next year. For relative like "next week", calculate from today. null if not mentioned.
   - store_name: store/shop name if mentioned, otherwise ""
   - price: numeric price if mentioned (strip currency symbols), otherwise null
   - location_name: storage location if mentioned (e.g. "fridge", "pantry"), otherwise ""
   - note: any extra information that doesn't fit above, otherwise ""
3. Split multiple items separated by commas, "and", or new lines into separate items.
4. If a product name closely matches an existing product, use the existing name and id.
5. Do NOT invent product IDs. Only use IDs from the products list above.
6. When unsure about a field, use null or "".
7. For past months (earlier than today), assume next year.

EXAMPLE INPUT: "2 cans of tomatoes, expires march, tesco, 1.50"
EXAMPLE OUTPUT:
{"items":[{"product_name":"Chopped Tomatoes","product_id":"abc-123","amount":2,"unit_name":"can","best_before_date":"2026-03-31","store_name":"Tesco","price":1.50,"location_name":"","note":""}]}

EXAMPLE INPUT: "milk, eggs, and 500g cheddar in the fridge"
EXAMPLE OUTPUT:
{"items":[{"product_name":"Milk","product_id":null,"amount":1,"unit_name":"","best_before_date":null,"store_name":"","price":null,"location_name":"Fridge","note":""},{"product_name":"Eggs","product_id":null,"amount":1,"unit_name":"","best_before_date":null,"store_name":"","price":null,"location_name":"Fridge","note":""},{"product_name":"Cheddar","product_id":null,"amount":500,"unit_name":"g","best_before_date":null,"store_name":"","price":null,"location_name":"Fridge","note":""}]}`;

    // Call Ollama
    const rawResponse = await callOllama(
      aiSettings!.ollama_url!,
      aiSettings!.text_model!,
      text.trim(),
      systemPrompt,
      { format: "json" },
    );

    console.log("[parse-stock] Ollama raw response:", rawResponse);

    // Parse and fuzzy-match using shared parser
    const items = parseAndMatchItems(rawResponse, products, units, stores, locations);

    return NextResponse.json({ items });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Parse failed";

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
            : `AI parse error: ${message}`,
      },
      { status: 502 }
    );
  }
}
