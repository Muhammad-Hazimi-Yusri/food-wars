import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { createServiceClient } from "@/lib/supabase/server";
import { requireHouseholdId } from "@/lib/mcp/auth";
import {
  buildInventoryItems,
  formatInventoryPreamble,
} from "@/lib/inventory-export-core";
import { getExpiryStatus } from "@/lib/inventory-utils";
import {
  consumeStockMcp,
  openStockMcp,
  transferStockMcp,
  correctStockMcp,
  addStockMcp,
  consumeRecipeMcp,
  type SimpleStockAddItem,
} from "@/lib/mcp/mutations";
import { detectIssues, repairIssue } from "@/lib/mcp/data-issues";
import { parseReceiptCore } from "@/lib/ai-parse-receipt-core";
import { scanPantryCore } from "@/lib/ai-scan-pantry-core";
import type { HouseholdAiSettings } from "@/types/database";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type ToolExtra = { authInfo?: AuthInfo };

type ToolCtx = {
  supabase: ReturnType<typeof createServiceClient>;
  householdId: string;
};

function getCtx(extra: ToolExtra): ToolCtx {
  const householdId = requireHouseholdId(extra.authInfo);
  return { supabase: createServiceClient(), householdId };
}

function jsonResult(payload: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload) }],
  };
}

function errorResult(message: string) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify({ error: message }) }],
    isError: true,
  };
}

async function fetchAiSettings(
  supabase: ReturnType<typeof createServiceClient>,
  householdId: string,
): Promise<HouseholdAiSettings | null> {
  const { data } = await supabase
    .from("household_ai_settings")
    .select("*")
    .eq("household_id", householdId)
    .maybeSingle();
  return data as HouseholdAiSettings | null;
}

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

