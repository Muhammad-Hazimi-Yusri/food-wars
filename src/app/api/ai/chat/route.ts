import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { GUEST_HOUSEHOLD_ID } from "@/lib/constants";
import { getAiSettings, isAiConfigured, callOllama } from "@/lib/ai-utils";
import { parseAndMatchItems } from "@/lib/ai-parse-items";
import { findBestMatch } from "@/lib/fuzzy-match";
import { computeRecipeFulfillment, computeDueScore } from "@/lib/recipe-utils";
import type { RecipeRef, RecipeAction, RecipeDraft } from "@/types/ai";
import type { RecipeIngredientWithRelations } from "@/types/database";

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

    // Fetch household context + recipes in parallel
    const [productsRes, unitsRes, storesRes, locsRes, stockRes, recipesRes] = await Promise.all([
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
        .select("product_id, amount, best_before_date, open, location_id, product:products(name, qu_stock:quantity_units!products_qu_id_stock_fkey(name))")
        .eq("household_id", householdId)
        .gt("amount", 0)
        .order("best_before_date", { ascending: true, nullsFirst: false })
        .limit(100),
      supabase
        .from("recipes")
        .select("id, name, base_servings, product_id")
        .eq("household_id", householdId)
        .order("name")
        .limit(80),
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

    // Build recipe context
    const recipes = recipesRes.data ?? [];
    let recipeCtx = "";

    if (recipes.length > 0) {
      // Fetch ingredients for all recipes
      const recipeIds = recipes.map((r) => r.id);
      const ingredientsRes = await supabase
        .from("recipe_ingredients")
        .select("id, recipe_id, product_id, amount, qu_id, not_check_stock_fulfillment, product:products(id, name, qu_id_stock, not_check_stock_fulfillment_for_recipes), qu:quantity_units(id, name, name_plural)")
        .eq("household_id", householdId)
        .in("recipe_id", recipeIds);
      const allIngredients = (ingredientsRes.data ?? []) as unknown as RecipeIngredientWithRelations[];

      // Build stockByProduct for fulfillment
      const stockByProduct = new Map<string, number>();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const e of stockEntries as any[]) {
        if (e.product_id) {
          stockByProduct.set(e.product_id, (stockByProduct.get(e.product_id) ?? 0) + e.amount);
        }
      }

      // Map product_id → name for "produces" display
      const productsMap = new Map<string, string>(products.map((p) => [p.id, p.name]));

      // Group ingredients by recipe_id
      const ingredientsByRecipe = new Map<string, RecipeIngredientWithRelations[]>();
      for (const ing of allIngredients) {
        const arr = ingredientsByRecipe.get(ing.recipe_id) ?? [];
        arr.push(ing);
        ingredientsByRecipe.set(ing.recipe_id, arr);
      }

      // Compute per-recipe summary
      type RecipeSummary = {
        id: string;
        name: string;
        base_servings: number;
        producesProductName: string | null;
        canMake: boolean;
        missingCount: number;
        dueScore: number;
        ingredientLines: string;
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const recipeSummaries: RecipeSummary[] = (recipes as any[]).map((r) => {
        const ings = ingredientsByRecipe.get(r.id) ?? [];
        const fulfillment = computeRecipeFulfillment(ings, stockByProduct, r.base_servings, r.base_servings);
        const dueScore = computeDueScore(
          ings,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          stockEntries as unknown as { product_id: string; best_before_date: string | null }[],
          today,
        );
        const missingCount = fulfillment.ingredients.filter((f) => !f.skipped && !f.fulfilled).length;

        const detailLines = ings.slice(0, 15).map((ing, idx) => {
          const f = fulfillment.ingredients[idx];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const product = Array.isArray(ing.product) ? ing.product[0] : ing.product as any;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const qu = Array.isArray(ing.qu) ? ing.qu[0] : ing.qu as any;
          const name = product?.name ?? "Unknown";
          const unitName = qu?.name ?? "";
          const missing = f ? !f.skipped && !f.fulfilled : false;
          const amt = parseFloat(ing.amount.toFixed(2)).toString();
          const parts = [amt];
          if (unitName) parts.push(unitName);
          parts.push(name + (missing ? "[✗]" : ""));
          return parts.join(" ");
        });

        return {
          id: r.id,
          name: r.name,
          base_servings: r.base_servings,
          producesProductName: r.product_id ? (productsMap.get(r.product_id) ?? null) : null,
          canMake: fulfillment.canMake,
          missingCount,
          dueScore,
          ingredientLines: detailLines.join(", "),
        };
      });

      // Sort by due score descending (most urgent first)
      recipeSummaries.sort((a, b) => b.dueScore - a.dueScore);

      const lines: string[] = [
        `## RECIPE LIBRARY (${recipeSummaries.length} recipes, sorted by cooking urgency)`,
        `Fulfillment key: ✓ = can make now, ✗N = missing N ingredients`,
        ``,
      ];

      recipeSummaries.forEach((r, i) => {
        const status = r.canMake ? "✓ can make" : `✗ missing ${r.missingCount}`;
        const produces = r.producesProductName ? ` | produces: ${r.producesProductName}` : "";
        lines.push(`${i + 1}. [urgency:${r.dueScore}] "${r.name}" (id:${r.id}) | ${r.base_servings} servings | ${status}${produces}`);
        if (r.ingredientLines) {
          lines.push(`   ${r.ingredientLines}`);
        }
      });

      recipeCtx = lines.join("\n");
    }

    const recipeInstructions = recipes.length > 0 ? `

## RECIPE BEHAVIOUR
When users ask about cooking or recipes, use the RECIPE LIBRARY data above — do not guess from stock alone.
Reference specific recipes using <recipe_ref> tags inline in your response:
<recipe_ref>{"recipe_id":"EXACT-ID-FROM-LIST","recipe_name":"Exact Name","can_make":true,"missing_count":0}</recipe_ref>

When user asks to add missing ingredients to a shopping list, respond with:
<recipe_action>{"action":"add_missing_to_shopping_list","recipe_id":"EXACT-ID","recipe_name":"Exact Name"}</recipe_action>

Handle these intents:
- "What can I cook?" → list recipes where ✓ can make, highest urgency first, one <recipe_ref> per recipe
- "What should I cook first?" → recommend highest urgency ✓ can make recipe
- "Can I make [X]?" → check its status; list missing ingredients with amounts
- "Recipe for [X]?" / "What's in [X]?" → list its ingredients from the data above
- "Scale [X] for N servings" → multiply each ingredient by (N ÷ base_servings)
- "Add missing [X] to shopping list" → respond with <recipe_action> tag
- "Suggest a recipe for expiring items" → recommend highest urgency score recipe

IMPORTANT: Only use recipe IDs that appear in the RECIPE LIBRARY above. Never invent recipe IDs.
IMPORTANT: <recipe_ref> tags coexist with normal text — include inline when mentioning a specific recipe.
IMPORTANT: Only output <recipe_action> when the user explicitly wants to add missing items to a shopping list.` : "";

    const recipeGenerationInstructions = `

## RECIPE GENERATION
When the user asks to "create", "make", "generate", or "give me a recipe" for any dish:
Respond with a brief intro sentence, then output a <recipe_draft> tag containing a single JSON object:

<recipe_draft>
{
  "name": "Chicken Stir Fry",
  "description": "Quick weeknight stir fry",
  "instructions": "## Steps\\n1. Slice chicken thin...\\n2. Heat wok on high...",
  "base_servings": 4,
  "ingredients": [
    {
      "product_name": "Chicken Breast",
      "product_id": "uuid-from-known-products-or-null",
      "amount": 500,
      "unit_name": "g",
      "ingredient_group": "Main",
      "note": "sliced thin",
      "variable_amount": null
    }
  ]
}
</recipe_draft>

RECIPE GENERATION RULES:
- product_id: use the [id:...] from the known products list if matched, otherwise null
- unit_name: use a unit from the Units list when possible
- instructions: markdown with ## headings and numbered steps
- ingredient_group: use groups like "Main", "Sauce", "Garnish", "Spices", or null
- If user says "from my stock" / "using what I have", prefer in-stock products first
- Output exactly ONE <recipe_draft> per response. Never output <recipe_draft> for other intents (stock queries, recipe lookups, etc.)`;

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
${recipeCtx ? `\n${recipeCtx}` : ""}${recipeInstructions}${recipeGenerationInstructions}

STOCK ENTRY RESPONSE FORMAT:
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

    // Parse stock entry tag
    const stockEntryMatch = rawResponse.match(
      /<stock_entry>\s*([\s\S]*?)\s*<\/stock_entry>/
    );
    const items = stockEntryMatch
      ? parseAndMatchItems(stockEntryMatch[1], products, units, stores, locations)
      : [];

    // Parse recipe_ref tags
    const recipeRefs: RecipeRef[] = [];
    const recipeRefRegex = /<recipe_ref>([\s\S]*?)<\/recipe_ref>/g;
    for (const match of rawResponse.matchAll(recipeRefRegex)) {
      try {
        recipeRefs.push(JSON.parse(match[1]) as RecipeRef);
      } catch {
        // skip malformed tag
      }
    }

    // Parse recipe_action tag (take first valid one)
    let recipeAction: RecipeAction | undefined;
    const recipeActionRegex = /<recipe_action>([\s\S]*?)<\/recipe_action>/g;
    for (const match of rawResponse.matchAll(recipeActionRegex)) {
      try {
        recipeAction = JSON.parse(match[1]) as RecipeAction;
        break;
      } catch {
        // skip malformed tag
      }
    }

    // Parse recipe_draft tag
    let recipeDraft: RecipeDraft | undefined;
    const recipeDraftMatch = rawResponse.match(/<recipe_draft>\s*([\s\S]*?)\s*<\/recipe_draft>/);
    if (recipeDraftMatch) {
      try {
        const parsed = JSON.parse(recipeDraftMatch[1]) as RecipeDraft;
        parsed.ingredients = parsed.ingredients.map((ing) => {
          // Validate product_id if AI provided one — reject invented IDs
          if (ing.product_id) {
            const valid = products.find((p) => p.id === ing.product_id);
            if (!valid) ing.product_id = null;
          }
          // Fuzzy-match product_name if product_id still null
          if (!ing.product_id) {
            const match = findBestMatch(ing.product_name, products, (p) => p.name);
            if (match) ing.product_id = match.item.id;
          }
          // Fuzzy-match unit_name → qu_id
          const unitMatch = findBestMatch(ing.unit_name, units, (u) => u.name);
          ing.qu_id = unitMatch ? unitMatch.item.id : null;
          return ing;
        });
        recipeDraft = parsed;
      } catch {
        // skip malformed recipe_draft
      }
    }

    // Strip all tags for clean display text
    const content = rawResponse
      .replace(/<stock_entry>[\s\S]*?<\/stock_entry>/g, "")
      .replace(/<recipe_ref>[\s\S]*?<\/recipe_ref>/g, "")
      .replace(/<recipe_action>[\s\S]*?<\/recipe_action>/g, "")
      .replace(/<recipe_draft>[\s\S]*?<\/recipe_draft>/g, "")
      .trim() || (items.length > 0 ? "Here are the items I parsed:" : "I couldn't generate a response.");

    return NextResponse.json({
      type: items.length > 0 ? "stock_entry" : "text",
      content,
      items: items.length > 0 ? items : undefined,
      recipe_refs: recipeRefs.length > 0 ? recipeRefs : undefined,
      recipe_action: recipeAction,
      recipe_draft: recipeDraft,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Chat failed";

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
            : `AI error: ${message}`,
      },
      { status: 502 }
    );
  }
}
