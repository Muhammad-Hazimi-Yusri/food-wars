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
  undoTransactionMcp,
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

/**
 * Validate that each non-null FK id exists within this household. Service-role
 * bypasses RLS, and the DB FK constraints don't enforce household scoping, so
 * an id from another household would otherwise satisfy the constraint and leak
 * a cross-household reference. Returns an error message, or null if all OK.
 */
async function assertOwned(
  supabase: ReturnType<typeof createServiceClient>,
  householdId: string,
  checks: Array<{ table: string; id: string | null | undefined; label: string }>,
): Promise<string | null> {
  for (const c of checks) {
    if (!c.id) continue;
    const { data } = await supabase
      .from(c.table)
      .select("id")
      .eq("id", c.id)
      .eq("household_id", householdId)
      .maybeSingle();
    if (!data) return `${c.label} not found in this household`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Master-data CRUD helpers (locations / shopping_locations / quantity_units /
// product_groups all share name / description / active / sort_order). The 12
// public tools are thin wrappers so each entity surfaces explicitly, but the
// shared logic lives here.
// ---------------------------------------------------------------------------

async function mdCreate(
  supabase: ReturnType<typeof createServiceClient>,
  householdId: string,
  table: string,
  idLabel: string,
  fields: Record<string, unknown>,
  sortOrder: number | undefined,
) {
  let sort = sortOrder;
  if (sort === undefined) {
    const { data: maxRow } = await supabase
      .from(table)
      .select("sort_order")
      .eq("household_id", householdId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    sort = ((maxRow?.sort_order as number | undefined) ?? -1) + 1;
  }
  const { data, error } = await supabase
    .from(table)
    .insert({ household_id: householdId, ...fields, sort_order: sort })
    .select("id")
    .single();
  if (error) return errorResult(error.message);
  return jsonResult({ success: true, [idLabel]: data.id });
}

async function mdUpdate(
  supabase: ReturnType<typeof createServiceClient>,
  householdId: string,
  table: string,
  label: string,
  id: string,
  patch: Record<string, unknown>,
) {
  const { data: existing } = await supabase
    .from(table)
    .select("id")
    .eq("id", id)
    .eq("household_id", householdId)
    .maybeSingle();
  if (!existing) return errorResult(`${label} not found in this household`);
  if (Object.keys(patch).length === 0) return errorResult("No fields to update");
  const { error } = await supabase.from(table).update(patch).eq("id", id);
  if (error) return errorResult(error.message);
  return jsonResult({ success: true, updated: Object.keys(patch) });
}

async function mdDelete(
  supabase: ReturnType<typeof createServiceClient>,
  householdId: string,
  table: string,
  label: string,
  id: string,
) {
  const { data: existing } = await supabase
    .from(table)
    .select("id")
    .eq("id", id)
    .eq("household_id", householdId)
    .maybeSingle();
  if (!existing) return errorResult(`${label} not found in this household`);
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) return errorResult(error.message);
  return jsonResult({ success: true, deleted: true });
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

  server.registerTool(
    "update_shopping_list_item",
    {
      title: "Update a shopping list item",
      description:
        "Partially update an item on a shopping list. Any subset of amount, note, and done may be supplied; omitted fields are left unchanged. Use done=true to tick an item off (mark as purchased) without creating a stock entry.",
      inputSchema: {
        itemId: z.string().uuid(),
        amount: z.number().positive().optional(),
        note: z.string().nullable().optional(),
        done: z.boolean().optional(),
      },
    },
    async ({ itemId, amount, note, done }, extra) => {
      const { supabase, householdId } = getCtx(extra);

      const { data: existing } = await supabase
        .from("shopping_list_items")
        .select("id")
        .eq("id", itemId)
        .eq("household_id", householdId)
        .maybeSingle();
      if (!existing) return errorResult("Shopping list item not found in this household");

      const patch: Record<string, unknown> = {};
      if (amount !== undefined) patch.amount = amount;
      if (note !== undefined) patch.note = note;
      if (done !== undefined) patch.done = done;
      if (Object.keys(patch).length === 0) return errorResult("No fields to update");

      const { error } = await supabase
        .from("shopping_list_items")
        .update(patch)
        .eq("id", itemId);
      if (error) return errorResult(error.message);
      return jsonResult({ success: true, itemId, updated: Object.keys(patch) });
    },
  );

  server.registerTool(
    "remove_from_shopping_list",
    {
      title: "Remove an item from a shopping list",
      description:
        "Delete a single item from a shopping list. The deletion is permanent.",
      inputSchema: {
        itemId: z.string().uuid(),
      },
    },
    async ({ itemId }, extra) => {
      const { supabase, householdId } = getCtx(extra);

      const { data: existing } = await supabase
        .from("shopping_list_items")
        .select("id")
        .eq("id", itemId)
        .eq("household_id", householdId)
        .maybeSingle();
      if (!existing) return errorResult("Shopping list item not found in this household");

      const { error } = await supabase
        .from("shopping_list_items")
        .delete()
        .eq("id", itemId);
      if (error) return errorResult(error.message);
      return jsonResult({ success: true, itemId });
    },
  );

  server.registerTool(
    "clear_done_shopping_list_items",
    {
      title: "Clear completed items from a shopping list",
      description:
        "Delete every item on the shopping list that is currently marked done. Returns the count deleted.",
      inputSchema: {
        listId: z.string().uuid(),
      },
    },
    async ({ listId }, extra) => {
      const { supabase, householdId } = getCtx(extra);

      const { data: list } = await supabase
        .from("shopping_lists")
        .select("id")
        .eq("id", listId)
        .eq("household_id", householdId)
        .maybeSingle();
      if (!list) return errorResult("Shopping list not found in this household");

      const { data, error } = await supabase
        .from("shopping_list_items")
        .delete()
        .eq("household_id", householdId)
        .eq("shopping_list_id", listId)
        .eq("done", true)
        .select("id");
      if (error) return errorResult(error.message);
      return jsonResult({ success: true, count: data?.length ?? 0 });
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

  // ===== Recipe authoring (CRUD) =====

  server.registerTool(
    "create_recipe",
    {
      title: "Create a recipe",
      description:
        "Create a new recipe. Returns the new recipeId. Add ingredients with add_recipe_ingredient afterwards. Note: base_servings cannot be changed after creation since it defines the scaling baseline for ingredients.",
      inputSchema: {
        name: z.string().min(1),
        description: z.string().nullable().optional(),
        instructions: z.string().nullable().optional(),
        baseServings: z.number().positive().optional(),
        productId: z.string().uuid().nullable().optional(),
        notCheckShoppinglist: z.boolean().optional(),
      },
    },
    async ({ name, description, instructions, baseServings, productId, notCheckShoppinglist }, extra) => {
      const { supabase, householdId } = getCtx(extra);

      if (productId) {
        const { data: prod } = await supabase
          .from("products")
          .select("id")
          .eq("id", productId)
          .eq("household_id", householdId)
          .maybeSingle();
        if (!prod) return errorResult("productId not found in this household");
      }

      const base = baseServings ?? 1;
      const { data, error } = await supabase
        .from("recipes")
        .insert({
          household_id: householdId,
          name,
          description: description ?? null,
          instructions: instructions ?? null,
          base_servings: base,
          desired_servings: base,
          product_id: productId ?? null,
          not_check_shoppinglist: notCheckShoppinglist ?? false,
        })
        .select("id")
        .single();
      if (error) return errorResult(error.message);
      return jsonResult({ success: true, recipeId: data.id });
    },
  );

  server.registerTool(
    "update_recipe",
    {
      title: "Update a recipe",
      description:
        "Partial update of a recipe's metadata. base_servings is deliberately not patchable here — changing it would invalidate the scaling of existing ingredients. To change it, recreate the recipe.",
      inputSchema: {
        recipeId: z.string().uuid(),
        name: z.string().min(1).optional(),
        description: z.string().nullable().optional(),
        instructions: z.string().nullable().optional(),
        desiredServings: z.number().positive().optional(),
        productId: z.string().uuid().nullable().optional(),
        notCheckShoppinglist: z.boolean().optional(),
      },
    },
    async ({ recipeId, name, description, instructions, desiredServings, productId, notCheckShoppinglist }, extra) => {
      const { supabase, householdId } = getCtx(extra);

      const { data: existing } = await supabase
        .from("recipes")
        .select("id")
        .eq("id", recipeId)
        .eq("household_id", householdId)
        .maybeSingle();
      if (!existing) return errorResult("Recipe not found in this household");

      if (productId !== undefined && productId !== null) {
        const { data: prod } = await supabase
          .from("products")
          .select("id")
          .eq("id", productId)
          .eq("household_id", householdId)
          .maybeSingle();
        if (!prod) return errorResult("productId not found in this household");
      }

      const patch: Record<string, unknown> = {};
      if (name !== undefined) patch.name = name;
      if (description !== undefined) patch.description = description;
      if (instructions !== undefined) patch.instructions = instructions;
      if (desiredServings !== undefined) patch.desired_servings = desiredServings;
      if (productId !== undefined) patch.product_id = productId;
      if (notCheckShoppinglist !== undefined) patch.not_check_shoppinglist = notCheckShoppinglist;
      if (Object.keys(patch).length === 0) return errorResult("No fields to update");

      const { error } = await supabase
        .from("recipes")
        .update(patch)
        .eq("id", recipeId);
      if (error) return errorResult(error.message);
      return jsonResult({ success: true, recipeId, updated: Object.keys(patch) });
    },
  );

  server.registerTool(
    "delete_recipe",
    {
      title: "Delete a recipe",
      description:
        "Permanently delete a recipe and cascade-delete its ingredients and nestings. Requires confirm: true.",
      inputSchema: {
        recipeId: z.string().uuid(),
        confirm: z.literal(true),
      },
    },
    async ({ recipeId }, extra) => {
      const { supabase, householdId } = getCtx(extra);

      const { data: existing } = await supabase
        .from("recipes")
        .select("id")
        .eq("id", recipeId)
        .eq("household_id", householdId)
        .maybeSingle();
      if (!existing) return errorResult("Recipe not found in this household");

      const { error } = await supabase
        .from("recipes")
        .delete()
        .eq("id", recipeId);
      if (error) return errorResult(error.message);
      return jsonResult({ success: true, recipeId });
    },
  );

  server.registerTool(
    "set_recipe_instructions",
    {
      title: "Set recipe instructions",
      description:
        "Convenience tool for replacing a recipe's instructions field (markdown text). Equivalent to update_recipe with only instructions set.",
      inputSchema: {
        recipeId: z.string().uuid(),
        instructions: z.string(),
      },
    },
    async ({ recipeId, instructions }, extra) => {
      const { supabase, householdId } = getCtx(extra);

      const { data: existing } = await supabase
        .from("recipes")
        .select("id")
        .eq("id", recipeId)
        .eq("household_id", householdId)
        .maybeSingle();
      if (!existing) return errorResult("Recipe not found in this household");

      const { error } = await supabase
        .from("recipes")
        .update({ instructions })
        .eq("id", recipeId);
      if (error) return errorResult(error.message);
      return jsonResult({ success: true, recipeId });
    },
  );

  server.registerTool(
    "add_recipe_ingredient",
    {
      title: "Add an ingredient to a recipe",
      description:
        "Append an ingredient to a recipe. At least one of `amount` or `variableAmount` must be set. Auto-assigns sort_order to place it at the end. If productId is set, it is validated to belong to this household.",
      inputSchema: {
        recipeId: z.string().uuid(),
        productId: z.string().uuid().nullable().optional(),
        amount: z.number().positive().nullable().optional(),
        quId: z.string().uuid().nullable().optional(),
        note: z.string().nullable().optional(),
        ingredientGroup: z.string().nullable().optional(),
        variableAmount: z.string().nullable().optional(),
        onlyCheckSingleUnitInStock: z.boolean().optional(),
        notCheckStockFulfillment: z.boolean().optional(),
        priceFactor: z.number().positive().optional(),
      },
    },
    async (
      {
        recipeId,
        productId,
        amount,
        quId,
        note,
        ingredientGroup,
        variableAmount,
        onlyCheckSingleUnitInStock,
        notCheckStockFulfillment,
        priceFactor,
      },
      extra,
    ) => {
      const { supabase, householdId } = getCtx(extra);

      if (amount == null && (variableAmount == null || variableAmount === "")) {
        return errorResult("At least one of amount or variableAmount must be set");
      }

      const { data: recipe } = await supabase
        .from("recipes")
        .select("id")
        .eq("id", recipeId)
        .eq("household_id", householdId)
        .maybeSingle();
      if (!recipe) return errorResult("Recipe not found in this household");

      if (productId) {
        const { data: prod } = await supabase
          .from("products")
          .select("id")
          .eq("id", productId)
          .eq("household_id", householdId)
          .maybeSingle();
        if (!prod) return errorResult("productId not found in this household");
      }

      const { data: maxRow } = await supabase
        .from("recipe_ingredients")
        .select("sort_order")
        .eq("household_id", householdId)
        .eq("recipe_id", recipeId)
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();
      const sort = (maxRow?.sort_order ?? -1) + 1;

      const { data, error } = await supabase
        .from("recipe_ingredients")
        .insert({
          household_id: householdId,
          recipe_id: recipeId,
          product_id: productId ?? null,
          amount: amount ?? null,
          qu_id: quId ?? null,
          note: note ?? null,
          ingredient_group: ingredientGroup ?? null,
          variable_amount: variableAmount ?? null,
          only_check_single_unit_in_stock: onlyCheckSingleUnitInStock ?? false,
          not_check_stock_fulfillment: notCheckStockFulfillment ?? false,
          price_factor: priceFactor ?? 1,
          sort_order: sort,
        })
        .select("id")
        .single();
      if (error) return errorResult(error.message);
      return jsonResult({ success: true, ingredientId: data.id });
    },
  );

  server.registerTool(
    "update_recipe_ingredient",
    {
      title: "Update a recipe ingredient",
      description:
        "Partial update of one ingredient. Pass null for amount or variableAmount to clear it, but at least one of the two must remain set on the row.",
      inputSchema: {
        ingredientId: z.string().uuid(),
        productId: z.string().uuid().nullable().optional(),
        amount: z.number().positive().nullable().optional(),
        quId: z.string().uuid().nullable().optional(),
        note: z.string().nullable().optional(),
        ingredientGroup: z.string().nullable().optional(),
        variableAmount: z.string().nullable().optional(),
        onlyCheckSingleUnitInStock: z.boolean().optional(),
        notCheckStockFulfillment: z.boolean().optional(),
        priceFactor: z.number().positive().optional(),
      },
    },
    async (
      {
        ingredientId,
        productId,
        amount,
        quId,
        note,
        ingredientGroup,
        variableAmount,
        onlyCheckSingleUnitInStock,
        notCheckStockFulfillment,
        priceFactor,
      },
      extra,
    ) => {
      const { supabase, householdId } = getCtx(extra);

      const { data: existing } = await supabase
        .from("recipe_ingredients")
        .select("id, amount, variable_amount")
        .eq("id", ingredientId)
        .eq("household_id", householdId)
        .maybeSingle();
      if (!existing) return errorResult("Ingredient not found in this household");

      if (productId !== undefined && productId !== null) {
        const { data: prod } = await supabase
          .from("products")
          .select("id")
          .eq("id", productId)
          .eq("household_id", householdId)
          .maybeSingle();
        if (!prod) return errorResult("productId not found in this household");
      }

      const patch: Record<string, unknown> = {};
      if (productId !== undefined) patch.product_id = productId;
      if (amount !== undefined) patch.amount = amount;
      if (quId !== undefined) patch.qu_id = quId;
      if (note !== undefined) patch.note = note;
      if (ingredientGroup !== undefined) patch.ingredient_group = ingredientGroup;
      if (variableAmount !== undefined) patch.variable_amount = variableAmount;
      if (onlyCheckSingleUnitInStock !== undefined) patch.only_check_single_unit_in_stock = onlyCheckSingleUnitInStock;
      if (notCheckStockFulfillment !== undefined) patch.not_check_stock_fulfillment = notCheckStockFulfillment;
      if (priceFactor !== undefined) patch.price_factor = priceFactor;
      if (Object.keys(patch).length === 0) return errorResult("No fields to update");

      const finalAmount = "amount" in patch ? (patch.amount as number | null) : existing.amount;
      const finalVariable = "variable_amount" in patch ? (patch.variable_amount as string | null) : existing.variable_amount;
      if (finalAmount == null && (finalVariable == null || finalVariable === "")) {
        return errorResult("Cannot clear both amount and variableAmount — at least one must remain set");
      }

      const { error } = await supabase
        .from("recipe_ingredients")
        .update(patch)
        .eq("id", ingredientId);
      if (error) return errorResult(error.message);
      return jsonResult({ success: true, ingredientId, updated: Object.keys(patch) });
    },
  );

  server.registerTool(
    "remove_recipe_ingredient",
    {
      title: "Remove an ingredient from a recipe",
      description: "Delete a single ingredient row.",
      inputSchema: { ingredientId: z.string().uuid() },
    },
    async ({ ingredientId }, extra) => {
      const { supabase, householdId } = getCtx(extra);

      const { data: existing } = await supabase
        .from("recipe_ingredients")
        .select("id")
        .eq("id", ingredientId)
        .eq("household_id", householdId)
        .maybeSingle();
      if (!existing) return errorResult("Ingredient not found in this household");

      const { error } = await supabase
        .from("recipe_ingredients")
        .delete()
        .eq("id", ingredientId);
      if (error) return errorResult(error.message);
      return jsonResult({ success: true, ingredientId });
    },
  );

  server.registerTool(
    "reorder_recipe_ingredients",
    {
      title: "Reorder ingredients within a recipe",
      description:
        "Reassign sort_order to match the supplied id list (sort_order = array index). All ids must belong to the given recipe.",
      inputSchema: {
        recipeId: z.string().uuid(),
        ingredientIds: z.array(z.string().uuid()).min(1),
      },
    },
    async ({ recipeId, ingredientIds }, extra) => {
      const { supabase, householdId } = getCtx(extra);

      const { data: rows } = await supabase
        .from("recipe_ingredients")
        .select("id")
        .eq("household_id", householdId)
        .eq("recipe_id", recipeId);
      const owned = new Set((rows ?? []).map((r: { id: string }) => r.id));
      for (const id of ingredientIds) {
        if (!owned.has(id)) return errorResult(`Ingredient ${id} does not belong to recipe ${recipeId}`);
      }

      for (let i = 0; i < ingredientIds.length; i++) {
        const { error } = await supabase
          .from("recipe_ingredients")
          .update({ sort_order: i })
          .eq("id", ingredientIds[i]);
        if (error) return errorResult(error.message);
      }
      return jsonResult({ success: true, count: ingredientIds.length });
    },
  );

  server.registerTool(
    "add_recipe_nesting",
    {
      title: "Nest a recipe as an ingredient of another recipe",
      description:
        "Link `includesRecipeId` as a sub-recipe of `recipeId` at the given servings. Cycles are rejected (if includesRecipeId already transitively includes recipeId, the call fails).",
      inputSchema: {
        recipeId: z.string().uuid(),
        includesRecipeId: z.string().uuid(),
        servings: z.number().positive(),
      },
    },
    async ({ recipeId, includesRecipeId, servings }, extra) => {
      const { supabase, householdId } = getCtx(extra);

      if (recipeId === includesRecipeId) return errorResult("A recipe cannot nest itself");

      const { data: rows } = await supabase
        .from("recipes")
        .select("id")
        .eq("household_id", householdId)
        .in("id", [recipeId, includesRecipeId]);
      const ids = new Set((rows ?? []).map((r: { id: string }) => r.id));
      if (!ids.has(recipeId)) return errorResult("recipeId not found in this household");
      if (!ids.has(includesRecipeId)) return errorResult("includesRecipeId not found in this household");

      // Cycle detection: ensure recipeId is NOT reachable from includesRecipeId via existing nestings.
      const { data: allNestings } = await supabase
        .from("recipe_nestings")
        .select("recipe_id, includes_recipe_id")
        .eq("household_id", householdId);
      const adj = new Map<string, string[]>();
      for (const n of (allNestings ?? []) as Array<{ recipe_id: string; includes_recipe_id: string }>) {
        const list = adj.get(n.recipe_id) ?? [];
        list.push(n.includes_recipe_id);
        adj.set(n.recipe_id, list);
      }
      const visited = new Set<string>();
      const stack = [includesRecipeId];
      while (stack.length > 0) {
        const cur = stack.pop() as string;
        if (cur === recipeId) return errorResult("Cycle detected: includesRecipeId already transitively contains recipeId");
        if (visited.has(cur)) continue;
        visited.add(cur);
        for (const next of adj.get(cur) ?? []) stack.push(next);
      }

      const { data, error } = await supabase
        .from("recipe_nestings")
        .insert({
          household_id: householdId,
          recipe_id: recipeId,
          includes_recipe_id: includesRecipeId,
          servings,
        })
        .select("id")
        .single();
      if (error) return errorResult(error.message);
      return jsonResult({ success: true, nestingId: data.id });
    },
  );

  server.registerTool(
    "update_recipe_nesting",
    {
      title: "Update a recipe nesting",
      description: "Change the servings for a sub-recipe nesting.",
      inputSchema: {
        nestingId: z.string().uuid(),
        servings: z.number().positive(),
      },
    },
    async ({ nestingId, servings }, extra) => {
      const { supabase, householdId } = getCtx(extra);

      const { data: existing } = await supabase
        .from("recipe_nestings")
        .select("id")
        .eq("id", nestingId)
        .eq("household_id", householdId)
        .maybeSingle();
      if (!existing) return errorResult("Nesting not found in this household");

      const { error } = await supabase
        .from("recipe_nestings")
        .update({ servings })
        .eq("id", nestingId);
      if (error) return errorResult(error.message);
      return jsonResult({ success: true, nestingId });
    },
  );

  server.registerTool(
    "remove_recipe_nesting",
    {
      title: "Remove a recipe nesting",
      description: "Unlink a sub-recipe from its parent.",
      inputSchema: { nestingId: z.string().uuid() },
    },
    async ({ nestingId }, extra) => {
      const { supabase, householdId } = getCtx(extra);

      const { data: existing } = await supabase
        .from("recipe_nestings")
        .select("id")
        .eq("id", nestingId)
        .eq("household_id", householdId)
        .maybeSingle();
      if (!existing) return errorResult("Nesting not found in this household");

      const { error } = await supabase
        .from("recipe_nestings")
        .delete()
        .eq("id", nestingId);
      if (error) return errorResult(error.message);
      return jsonResult({ success: true, nestingId });
    },
  );

  // ===== Meal plan =====

  server.registerTool(
    "get_meal_plan",
    {
      title: "Get meal plan entries for a date range",
      description:
        "List all meal_plan rows for this household between weekStart and weekEnd (inclusive, ISO YYYY-MM-DD). Joins recipe name, product name, unit name, and section name for display. Use this before planning a week to see what's already there.",
      inputSchema: {
        weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        weekEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      },
    },
    async ({ weekStart, weekEnd }, extra) => {
      const { supabase, householdId } = getCtx(extra);
      const { data, error } = await supabase
        .from("meal_plan")
        .select(
          "id, day, type, recipe_id, recipe_servings, product_id, product_amount, product_qu_id, note, section_id, sort_order, recipe:recipes(name), product:products(name), qu:quantity_units(name, name_plural), section:meal_plan_sections(name, time)",
        )
        .eq("household_id", householdId)
        .gte("day", weekStart)
        .lte("day", weekEnd)
        .order("day")
        .order("sort_order");
      if (error) return errorResult(error.message);
      return jsonResult({ entries: data ?? [] });
    },
  );

  server.registerTool(
    "plan_meal",
    {
      title: "Add a meal plan entry",
      description:
        "Schedule a recipe / product / free-text note onto a specific day. Exactly one of recipeId, productId, or note must be set; the matching type-specific fields go alongside (recipeServings for recipes; productAmount/productQuId for products). Auto-assigns sort_order at the end of the day×section slot.",
      inputSchema: {
        day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        type: z.enum(["recipe", "product", "note"]),
        sectionId: z.string().uuid().nullable().optional(),
        recipeId: z.string().uuid().nullable().optional(),
        recipeServings: z.number().positive().nullable().optional(),
        productId: z.string().uuid().nullable().optional(),
        productAmount: z.number().positive().nullable().optional(),
        productQuId: z.string().uuid().nullable().optional(),
        note: z.string().nullable().optional(),
      },
    },
    async (
      { day, type, sectionId, recipeId, recipeServings, productId, productAmount, productQuId, note },
      extra,
    ) => {
      const { supabase, householdId } = getCtx(extra);

      if (type === "recipe") {
        if (!recipeId) return errorResult("recipeId is required when type='recipe'");
        const { data: r } = await supabase
          .from("recipes")
          .select("id")
          .eq("id", recipeId)
          .eq("household_id", householdId)
          .maybeSingle();
        if (!r) return errorResult("recipeId not found in this household");
      } else if (type === "product") {
        if (!productId) return errorResult("productId is required when type='product'");
        const { data: p } = await supabase
          .from("products")
          .select("id")
          .eq("id", productId)
          .eq("household_id", householdId)
          .maybeSingle();
        if (!p) return errorResult("productId not found in this household");
      } else {
        if (!note) return errorResult("note is required when type='note'");
      }

      if (sectionId) {
        const { data: s } = await supabase
          .from("meal_plan_sections")
          .select("id")
          .eq("id", sectionId)
          .eq("household_id", householdId)
          .maybeSingle();
        if (!s) return errorResult("sectionId not found in this household");
      }

      const { data: maxRow } = await supabase
        .from("meal_plan")
        .select("sort_order")
        .eq("household_id", householdId)
        .eq("day", day)
        .eq("section_id", sectionId ?? null)
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();
      const sort = (maxRow?.sort_order ?? -1) + 1;

      const { data, error } = await supabase
        .from("meal_plan")
        .insert({
          household_id: householdId,
          day,
          type,
          recipe_id: type === "recipe" ? recipeId : null,
          recipe_servings: type === "recipe" ? recipeServings ?? null : null,
          product_id: type === "product" ? productId : null,
          product_amount: type === "product" ? productAmount ?? null : null,
          product_qu_id: type === "product" ? productQuId ?? null : null,
          note: type === "note" ? note : null,
          section_id: sectionId ?? null,
          sort_order: sort,
        })
        .select("id")
        .single();
      if (error) return errorResult(error.message);
      return jsonResult({ success: true, entryId: data.id });
    },
  );

  server.registerTool(
    "update_planned_meal",
    {
      title: "Update a meal plan entry",
      description:
        "Partial update of a single meal_plan row. Use to move an entry to a different day/section, change servings, or rewrite a note. The entry's `type` is immutable — to switch from recipe→product etc., delete and re-create.",
      inputSchema: {
        entryId: z.string().uuid(),
        day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        sectionId: z.string().uuid().nullable().optional(),
        recipeServings: z.number().positive().nullable().optional(),
        productAmount: z.number().positive().nullable().optional(),
        productQuId: z.string().uuid().nullable().optional(),
        note: z.string().nullable().optional(),
        sortOrder: z.number().int().min(0).optional(),
      },
    },
    async (
      { entryId, day, sectionId, recipeServings, productAmount, productQuId, note, sortOrder },
      extra,
    ) => {
      const { supabase, householdId } = getCtx(extra);

      const { data: existing } = await supabase
        .from("meal_plan")
        .select("id, type")
        .eq("id", entryId)
        .eq("household_id", householdId)
        .maybeSingle();
      if (!existing) return errorResult("Meal plan entry not found in this household");

      if (sectionId !== undefined && sectionId !== null) {
        const { data: s } = await supabase
          .from("meal_plan_sections")
          .select("id")
          .eq("id", sectionId)
          .eq("household_id", householdId)
          .maybeSingle();
        if (!s) return errorResult("sectionId not found in this household");
      }

      const patch: Record<string, unknown> = {};
      if (day !== undefined) patch.day = day;
      if (sectionId !== undefined) patch.section_id = sectionId;
      if (sortOrder !== undefined) patch.sort_order = sortOrder;
      if (recipeServings !== undefined && existing.type === "recipe") patch.recipe_servings = recipeServings;
      if (productAmount !== undefined && existing.type === "product") patch.product_amount = productAmount;
      if (productQuId !== undefined && existing.type === "product") patch.product_qu_id = productQuId;
      if (note !== undefined && existing.type === "note") patch.note = note;
      if (Object.keys(patch).length === 0) return errorResult("No fields to update (note: type-specific fields are ignored if they don't match the entry type)");

      const { error } = await supabase
        .from("meal_plan")
        .update(patch)
        .eq("id", entryId);
      if (error) return errorResult(error.message);
      return jsonResult({ success: true, entryId, updated: Object.keys(patch) });
    },
  );

  server.registerTool(
    "unplan_meal",
    {
      title: "Remove a meal plan entry",
      description: "Delete a single meal_plan row.",
      inputSchema: { entryId: z.string().uuid() },
    },
    async ({ entryId }, extra) => {
      const { supabase, householdId } = getCtx(extra);

      const { data: existing } = await supabase
        .from("meal_plan")
        .select("id")
        .eq("id", entryId)
        .eq("household_id", householdId)
        .maybeSingle();
      if (!existing) return errorResult("Meal plan entry not found in this household");

      const { error } = await supabase
        .from("meal_plan")
        .delete()
        .eq("id", entryId);
      if (error) return errorResult(error.message);
      return jsonResult({ success: true, entryId });
    },
  );

  server.registerTool(
    "get_meal_plan_sections",
    {
      title: "List meal plan sections",
      description:
        "Return this household's meal plan sections (e.g. Breakfast / Lunch / Dinner). New households are seeded with these three at 08:00, 12:00, 18:00.",
      inputSchema: {},
    },
    async (_args, extra) => {
      const { supabase, householdId } = getCtx(extra);
      const { data, error } = await supabase
        .from("meal_plan_sections")
        .select("id, name, time, sort_order")
        .eq("household_id", householdId)
        .order("sort_order");
      if (error) return errorResult(error.message);
      return jsonResult({ sections: data ?? [] });
    },
  );

  server.registerTool(
    "add_meal_plan_section",
    {
      title: "Add a meal plan section",
      description:
        "Create a new section (e.g. 'Snack', 'Supper'). Auto-assigns sort_order at the end unless explicitly provided.",
      inputSchema: {
        name: z.string().min(1),
        time: z
          .string()
          .regex(/^\d{2}:\d{2}(:\d{2})?$/)
          .nullable()
          .optional(),
        sortOrder: z.number().int().min(0).optional(),
      },
    },
    async ({ name, time, sortOrder }, extra) => {
      const { supabase, householdId } = getCtx(extra);

      let sort = sortOrder;
      if (sort === undefined) {
        const { data: maxRow } = await supabase
          .from("meal_plan_sections")
          .select("sort_order")
          .eq("household_id", householdId)
          .order("sort_order", { ascending: false })
          .limit(1)
          .maybeSingle();
        sort = (maxRow?.sort_order ?? -1) + 1;
      }

      const { data, error } = await supabase
        .from("meal_plan_sections")
        .insert({
          household_id: householdId,
          name,
          time: time ?? null,
          sort_order: sort,
        })
        .select("id")
        .single();
      if (error) return errorResult(error.message);
      return jsonResult({ success: true, sectionId: data.id });
    },
  );

  server.registerTool(
    "update_meal_plan_section",
    {
      title: "Update a meal plan section",
      description: "Partial update of a section's name, time, or sort_order.",
      inputSchema: {
        sectionId: z.string().uuid(),
        name: z.string().min(1).optional(),
        time: z
          .string()
          .regex(/^\d{2}:\d{2}(:\d{2})?$/)
          .nullable()
          .optional(),
        sortOrder: z.number().int().min(0).optional(),
      },
    },
    async ({ sectionId, name, time, sortOrder }, extra) => {
      const { supabase, householdId } = getCtx(extra);

      const { data: existing } = await supabase
        .from("meal_plan_sections")
        .select("id")
        .eq("id", sectionId)
        .eq("household_id", householdId)
        .maybeSingle();
      if (!existing) return errorResult("Section not found in this household");

      const patch: Record<string, unknown> = {};
      if (name !== undefined) patch.name = name;
      if (time !== undefined) patch.time = time;
      if (sortOrder !== undefined) patch.sort_order = sortOrder;
      if (Object.keys(patch).length === 0) return errorResult("No fields to update");

      const { error } = await supabase
        .from("meal_plan_sections")
        .update(patch)
        .eq("id", sectionId);
      if (error) return errorResult(error.message);
      return jsonResult({ success: true, sectionId, updated: Object.keys(patch) });
    },
  );

  server.registerTool(
    "remove_meal_plan_section",
    {
      title: "Delete a meal plan section",
      description:
        "Delete a section. Existing meal_plan entries that point to it have their section_id set to NULL (kept, just sectionless).",
      inputSchema: {
        sectionId: z.string().uuid(),
        confirm: z.literal(true),
      },
    },
    async ({ sectionId }, extra) => {
      const { supabase, householdId } = getCtx(extra);

      const { data: existing } = await supabase
        .from("meal_plan_sections")
        .select("id")
        .eq("id", sectionId)
        .eq("household_id", householdId)
        .maybeSingle();
      if (!existing) return errorResult("Section not found in this household");

      const { error } = await supabase
        .from("meal_plan_sections")
        .delete()
        .eq("id", sectionId);
      if (error) return errorResult(error.message);
      return jsonResult({ success: true, sectionId });
    },
  );

  server.registerTool(
    "copy_meal_plan_week",
    {
      title: "Copy meal plan week",
      description:
        "Copy every meal_plan entry from a 7-day window starting on fromWeekStart to the 7-day window starting on toWeekStart. Day-of-week offsets within the week are preserved. Sections, sort_order, recipe servings, product amounts, and notes are all copied. Returns the number of entries copied.",
      inputSchema: {
        fromWeekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        toWeekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      },
    },
    async ({ fromWeekStart, toWeekStart }, extra) => {
      const { supabase, householdId } = getCtx(extra);

      const fromStart = new Date(`${fromWeekStart}T00:00:00Z`);
      const toStart = new Date(`${toWeekStart}T00:00:00Z`);
      if (isNaN(fromStart.getTime()) || isNaN(toStart.getTime())) return errorResult("Invalid date");
      const fromEnd = new Date(fromStart);
      fromEnd.setUTCDate(fromEnd.getUTCDate() + 6);
      const fromEndStr = fromEnd.toISOString().split("T")[0];

      const { data: rows, error: readErr } = await supabase
        .from("meal_plan")
        .select("day, type, recipe_id, recipe_servings, product_id, product_amount, product_qu_id, note, section_id, sort_order")
        .eq("household_id", householdId)
        .gte("day", fromWeekStart)
        .lte("day", fromEndStr);
      if (readErr) return errorResult(readErr.message);
      if (!rows || rows.length === 0) return jsonResult({ success: true, count: 0 });

      const diffDays = Math.round((toStart.getTime() - fromStart.getTime()) / 86400000);
      const inserts = (rows as Array<{
        day: string;
        type: string;
        recipe_id: string | null;
        recipe_servings: number | null;
        product_id: string | null;
        product_amount: number | null;
        product_qu_id: string | null;
        note: string | null;
        section_id: string | null;
        sort_order: number;
      }>).map((r) => {
        const srcDay = new Date(`${r.day}T00:00:00Z`);
        srcDay.setUTCDate(srcDay.getUTCDate() + diffDays);
        return {
          household_id: householdId,
          day: srcDay.toISOString().split("T")[0],
          type: r.type,
          recipe_id: r.recipe_id,
          recipe_servings: r.recipe_servings,
          product_id: r.product_id,
          product_amount: r.product_amount,
          product_qu_id: r.product_qu_id,
          note: r.note,
          section_id: r.section_id,
          sort_order: r.sort_order,
        };
      });

      const { error: insErr } = await supabase.from("meal_plan").insert(inserts);
      if (insErr) return errorResult(insErr.message);
      return jsonResult({ success: true, count: inserts.length });
    },
  );

  // ===== Stock journal (transaction history + undo) =====

  server.registerTool(
    "list_journal",
    {
      title: "List stock journal entries",
      description:
        "Browse the stock transaction history (stock_log). Supports filtering by product, transaction type, and date range, with pagination. By default excludes the internal 'transfer-to' / 'stock-edit-old' / 'stock-edit-new' bookkeeping rows (matching the app's Journal view) and hides already-undone rows. Joins product and location names.",
      inputSchema: {
        productId: z.string().uuid().optional(),
        transactionType: z
          .enum([
            "purchase",
            "consume",
            "spoiled",
            "inventory-correction",
            "product-opened",
            "transfer-from",
            "transfer-to",
            "stock-edit-old",
            "stock-edit-new",
          ])
          .optional(),
        dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        includeUndone: z.boolean().optional(),
        includeBookkeeping: z.boolean().optional(),
        limit: z.number().int().positive().max(200).optional(),
        offset: z.number().int().min(0).optional(),
      },
    },
    async (
      { productId, transactionType, dateFrom, dateTo, includeUndone, includeBookkeeping, limit, offset },
      extra,
    ) => {
      const { supabase, householdId } = getCtx(extra);
      const lim = limit ?? 25;
      const off = offset ?? 0;

      let q = supabase
        .from("stock_log")
        .select(
          "id, created_at, transaction_type, amount, price, best_before_date, used_date, opened_date, location_id, undone, correlation_id, transaction_id, product_id, note, product:products(name), location:locations(name)",
          { count: "exact" },
        )
        .eq("household_id", householdId);

      if (productId) q = q.eq("product_id", productId);
      if (transactionType) q = q.eq("transaction_type", transactionType);
      else if (!includeBookkeeping) q = q.not("transaction_type", "in", "(transfer-to,stock-edit-old,stock-edit-new)");
      if (!includeUndone) q = q.eq("undone", false);
      if (dateFrom) q = q.gte("created_at", `${dateFrom}T00:00:00Z`);
      if (dateTo) q = q.lte("created_at", `${dateTo}T23:59:59Z`);

      const { data, error, count } = await q
        .order("created_at", { ascending: false })
        .range(off, off + lim - 1);
      if (error) return errorResult(error.message);
      return jsonResult({ entries: data ?? [], total: count ?? null, limit: lim, offset: off });
    },
  );

  server.registerTool(
    "get_journal_entry",
    {
      title: "Get a single journal entry",
      description: "Fetch one stock_log row by id with product and location names.",
      inputSchema: { id: z.string().uuid() },
    },
    async ({ id }, extra) => {
      const { supabase, householdId } = getCtx(extra);
      const { data, error } = await supabase
        .from("stock_log")
        .select("*, product:products(name), location:locations(name)")
        .eq("id", id)
        .eq("household_id", householdId)
        .maybeSingle();
      if (error) return errorResult(error.message);
      if (!data) return errorResult("Journal entry not found in this household");
      return jsonResult({ entry: data });
    },
  );

  server.registerTool(
    "list_journal_for_product",
    {
      title: "List journal entries for a product",
      description:
        "All stock transactions for a single product, newest first. Useful for 'what's the history of X'. Hides undone rows by default.",
      inputSchema: {
        productId: z.string().uuid(),
        includeUndone: z.boolean().optional(),
        limit: z.number().int().positive().max(200).optional(),
      },
    },
    async ({ productId, includeUndone, limit }, extra) => {
      const { supabase, householdId } = getCtx(extra);

      const { data: prod } = await supabase
        .from("products")
        .select("id, name")
        .eq("id", productId)
        .eq("household_id", householdId)
        .maybeSingle();
      if (!prod) return errorResult("productId not found in this household");

      let q = supabase
        .from("stock_log")
        .select("id, created_at, transaction_type, amount, price, best_before_date, location_id, undone, correlation_id, note")
        .eq("household_id", householdId)
        .eq("product_id", productId);
      if (!includeUndone) q = q.eq("undone", false);

      const { data, error } = await q
        .order("created_at", { ascending: false })
        .limit(limit ?? 50);
      if (error) return errorResult(error.message);
      return jsonResult({ product: prod, entries: data ?? [] });
    },
  );

  server.registerTool(
    "get_transaction_summary",
    {
      title: "Get all rows in a transaction group",
      description:
        "Fetch every stock_log row sharing a correlation_id — i.e. the full multi-row transaction (e.g. a recipe cook touching several ingredients, or a transfer's from+to pair). Use before undo_journal_entry to see exactly what will be reversed.",
      inputSchema: { correlationId: z.string().uuid() },
    },
    async ({ correlationId }, extra) => {
      const { supabase, householdId } = getCtx(extra);
      const { data, error } = await supabase
        .from("stock_log")
        .select("id, created_at, transaction_type, amount, undone, product_id, product:products(name)")
        .eq("household_id", householdId)
        .eq("correlation_id", correlationId)
        .order("created_at");
      if (error) return errorResult(error.message);
      if (!data || data.length === 0) return errorResult("No transactions found for that correlationId in this household");
      const anyUndone = data.some((r: { undone: boolean }) => r.undone);
      return jsonResult({ rows: data, count: data.length, undone: anyUndone });
    },
  );

  server.registerTool(
    "undo_journal_entry",
    {
      title: "Undo a journal transaction",
      description:
        "Reverse a transaction by correlation_id, mirroring the in-app undo. Undoable types: consume, spoiled, product-opened, transfer-from, inventory-correction, purchase. Pass the transactionType from the journal row. Requires confirm: true. Re-running on an already-undone transaction is a no-op error.",
      inputSchema: {
        correlationId: z.string().uuid(),
        transactionType: z.enum([
          "consume",
          "spoiled",
          "product-opened",
          "transfer-from",
          "inventory-correction",
          "purchase",
        ]),
        confirm: z.literal(true),
      },
    },
    async ({ correlationId, transactionType }, extra) => {
      const { supabase, householdId } = getCtx(extra);
      const result = await undoTransactionMcp(supabase, householdId, correlationId, transactionType);
      if (!result.success) return errorResult(result.error);
      return jsonResult({ success: true, correlationId, transactionType });
    },
  );

  // ===== Products (CRUD + barcodes + unit conversions) =====

  const productWritableFields = {
    name: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
    active: z.boolean().optional(),
    brand: z.string().nullable().optional(),
    isStoreBrand: z.boolean().optional(),
    locationId: z.string().uuid().nullable().optional(),
    defaultConsumeLocationId: z.string().uuid().nullable().optional(),
    shoppingLocationId: z.string().uuid().nullable().optional(),
    moveOnOpen: z.boolean().optional(),
    productGroupId: z.string().uuid().nullable().optional(),
    quIdStock: z.string().uuid().nullable().optional(),
    quIdPurchase: z.string().uuid().nullable().optional(),
    minStockAmount: z.number().min(0).optional(),
    quickConsumeAmount: z.number().positive().optional(),
    quickOpenAmount: z.number().positive().optional(),
    treatOpenedAsOutOfStock: z.boolean().optional(),
    dueType: z.union([z.literal(1), z.literal(2)]).optional(),
    defaultDueDays: z.number().int().optional(),
    defaultDueDaysAfterOpen: z.number().int().optional(),
    defaultDueDaysAfterFreezing: z.number().int().optional(),
    defaultDueDaysAfterThawing: z.number().int().optional(),
    shouldNotBeFrozen: z.boolean().optional(),
    calories: z.number().int().nullable().optional(),
    parentProductId: z.string().uuid().nullable().optional(),
    noOwnStock: z.boolean().optional(),
    hideOnStockOverview: z.boolean().optional(),
  };

  // Maps camelCase tool inputs → snake_case columns. Only defined keys are copied.
  type ProductInput = {
    name?: string;
    description?: string | null;
    active?: boolean;
    brand?: string | null;
    isStoreBrand?: boolean;
    locationId?: string | null;
    defaultConsumeLocationId?: string | null;
    shoppingLocationId?: string | null;
    moveOnOpen?: boolean;
    productGroupId?: string | null;
    quIdStock?: string | null;
    quIdPurchase?: string | null;
    minStockAmount?: number;
    quickConsumeAmount?: number;
    quickOpenAmount?: number;
    treatOpenedAsOutOfStock?: boolean;
    dueType?: 1 | 2;
    defaultDueDays?: number;
    defaultDueDaysAfterOpen?: number;
    defaultDueDaysAfterFreezing?: number;
    defaultDueDaysAfterThawing?: number;
    shouldNotBeFrozen?: boolean;
    calories?: number | null;
    parentProductId?: string | null;
    noOwnStock?: boolean;
    hideOnStockOverview?: boolean;
  };

  function buildProductPatch(input: ProductInput): Record<string, unknown> {
    const map: Array<[keyof ProductInput, string]> = [
      ["name", "name"],
      ["description", "description"],
      ["active", "active"],
      ["brand", "brand"],
      ["isStoreBrand", "is_store_brand"],
      ["locationId", "location_id"],
      ["defaultConsumeLocationId", "default_consume_location_id"],
      ["shoppingLocationId", "shopping_location_id"],
      ["moveOnOpen", "move_on_open"],
      ["productGroupId", "product_group_id"],
      ["quIdStock", "qu_id_stock"],
      ["quIdPurchase", "qu_id_purchase"],
      ["minStockAmount", "min_stock_amount"],
      ["quickConsumeAmount", "quick_consume_amount"],
      ["quickOpenAmount", "quick_open_amount"],
      ["treatOpenedAsOutOfStock", "treat_opened_as_out_of_stock"],
      ["dueType", "due_type"],
      ["defaultDueDays", "default_due_days"],
      ["defaultDueDaysAfterOpen", "default_due_days_after_open"],
      ["defaultDueDaysAfterFreezing", "default_due_days_after_freezing"],
      ["defaultDueDaysAfterThawing", "default_due_days_after_thawing"],
      ["shouldNotBeFrozen", "should_not_be_frozen"],
      ["calories", "calories"],
      ["parentProductId", "parent_product_id"],
      ["noOwnStock", "no_own_stock"],
      ["hideOnStockOverview", "hide_on_stock_overview"],
    ];
    const patch: Record<string, unknown> = {};
    for (const [inKey, col] of map) {
      if (input[inKey] !== undefined) patch[col] = input[inKey];
    }
    return patch;
  }

  async function checkProductFks(
    supabase: ReturnType<typeof createServiceClient>,
    householdId: string,
    input: ProductInput,
  ): Promise<string | null> {
    return assertOwned(supabase, householdId, [
      { table: "locations", id: input.locationId, label: "locationId" },
      { table: "locations", id: input.defaultConsumeLocationId, label: "defaultConsumeLocationId" },
      { table: "shopping_locations", id: input.shoppingLocationId, label: "shoppingLocationId" },
      { table: "product_groups", id: input.productGroupId, label: "productGroupId" },
      { table: "quantity_units", id: input.quIdStock, label: "quIdStock" },
      { table: "quantity_units", id: input.quIdPurchase, label: "quIdPurchase" },
      { table: "products", id: input.parentProductId, label: "parentProductId" },
    ]);
  }

  server.registerTool(
    "create_product",
    {
      title: "Create a product",
      description:
        "Create a new product (master data). Only name is required; everything else falls back to schema defaults. FK fields (locations, units, group, parent) are validated to belong to this household. Returns the new productId.",
      inputSchema: { ...productWritableFields, name: z.string().min(1) },
    },
    async (input, extra) => {
      const { supabase, householdId } = getCtx(extra);
      const fkErr = await checkProductFks(supabase, householdId, input as ProductInput);
      if (fkErr) return errorResult(fkErr);

      const patch = buildProductPatch(input as ProductInput);
      const { data, error } = await supabase
        .from("products")
        .insert({ household_id: householdId, ...patch })
        .select("id")
        .single();
      if (error) return errorResult(error.message);
      return jsonResult({ success: true, productId: data.id });
    },
  );

  server.registerTool(
    "update_product",
    {
      title: "Update a product",
      description:
        "Partial update of a product's master-data fields. Use deactivate_product to soft-delete; this tool can also set active:true/false directly. FK fields are validated to belong to this household.",
      inputSchema: { productId: z.string().uuid(), ...productWritableFields },
    },
    async (input, extra) => {
      const { supabase, householdId } = getCtx(extra);
      const { productId, ...rest } = input as ProductInput & { productId: string };

      const { data: existing } = await supabase
        .from("products")
        .select("id")
        .eq("id", productId)
        .eq("household_id", householdId)
        .maybeSingle();
      if (!existing) return errorResult("Product not found in this household");

      const fkErr = await checkProductFks(supabase, householdId, rest);
      if (fkErr) return errorResult(fkErr);

      const patch = buildProductPatch(rest);
      if (Object.keys(patch).length === 0) return errorResult("No fields to update");

      const { error } = await supabase.from("products").update(patch).eq("id", productId);
      if (error) return errorResult(error.message);
      return jsonResult({ success: true, productId, updated: Object.keys(patch) });
    },
  );

  server.registerTool(
    "deactivate_product",
    {
      title: "Deactivate a product (soft delete)",
      description:
        "Set active=false. The product disappears from active product lists but its stock entries and history are preserved. Reversible via update_product(active:true). Prefer this over delete_product.",
      inputSchema: { productId: z.string().uuid() },
    },
    async ({ productId }, extra) => {
      const { supabase, householdId } = getCtx(extra);
      const { data: existing } = await supabase
        .from("products")
        .select("id")
        .eq("id", productId)
        .eq("household_id", householdId)
        .maybeSingle();
      if (!existing) return errorResult("Product not found in this household");

      const { error } = await supabase.from("products").update({ active: false }).eq("id", productId);
      if (error) return errorResult(error.message);
      return jsonResult({ success: true, productId, active: false });
    },
  );

  server.registerTool(
    "delete_product",
    {
      title: "Delete a product (hard delete)",
      description:
        "Permanently delete a product. Stock entries' product_id is set to NULL (they become orphans, surfaced by find_data_issues), and barcodes / conversions / recipe-ingredient links cascade or null per their FKs. Prefer deactivate_product unless you really mean to erase it. Requires confirm: true.",
      inputSchema: { productId: z.string().uuid(), confirm: z.literal(true) },
    },
    async ({ productId }, extra) => {
      const { supabase, householdId } = getCtx(extra);
      const { data: existing } = await supabase
        .from("products")
        .select("id")
        .eq("id", productId)
        .eq("household_id", householdId)
        .maybeSingle();
      if (!existing) return errorResult("Product not found in this household");

      const { error } = await supabase.from("products").delete().eq("id", productId);
      if (error) return errorResult(error.message);
      return jsonResult({ success: true, productId, deleted: true });
    },
  );

  server.registerTool(
    "get_product",
    {
      title: "Get a product with related data",
      description:
        "Full product record plus its barcodes, product-specific unit conversions, and nutrition row (if any).",
      inputSchema: { productId: z.string().uuid() },
    },
    async ({ productId }, extra) => {
      const { supabase, householdId } = getCtx(extra);
      const { data: product } = await supabase
        .from("products")
        .select("*")
        .eq("id", productId)
        .eq("household_id", householdId)
        .maybeSingle();
      if (!product) return errorResult("Product not found in this household");

      const [barcodes, conversions, nutrition] = await Promise.all([
        supabase.from("product_barcodes").select("*").eq("household_id", householdId).eq("product_id", productId),
        supabase.from("quantity_unit_conversions").select("*").eq("household_id", householdId).eq("product_id", productId),
        supabase.from("product_nutrition").select("*").eq("household_id", householdId).eq("product_id", productId).maybeSingle(),
      ]);
      return jsonResult({
        product,
        barcodes: barcodes.data ?? [],
        conversions: conversions.data ?? [],
        nutrition: nutrition.data ?? null,
      });
    },
  );

  server.registerTool(
    "list_products",
    {
      title: "List products",
      description:
        "List master-data products with optional filters. Returns id, name, brand, active, group/location ids, and stock unit. For current stock levels use list_inventory instead.",
      inputSchema: {
        search: z.string().optional(),
        activeOnly: z.boolean().optional(),
        productGroupId: z.string().uuid().optional(),
        locationId: z.string().uuid().optional(),
        limit: z.number().int().positive().max(200).optional(),
      },
    },
    async ({ search, activeOnly, productGroupId, locationId, limit }, extra) => {
      const { supabase, householdId } = getCtx(extra);
      let q = supabase
        .from("products")
        .select("id, name, brand, active, product_group_id, location_id, qu_id_stock")
        .eq("household_id", householdId);
      if (activeOnly !== false) q = q.eq("active", true);
      if (productGroupId) q = q.eq("product_group_id", productGroupId);
      if (locationId) q = q.eq("location_id", locationId);
      if (search) q = q.ilike("name", `%${search}%`);

      const { data, error } = await q.order("name").limit(limit ?? 100);
      if (error) return errorResult(error.message);
      return jsonResult({ products: data ?? [] });
    },
  );

  server.registerTool(
    "add_barcode",
    {
      title: "Add a barcode to a product",
      description:
        "Attach a barcode to a product, optionally with the purchase unit, pack amount, store, and last price. FK fields are validated to belong to this household.",
      inputSchema: {
        productId: z.string().uuid(),
        barcode: z.string().min(1),
        quId: z.string().uuid().nullable().optional(),
        amount: z.number().positive().nullable().optional(),
        shoppingLocationId: z.string().uuid().nullable().optional(),
        lastPrice: z.number().min(0).nullable().optional(),
        note: z.string().nullable().optional(),
      },
    },
    async ({ productId, barcode, quId, amount, shoppingLocationId, lastPrice, note }, extra) => {
      const { supabase, householdId } = getCtx(extra);
      const fkErr = await assertOwned(supabase, householdId, [
        { table: "products", id: productId, label: "productId" },
        { table: "quantity_units", id: quId, label: "quId" },
        { table: "shopping_locations", id: shoppingLocationId, label: "shoppingLocationId" },
      ]);
      if (fkErr) return errorResult(fkErr);

      const { data, error } = await supabase
        .from("product_barcodes")
        .insert({
          household_id: householdId,
          product_id: productId,
          barcode,
          qu_id: quId ?? null,
          amount: amount ?? null,
          shopping_location_id: shoppingLocationId ?? null,
          last_price: lastPrice ?? null,
          note: note ?? null,
        })
        .select("id")
        .single();
      if (error) return errorResult(error.message);
      return jsonResult({ success: true, barcodeId: data.id });
    },
  );

  server.registerTool(
    "remove_barcode",
    {
      title: "Remove a barcode",
      description: "Delete a product_barcodes row by id.",
      inputSchema: { barcodeId: z.string().uuid() },
    },
    async ({ barcodeId }, extra) => {
      const { supabase, householdId } = getCtx(extra);
      const { data: existing } = await supabase
        .from("product_barcodes")
        .select("id")
        .eq("id", barcodeId)
        .eq("household_id", householdId)
        .maybeSingle();
      if (!existing) return errorResult("Barcode not found in this household");

      const { error } = await supabase.from("product_barcodes").delete().eq("id", barcodeId);
      if (error) return errorResult(error.message);
      return jsonResult({ success: true, barcodeId });
    },
  );

  server.registerTool(
    "add_unit_conversion",
    {
      title: "Add a quantity-unit conversion",
      description:
        "Define a conversion factor from one unit to another: 1 fromQu = factor × toQu. Set productId for a product-specific conversion, or omit/null for a household-global one. FK fields are validated to belong to this household.",
      inputSchema: {
        fromQuId: z.string().uuid(),
        toQuId: z.string().uuid(),
        factor: z.number().positive(),
        productId: z.string().uuid().nullable().optional(),
      },
    },
    async ({ fromQuId, toQuId, factor, productId }, extra) => {
      const { supabase, householdId } = getCtx(extra);
      if (fromQuId === toQuId) return errorResult("fromQuId and toQuId must differ");
      const fkErr = await assertOwned(supabase, householdId, [
        { table: "quantity_units", id: fromQuId, label: "fromQuId" },
        { table: "quantity_units", id: toQuId, label: "toQuId" },
        { table: "products", id: productId, label: "productId" },
      ]);
      if (fkErr) return errorResult(fkErr);

      const { data, error } = await supabase
        .from("quantity_unit_conversions")
        .insert({
          household_id: householdId,
          from_qu_id: fromQuId,
          to_qu_id: toQuId,
          factor,
          product_id: productId ?? null,
        })
        .select("id")
        .single();
      if (error) return errorResult(error.message);
      return jsonResult({ success: true, conversionId: data.id });
    },
  );

  server.registerTool(
    "remove_unit_conversion",
    {
      title: "Remove a quantity-unit conversion",
      description: "Delete a quantity_unit_conversions row by id.",
      inputSchema: { conversionId: z.string().uuid() },
    },
    async ({ conversionId }, extra) => {
      const { supabase, householdId } = getCtx(extra);
      const { data: existing } = await supabase
        .from("quantity_unit_conversions")
        .select("id")
        .eq("id", conversionId)
        .eq("household_id", householdId)
        .maybeSingle();
      if (!existing) return errorResult("Conversion not found in this household");

      const { error } = await supabase.from("quantity_unit_conversions").delete().eq("id", conversionId);
      if (error) return errorResult(error.message);
      return jsonResult({ success: true, conversionId });
    },
  );

  // ===== Master data writes (locations / stores / units / groups) =====
  // Deletes are gated by confirm:true — FK references from products/stock are
  // ON DELETE SET NULL, so deleting an in-use entity silently clears those
  // references rather than erroring.

  const mdBase = {
    name: z.string().min(1),
    description: z.string().nullable().optional(),
    active: z.boolean().optional(),
    sortOrder: z.number().int().min(0).optional(),
  };
  const mdPatchBase = {
    name: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
    active: z.boolean().optional(),
    sortOrder: z.number().int().min(0).optional(),
  };

  // Locations -----------------------------------------------------------
  server.registerTool(
    "create_location",
    {
      title: "Create a storage location",
      description: "Add a storage location (e.g. a shelf or cupboard). is_freezer affects freeze/thaw due-date recalculation when stock moves in or out.",
      inputSchema: { ...mdBase, isFreezer: z.boolean().optional() },
    },
    async ({ name, description, active, sortOrder, isFreezer }, extra) => {
      const { supabase, householdId } = getCtx(extra);
      return mdCreate(supabase, householdId, "locations", "locationId", {
        name,
        description: description ?? null,
        active: active ?? true,
        is_freezer: isFreezer ?? false,
      }, sortOrder);
    },
  );
  server.registerTool(
    "update_location",
    {
      title: "Update a storage location",
      description: "Partial update of a location's name, description, active, sort_order, or is_freezer.",
      inputSchema: { locationId: z.string().uuid(), ...mdPatchBase, isFreezer: z.boolean().optional() },
    },
    async ({ locationId, name, description, active, sortOrder, isFreezer }, extra) => {
      const { supabase, householdId } = getCtx(extra);
      const patch: Record<string, unknown> = {};
      if (name !== undefined) patch.name = name;
      if (description !== undefined) patch.description = description;
      if (active !== undefined) patch.active = active;
      if (sortOrder !== undefined) patch.sort_order = sortOrder;
      if (isFreezer !== undefined) patch.is_freezer = isFreezer;
      return mdUpdate(supabase, householdId, "locations", "Location", locationId, patch);
    },
  );
  server.registerTool(
    "delete_location",
    {
      title: "Delete a storage location",
      description: "Permanently delete a location. Products/stock referencing it have their location set to NULL (ON DELETE SET NULL). Requires confirm: true.",
      inputSchema: { locationId: z.string().uuid(), confirm: z.literal(true) },
    },
    async ({ locationId }, extra) => {
      const { supabase, householdId } = getCtx(extra);
      return mdDelete(supabase, householdId, "locations", "Location", locationId);
    },
  );

  // Shopping locations --------------------------------------------------
  server.registerTool(
    "create_shopping_location",
    {
      title: "Create a store",
      description: "Add a shopping location / store (e.g. Tesco, Aldi).",
      inputSchema: { ...mdBase },
    },
    async ({ name, description, active, sortOrder }, extra) => {
      const { supabase, householdId } = getCtx(extra);
      return mdCreate(supabase, householdId, "shopping_locations", "shoppingLocationId", {
        name,
        description: description ?? null,
        active: active ?? true,
      }, sortOrder);
    },
  );
  server.registerTool(
    "update_shopping_location",
    {
      title: "Update a store",
      description: "Partial update of a store's name, description, active, or sort_order.",
      inputSchema: { shoppingLocationId: z.string().uuid(), ...mdPatchBase },
    },
    async ({ shoppingLocationId, name, description, active, sortOrder }, extra) => {
      const { supabase, householdId } = getCtx(extra);
      const patch: Record<string, unknown> = {};
      if (name !== undefined) patch.name = name;
      if (description !== undefined) patch.description = description;
      if (active !== undefined) patch.active = active;
      if (sortOrder !== undefined) patch.sort_order = sortOrder;
      return mdUpdate(supabase, householdId, "shopping_locations", "Store", shoppingLocationId, patch);
    },
  );
  server.registerTool(
    "delete_shopping_location",
    {
      title: "Delete a store",
      description: "Permanently delete a store. References on products/stock/barcodes are set to NULL. Requires confirm: true.",
      inputSchema: { shoppingLocationId: z.string().uuid(), confirm: z.literal(true) },
    },
    async ({ shoppingLocationId }, extra) => {
      const { supabase, householdId } = getCtx(extra);
      return mdDelete(supabase, householdId, "shopping_locations", "Store", shoppingLocationId);
    },
  );

  // Quantity units ------------------------------------------------------
  server.registerTool(
    "create_quantity_unit",
    {
      title: "Create a quantity unit",
      description: "Add a unit of measure (e.g. 'jar', 'slice'). name_plural is used when displaying amounts > 1.",
      inputSchema: { ...mdBase, namePlural: z.string().nullable().optional() },
    },
    async ({ name, description, active, sortOrder, namePlural }, extra) => {
      const { supabase, householdId } = getCtx(extra);
      return mdCreate(supabase, householdId, "quantity_units", "quantityUnitId", {
        name,
        name_plural: namePlural ?? null,
        description: description ?? null,
        active: active ?? true,
      }, sortOrder);
    },
  );
  server.registerTool(
    "update_quantity_unit",
    {
      title: "Update a quantity unit",
      description: "Partial update of a unit's name, name_plural, description, active, or sort_order.",
      inputSchema: { quantityUnitId: z.string().uuid(), ...mdPatchBase, namePlural: z.string().nullable().optional() },
    },
    async ({ quantityUnitId, name, description, active, sortOrder, namePlural }, extra) => {
      const { supabase, householdId } = getCtx(extra);
      const patch: Record<string, unknown> = {};
      if (name !== undefined) patch.name = name;
      if (namePlural !== undefined) patch.name_plural = namePlural;
      if (description !== undefined) patch.description = description;
      if (active !== undefined) patch.active = active;
      if (sortOrder !== undefined) patch.sort_order = sortOrder;
      return mdUpdate(supabase, householdId, "quantity_units", "Quantity unit", quantityUnitId, patch);
    },
  );
  server.registerTool(
    "delete_quantity_unit",
    {
      title: "Delete a quantity unit",
      description: "Permanently delete a unit. Product/stock references are set to NULL; conversions using it cascade-delete. Requires confirm: true.",
      inputSchema: { quantityUnitId: z.string().uuid(), confirm: z.literal(true) },
    },
    async ({ quantityUnitId }, extra) => {
      const { supabase, householdId } = getCtx(extra);
      return mdDelete(supabase, householdId, "quantity_units", "Quantity unit", quantityUnitId);
    },
  );

  // Product groups ------------------------------------------------------
  server.registerTool(
    "create_product_group",
    {
      title: "Create a product group",
      description: "Add a product category (e.g. 'Dairy', 'Spices').",
      inputSchema: { ...mdBase },
    },
    async ({ name, description, active, sortOrder }, extra) => {
      const { supabase, householdId } = getCtx(extra);
      return mdCreate(supabase, householdId, "product_groups", "productGroupId", {
        name,
        description: description ?? null,
        active: active ?? true,
      }, sortOrder);
    },
  );
  server.registerTool(
    "update_product_group",
    {
      title: "Update a product group",
      description: "Partial update of a group's name, description, active, or sort_order.",
      inputSchema: { productGroupId: z.string().uuid(), ...mdPatchBase },
    },
    async ({ productGroupId, name, description, active, sortOrder }, extra) => {
      const { supabase, householdId } = getCtx(extra);
      const patch: Record<string, unknown> = {};
      if (name !== undefined) patch.name = name;
      if (description !== undefined) patch.description = description;
      if (active !== undefined) patch.active = active;
      if (sortOrder !== undefined) patch.sort_order = sortOrder;
      return mdUpdate(supabase, householdId, "product_groups", "Product group", productGroupId, patch);
    },
  );
  server.registerTool(
    "delete_product_group",
    {
      title: "Delete a product group",
      description: "Permanently delete a group. Products referencing it have their group set to NULL. Requires confirm: true.",
      inputSchema: { productGroupId: z.string().uuid(), confirm: z.literal(true) },
    },
    async ({ productGroupId }, extra) => {
      const { supabase, householdId } = getCtx(extra);
      return mdDelete(supabase, householdId, "product_groups", "Product group", productGroupId);
    },
  );
}