export function registerTools(server: McpServer): void {
  // ===== Inventory =====

  server.registerTool(
    "list_inventory",
    {
      title: "List inventory",
      description:
        "Aggregated current stock for this household: product name, quantity (with unit), nearest expiry, and locations. Use this whenever the user asks what they have, what's about to expire, or to recommend recipes.",
      inputSchema: {
        expiringWithinDays: z
          .number()
          .int()
          .nonnegative()
          .optional()
          .describe("If set, only return items expiring within this many days."),
        preamble: z
          .boolean()
          .optional()
          .describe("If true, return a human-readable preamble + JSON instead of raw JSON."),
      },
    },
    async ({ expiringWithinDays, preamble }, extra) => {
      const { supabase, householdId } = getCtx(extra);
      const { items, today, error } = await buildInventoryItems(supabase, householdId);
      if (error) return errorResult(error);

      let filtered = items;
      if (typeof expiringWithinDays === "number") {
        const cutoff = new Date();
        cutoff.setHours(0, 0, 0, 0);
        cutoff.setDate(cutoff.getDate() + expiringWithinDays);
        const cutoffIso = cutoff.toISOString().split("T")[0];
        filtered = items.filter((i) => i.exp && i.exp <= cutoffIso);
      }

      if (preamble) {
        return { content: [{ type: "text", text: formatInventoryPreamble(filtered, today) }] };
      }
      return jsonResult({ items: filtered, today });
    },
  );

  server.registerTool(
    "search_products",
    {
      title: "Search products",
      description:
        "Find products in this household by name (case-insensitive substring) or by exact barcode. Returns product id, name, unit ids, default storage location, and default due days.",
      inputSchema: {
        query: z.string().min(1),
        limit: z.number().int().positive().max(50).optional(),
      },
    },
    async ({ query, limit }, extra) => {
      const { supabase, householdId } = getCtx(extra);
      const cap = limit ?? 20;
      const q = query.trim();

      const isBarcode = /^\d{6,14}$/.test(q);
      if (isBarcode) {
        const { data: bc } = await supabase
          .from("product_barcodes")
          .select("product_id, products(id, name, qu_id_stock, qu_id_purchase, location_id, default_due_days, active)")
          .eq("household_id", householdId)
          .eq("barcode", q)
          .limit(cap);
        const products = (bc ?? []).flatMap((row) =>
          Array.isArray(row.products) ? row.products : (row.products ? [row.products] : [])
        );
        return jsonResult({ products, matched_by: "barcode" });
      }

      const { data, error } = await supabase
        .from("products")
        .select("id, name, qu_id_stock, qu_id_purchase, location_id, default_due_days, active")
        .eq("household_id", householdId)
        .eq("active", true)
        .ilike("name", `%${q}%`)
        .order("name")
        .limit(cap);
      if (error) return errorResult(error.message);
      return jsonResult({ products: data ?? [], matched_by: "name" });
    },
  );

  server.registerTool(
    "list_expiring",
    {
      title: "List expiring items",
      description:
        "Categorised list of items that are expired, overdue, or due soon within the given days window. Use when the user wants to know what to use up.",
      inputSchema: {
        days: z.number().int().nonnegative().describe("Warning window in days (e.g. 3 or 7)."),
      },
    },
    async ({ days }, extra) => {
      const { supabase, householdId } = getCtx(extra);
      const { data, error } = await supabase
        .from("stock_entries")
        .select("id, best_before_date, amount, product:products(name, due_type)")
        .eq("household_id", householdId)
        .gt("amount", 0)
        .not("best_before_date", "is", null)
        .order("best_before_date", { ascending: true });
      if (error) return errorResult(error.message);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const expired: unknown[] = [];
      const overdue: unknown[] = [];
      const dueSoon: unknown[] = [];

      for (const row of (data ?? []) as Array<{
        id: string;
        best_before_date: string;
        amount: number;
        product: { name: string; due_type: number } | { name: string; due_type: number }[] | null;
      }>) {
        if (row.best_before_date === "2999-12-31") continue;
        const product = Array.isArray(row.product) ? row.product[0] : row.product;
        const status = getExpiryStatus(row.best_before_date, product?.due_type ?? 1, days);
        if (status === "fresh" || status === "none") continue;
        const d = new Date(row.best_before_date);
        d.setHours(0, 0, 0, 0);
        const daysUntil = Math.ceil((d.getTime() - today.getTime()) / 86400000);
        const item = { id: row.id, name: product?.name ?? "Unknown", best_before_date: row.best_before_date, amount: row.amount, daysUntil };
        if (status === "expired") expired.push(item);
        else if (status === "overdue") overdue.push(item);
        else if (status === "due_soon") dueSoon.push(item);
      }

      return jsonResult({ expired, overdue, dueSoon, total: expired.length + overdue.length + dueSoon.length });
    },
  );

  server.registerTool(
    "list_locations",
    {
      title: "List storage locations",
      description: "Storage locations for this household (Fridge, Freezer, Pantry, etc).",
      inputSchema: {},
    },
    async (_args, extra) => {
      const { supabase, householdId } = getCtx(extra);
      const { data, error } = await supabase
        .from("locations")
        .select("id, name, is_freezer, active")
        .eq("household_id", householdId)
        .eq("active", true)
        .order("sort_order");
      if (error) return errorResult(error.message);
      return jsonResult({ locations: data ?? [] });
    },
  );

  server.registerTool(
    "list_units",
    {
      title: "List quantity units",
      description: "Quantity units (g, kg, L, piece, pack) defined for this household.",
      inputSchema: {},
    },
    async (_args, extra) => {
      const { supabase, householdId } = getCtx(extra);
      const { data, error } = await supabase
        .from("quantity_units")
        .select("id, name, name_plural, active")
        .eq("household_id", householdId)
        .eq("active", true)
        .order("name");
      if (error) return errorResult(error.message);
      return jsonResult({ units: data ?? [] });
    },
  );

  // ===== Stock mutations (write to stock_log w/ correlation_id) =====

  const stockAddItemSchema = z.object({
    productId: z.string().uuid(),
    amount: z.number().positive(),
    bestBeforeDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    price: z.number().nonnegative().nullable().optional(),
    locationId: z.string().uuid().nullable().optional(),
    shoppingLocationId: z.string().uuid().nullable().optional(),
    note: z.string().nullable().optional(),
  });

  server.registerTool(
    "add_stock",
    {
      title: "Add stock entries",
      description:
        "Insert one or more stock entries for existing products. All productIds must already exist in this household; this tool does not create new products. Logged as 'purchase' transactions; visible in the Journal with undo.",
      inputSchema: {
        items: z.array(stockAddItemSchema).min(1).max(50),
      },
    },
    async ({ items }, extra) => {
      const { supabase, householdId } = getCtx(extra);
      const result = await addStockMcp(supabase, householdId, items as SimpleStockAddItem[]);
      return jsonResult(result);
    },
  );

  server.registerTool(
    "consume_stock",
    {
      title: "Consume stock (FIFO)",
      description:
        "Consume a quantity of a product. Applies FIFO: opened entries first, then earliest best-before. Set spoiled=true to log as waste instead of consumption.",
      inputSchema: {
        productId: z.string().uuid(),
        amount: z.number().positive(),
        spoiled: z.boolean().optional(),
      },
    },
    async ({ productId, amount, spoiled }, extra) => {
      const { supabase, householdId } = getCtx(extra);
      const result = await consumeStockMcp(supabase, householdId, productId, amount, spoiled ?? false);
      return jsonResult(result);
    },
  );

  server.registerTool(
    "open_stock",
    {
      title: "Open stock entry",
      description:
        "Mark the oldest sealed stock entry for a product as opened. Recalculates the best-before date based on the product's default_due_days_after_open if set.",
      inputSchema: {
        productId: z.string().uuid(),
        count: z.number().int().positive().optional(),
      },
    },
    async ({ productId, count }, extra) => {
      const { supabase, householdId } = getCtx(extra);
      const result = await openStockMcp(supabase, householdId, productId, count ?? 1);
      return jsonResult(result);
    },
  );

  server.registerTool(
    "transfer_stock",
    {
      title: "Transfer stock entry to another location",
      description:
        "Move a specific stock_entry (by entryId) to a different location. Recalculates best-before when thawing from a freezer.",
      inputSchema: {
        entryId: z.string().uuid(),
        destinationLocationId: z.string().uuid(),
      },
    },
    async ({ entryId, destinationLocationId }, extra) => {
      const { supabase, householdId } = getCtx(extra);
      const result = await transferStockMcp(supabase, householdId, entryId, destinationLocationId);
      return jsonResult(result);
    },
  );

  server.registerTool(
    "correct_stock",
    {
      title: "Set stock total (inventory correction)",
      description:
        "Set the total amount of a product to a new value. If lower, removes via FIFO; if higher, increases the newest entry. Logged as 'inventory-correction'.",
      inputSchema: {
        productId: z.string().uuid(),
        newAmount: z.number().nonnegative(),
      },
    },
    async ({ productId, newAmount }, extra) => {
      const { supabase, householdId } = getCtx(extra);
      const result = await correctStockMcp(supabase, householdId, productId, newAmount);
      return jsonResult(result);
    },
  );

  // ===== Image processing (delegates to existing AI pipelines) =====

  server.registerTool(
    "parse_receipt_image",
    {
      title: "Parse a receipt image into stock items",
      description:
        "Run OCR or vision AI over a base64-encoded receipt image and return a list of parsed items ready to pass to add_stock. Requires Ollama configured in the app's AI settings.",
      inputSchema: {
        imageBase64: z.string().min(1).optional(),
        mode: z.enum(["ocr", "vlm", "refine"]),
        ocrText: z.string().optional().describe("For mode='ocr' or 'refine': the OCR-extracted text or instruction."),
      },
    },
    async ({ imageBase64, mode, ocrText }, extra) => {
      const { supabase, householdId } = getCtx(extra);
      const aiSettings = await fetchAiSettings(supabase, householdId);
      const result = await parseReceiptCore(supabase, householdId, aiSettings, {
        mode,
        text: ocrText,
        imageBase64,
      });
      if (!result.ok) return errorResult(result.error);
      return jsonResult({ items: result.items, ...(result.rawResponse ? { rawResponse: result.rawResponse } : {}) });
    },
  );

  server.registerTool(
    "scan_pantry_image",
    {
      title: "Scan a pantry photo",
      description:
        "Run the configured vision model over a base64-encoded pantry/shelf photo to identify visible products and quantities. Requires Ollama with a vision model.",
      inputSchema: {
        imageBase64: z.string().min(1),
      },
    },
    async ({ imageBase64 }, extra) => {
      const { supabase, householdId } = getCtx(extra);
      const aiSettings = await fetchAiSettings(supabase, householdId);
      const result = await scanPantryCore(supabase, householdId, aiSettings, { imageBase64 });
      if (!result.ok) return errorResult(result.error);
      return jsonResult({ items: result.items, ...(result.rawResponse ? { rawResponse: result.rawResponse } : {}) });
    },
  );

  // ===== Data cleanup =====

  server.registerTool(
    "find_data_issues",
    {
      title: "Find data quality issues",
      description:
        "Scan for orphan stock entries, expired-past-grace stock, duplicate product names, products without stock units, and non-positive amounts. Returns issue ids that can be passed to repair_data_issue.",
      inputSchema: {},
    },
    async (_args, extra) => {
      const { supabase, householdId } = getCtx(extra);
      const issues = await detectIssues(supabase, householdId);
      return jsonResult({ issues, total: issues.length });
    },
  );

  server.registerTool(
    "repair_data_issue",
    {
      title: "Repair a single data issue",
      description:
        "Apply the suggested fix for one issue by id. Pass confirm=true to authorize. Stock_entries deletions write a stock_log row (visible in Journal). Products are deactivated rather than hard-deleted.",
      inputSchema: {
        issueId: z.string().min(1),
        action: z.enum(["fix", "delete"]).describe("'fix' applies the suggested fix; 'delete' removes/deactivates the entity."),
        confirm: z.literal(true).describe("Must be true to authorize the destructive action."),
      },
    },
    async ({ issueId, action, confirm }, extra) => {
      const { supabase, householdId } = getCtx(extra);
      // Re-detect to get a fresh issue list bound to current state.
      const issues = await detectIssues(supabase, householdId);
      const result = await repairIssue(supabase, householdId, issues, issueId, action, confirm);
      return jsonResult(result);
    },
  );

  // ===== Shopping lists =====

  server.registerTool(
    "list_shopping_lists",
    {
      title: "List shopping lists",
      description: "All shopping lists in this household with item counts.",
      inputSchema: {},
    },
    async (_args, extra) => {
      const { supabase, householdId } = getCtx(extra);
      const { data: lists, error } = await supabase
        .from("shopping_lists")
        .select("id, name, description, is_auto_target, created_at")
        .eq("household_id", householdId)
        .order("created_at");
      if (error) return errorResult(error.message);

      const ids = (lists ?? []).map((l) => l.id);
      const counts = new Map<string, number>();
      if (ids.length > 0) {
        const { data: items } = await supabase
          .from("shopping_list_items")
          .select("shopping_list_id, done")
          .eq("household_id", householdId)
          .in("shopping_list_id", ids)
          .eq("done", false);
        for (const it of (items ?? []) as Array<{ shopping_list_id: string }>) {
          counts.set(it.shopping_list_id, (counts.get(it.shopping_list_id) ?? 0) + 1);
        }
      }
      const enriched = (lists ?? []).map((l) => ({ ...l, openItemCount: counts.get(l.id) ?? 0 }));
      return jsonResult({ lists: enriched });
    },
  );

  server.registerTool(
    "get_shopping_list",
    {
      title: "Get a shopping list with items",
      description: "Full contents of a single shopping list, including open and done items.",
      inputSchema: { listId: z.string().uuid() },
    },
    async ({ listId }, extra) => {
      const { supabase, householdId } = getCtx(extra);
      const { data: list, error: listErr } = await supabase
        .from("shopping_lists")
        .select("id, name, description, is_auto_target")
        .eq("id", listId)
        .eq("household_id", householdId)
        .maybeSingle();
      if (listErr) return errorResult(listErr.message);
      if (!list) return errorResult("Shopping list not found in this household");

      const { data: items, error: itemsErr } = await supabase
        .from("shopping_list_items")
        .select("id, product_id, note, amount, qu_id, done, sort_order, product:products(name)")
        .eq("household_id", householdId)
        .eq("shopping_list_id", listId)
        .order("sort_order");
      if (itemsErr) return errorResult(itemsErr.message);

      return jsonResult({ list, items: items ?? [] });
    },
  );

  server.registerTool(
    "add_to_shopping_list",
    {
      title: "Add an item to a shopping list",
      description:
        "Append a product-linked item or free-text note to a shopping list. If the product is already on the list (and not yet done), increments its amount instead of duplicating.",
      inputSchema: {
        listId: z.string().uuid(),
        productId: z.string().uuid().nullable().optional(),
        note: z.string().nullable().optional(),
        amount: z.number().positive(),
        unitId: z.string().uuid().nullable().optional(),
      },
    },
    async ({ listId, productId, note, amount, unitId }, extra) => {
      const { supabase, householdId } = getCtx(extra);

      // Ensure list belongs to household
      const { data: list } = await supabase
        .from("shopping_lists")
        .select("id")
        .eq("id", listId)
        .eq("household_id", householdId)
        .maybeSingle();
      if (!list) return errorResult("Shopping list not found in this household");

      if (productId) {
        const { data: existing } = await supabase
          .from("shopping_list_items")
          .select("id, amount")
          .eq("household_id", householdId)
          .eq("shopping_list_id", listId)
          .eq("product_id", productId)
          .eq("done", false)
          .maybeSingle();
        if (existing) {
          const { error } = await supabase
            .from("shopping_list_items")
            .update({ amount: existing.amount + amount })
            .eq("id", existing.id);
          if (error) return errorResult(error.message);
          return jsonResult({ success: true, itemId: existing.id, mode: "incremented" });
        }
      }

      const { data: maxRow } = await supabase
        .from("shopping_list_items")
        .select("sort_order")
        .eq("household_id", householdId)
        .eq("shopping_list_id", listId)
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();
      const sort = (maxRow?.sort_order ?? -1) + 1;

      const { data, error } = await supabase
        .from("shopping_list_items")
        .insert({
          household_id: householdId,
          shopping_list_id: listId,
          product_id: productId ?? null,
          note: note ?? null,
          amount,
          qu_id: unitId ?? null,
          sort_order: sort,
        })
        .select("id")
        .single();
      if (error) return errorResult(error.message);
      return jsonResult({ success: true, itemId: data.id, mode: "inserted" });
    },
  );

  // ===== Recipes =====

  server.registerTool(
    "list_recipes",
    {
      title: "List recipes",
      description: "All recipes in this household with basic metadata.",
      inputSchema: {},
    },
    async (_args, extra) => {
      const { supabase, householdId } = getCtx(extra);
      const { data, error } = await supabase
        .from("recipes")
        .select("id, name, description, base_servings, desired_servings, product_id")
        .eq("household_id", householdId)
        .order("name");
      if (error) return errorResult(error.message);
      return jsonResult({ recipes: data ?? [] });
    },
  );

  server.registerTool(
    "get_recipe",
    {
      title: "Get a recipe with ingredients",
      description: "Full recipe details including ingredients with product references and quantities.",
      inputSchema: { recipeId: z.string().uuid() },
    },
    async ({ recipeId }, extra) => {
      const { supabase, householdId } = getCtx(extra);
      const { data: recipe, error: recErr } = await supabase
        .from("recipes")
        .select("*")
        .eq("id", recipeId)
        .eq("household_id", householdId)
        .maybeSingle();
      if (recErr) return errorResult(recErr.message);
      if (!recipe) return errorResult("Recipe not found in this household");

      const { data: ingredients, error: ingErr } = await supabase
        .from("recipe_ingredients")
        .select("id, product_id, amount, qu_id, note, product:products(name), qu:quantity_units(name, name_plural)")
        .eq("household_id", householdId)
        .eq("recipe_id", recipeId)
        .order("sort_order");
      if (ingErr) return errorResult(ingErr.message);

      return jsonResult({ recipe, ingredients: ingredients ?? [] });
    },
  );

  server.registerTool(
    "consume_recipe",
    {
      title: "Consume a recipe (cook it)",
      description:
        "Deduct each ingredient from stock under a single correlation_id so it appears in the Journal as one cook event. Skips ingredients flagged not_check_stock_fulfillment or with insufficient stock.",
      inputSchema: {
        recipeId: z.string().uuid(),
        desiredServings: z.number().positive().optional(),
      },
    },
    async ({ recipeId, desiredServings }, extra) => {
      const { supabase, householdId } = getCtx(extra);
      const result = await consumeRecipeMcp(supabase, householdId, recipeId, desiredServings);
      return jsonResult(result);
    },
  );
}
