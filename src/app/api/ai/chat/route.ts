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

    const aiSettings = await getAiSettings(householdId);
    if (!isAiConfigured(aiSettings)) {
      return NextResponse.json(
        { error: "AI not configured. Go to Settings to connect Ollama." },
        { status: 404 }
      );
    }

    const { message, history } = await request.json();
    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json(
        { error: "message is required" },
        { status: 400 }
      );
    }

    // Fetch household context in parallel
    const [productsRes, unitsRes, storesRes, locsRes, stockRes] = await Promise.all([
      supabase
        .from("products")
        .select("id, name")
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
      supabase
        .from("stock_entries")
        .select("amount, best_before_date, open, location_id, product:products(name, qu_stock:quantity_units!products_qu_id_stock_fkey(name))")
        .eq("household_id", householdId)
        .gt("amount", 0)
        .order("best_before_date", { ascending: true, nullsFirst: false })
        .limit(100),
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
    const storeCtx = stores.length > 0
      ? stores.map((s) => s.name).join(", ")
      : "None";
    const locCtx = locations.length > 0
      ? locations.map((l) => l.name).join(", ")
      : "None";

    // Build current stock inventory context
    const stockEntries = stockRes.data ?? [];
    const stockCtx = stockEntries.length > 0
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? stockEntries.map((e: any) => {
          const product = Array.isArray(e.product) ? e.product[0] : e.product;
          const quStock = product?.qu_stock ? (Array.isArray(product.qu_stock) ? product.qu_stock[0] : product.qu_stock) : null;
          const name = product?.name ?? "Unknown";
          const unit = quStock?.name ?? "unit";
          const expiry = e.best_before_date ?? "no expiry";
          const loc = e.location_id ? locations.find((l) => l.id === e.location_id)?.name : null;
          const parts = [`${name}: ${e.amount} ${unit}, expires ${expiry}`];
          if (e.open) parts.push("(opened)");
          if (loc) parts.push(`in ${loc}`);
          return parts.join(" ");
        }).join("\n")
      : "Empty — no items in stock";

    const today = new Date().toISOString().split("T")[0];

    const systemPrompt = `You are a helpful kitchen inventory assistant for "Food Wars", a household inventory management app.

You can:
- Answer questions about inventory, cooking, food storage, and nutrition
- Help the user add items to stock when they describe items to add
- Suggest meals based on what's ACTUALLY in stock (see CURRENT STOCK below)
- Advise on food expiry and storage best practices

HOUSEHOLD DATA:
Known products (for matching when adding stock): ${productCtx}
Units: ${unitCtx}
Stores: ${storeCtx}
Storage locations: ${locCtx}
Today's date: ${today}

CURRENT STOCK INVENTORY (what the user actually has right now):
${stockCtx}

IMPORTANT: When suggesting meals or answering "what can I cook", ONLY use items from CURRENT STOCK INVENTORY above. Do NOT suggest items that are just in the known products list but have zero stock. When answering about expiry, use the dates from CURRENT STOCK INVENTORY and compare with today's date.

RESPONSE FORMAT:
- For normal conversation, reply naturally in plain text.
- When the user wants to ADD items to their inventory, reply with a brief summary then include a JSON block wrapped in <stock_entry> tags like this:

<stock_entry>
{"items":[{"product_name":"Milk","product_id":null,"amount":1,"unit_name":"","best_before_date":null,"store_name":"","price":null,"location_name":"","note":""}]}
</stock_entry>

STOCK ENTRY RULES:
- product_name: match to existing products when possible, use their exact name
- product_id: use the [id:...] from the products list if matched, otherwise null
- amount: numeric quantity (default 1)
- unit_name: unit like "can", "kg", "piece" or "" if not mentioned
- best_before_date: YYYY-MM-DD format, null if not mentioned. For month names use last day of that month.
- store_name: store name if mentioned, otherwise ""
- price: number if mentioned (strip currency symbols), otherwise null
- location_name: storage location if mentioned, otherwise ""
- note: extra info or ""
- Do NOT invent product IDs. Only use IDs from the list above.

IMPORTANT: Only use <stock_entry> tags when the user clearly wants to add items to their inventory. For general questions, just reply in plain text. Keep responses concise.`;

    // Build conversation prompt from history
    const trimmedHistory = Array.isArray(history) ? history.slice(-10) : [];
    const conversationParts = trimmedHistory.map(
      (msg: { role: string; content: string }) =>
        msg.role === "user" ? `User: ${msg.content}` : `Assistant: ${msg.content}`
    );
    conversationParts.push(`User: ${message.trim()}`);
    conversationParts.push("Assistant:");
    const conversationPrompt = conversationParts.join("\n\n");

    // Call Ollama without forced JSON format
    const rawResponse = await callOllama(
      aiSettings!.ollama_url!,
      aiSettings!.text_model!,
      conversationPrompt,
      systemPrompt,
      { temperature: 0.3 },
    );

    console.log("[ai-chat] Ollama raw response:", rawResponse);

    // Check for stock entry tags in response
    const stockEntryMatch = rawResponse.match(
      /<stock_entry>\s*([\s\S]*?)\s*<\/stock_entry>/
    );

    if (stockEntryMatch) {
      const content = rawResponse
        .replace(/<stock_entry>[\s\S]*<\/stock_entry>/, "")
        .trim();

      const items = parseAndMatchItems(
        stockEntryMatch[1],
        products,
        units,
        stores,
        locations,
      );

      return NextResponse.json({
        type: "stock_entry",
        content: content || "Here are the items I parsed:",
        items,
      });
    }

    return NextResponse.json({
      type: "text",
      content: rawResponse.trim(),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Chat failed";

    const isNetworkError =
      message.includes("fetch failed") ||
      message.includes("ECONNREFUSED") ||
      message.includes("abort") ||
      message.includes("timeout");

    return NextResponse.json(
      {
        error: isNetworkError
          ? "Could not reach Ollama. Check Settings and ensure Ollama is running."
          : `AI error: ${message}`,
      },
      { status: 502 }
    );
  }
}
