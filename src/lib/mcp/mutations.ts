import type { SupabaseClient } from "@supabase/supabase-js";
import { computeConsumePlan, computeOpenPlan } from "@/lib/inventory-utils";
import type { StockEntryWithProduct } from "@/types/database";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supa = SupabaseClient<any, any, any>;

/**
 * Service-role mutation helpers used by MCP tool handlers.
 *
 * **Safety invariant**: service-role bypasses RLS, so every query in this
 * module must filter by `householdId` explicitly. Cross-household writes
 * would be a critical bug.
 *
 * Every mutation writes one or more `stock_log` rows with a shared
 * `correlation_id` so the in-app Journal shows the activity and the existing
 * 8-second undo affordance works for Claude-driven changes too.
 */

type Result<T = Record<string, unknown>> = { success: true; correlationId?: string } & T | { success: false; error: string };

async function fetchStockEntries(
  supabase: Supa,
  householdId: string,
  productId: string,
): Promise<StockEntryWithProduct[]> {
  const { data, error } = await supabase
    .from("stock_entries")
    .select("*, product:products(*), location:locations(*)")
    .eq("household_id", householdId)
    .eq("product_id", productId);
  if (error) throw error;
  return (data ?? []) as StockEntryWithProduct[];
}

export async function consumeStockMcp(
  supabase: Supa,
  householdId: string,
  productId: string,
  amount: number,
  spoiled = false,
): Promise<Result<{ consumed: number }>> {
  try {
    const entries = await fetchStockEntries(supabase, householdId, productId);
    if (entries.length === 0) {
      return { success: false, error: "Product not found in this household" };
    }

    const plan = computeConsumePlan(entries, amount);
    if (plan.items.length === 0) {
      return { success: false, error: "Nothing to consume" };
    }

    const correlationId = crypto.randomUUID();
    const usedDate = new Date().toISOString().split("T")[0];
    const entryMap = new Map(entries.map((e) => [e.id, e]));

    for (const item of plan.items) {
      const entry = entryMap.get(item.entryId)!;

      if (item.deleteEntry) {
        const { error } = await supabase
          .from("stock_entries")
          .delete()
          .eq("id", item.entryId)
          .eq("household_id", householdId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("stock_entries")
          .update({ amount: item.newAmount })
          .eq("id", item.entryId)
          .eq("household_id", householdId);
        if (error) throw error;
      }

      const { error: logError } = await supabase.from("stock_log").insert({
        household_id: householdId,
        product_id: productId,
        amount: item.amountToConsume,
        transaction_type: spoiled ? "spoiled" : "consume",
        best_before_date: entry.best_before_date ?? null,
        purchased_date: entry.purchased_date ?? null,
        used_date: usedDate,
        opened_date: entry.opened_date ?? null,
        price: entry.price ?? null,
        location_id: entry.location_id ?? null,
        shopping_location_id: entry.shopping_location_id ?? null,
        spoiled,
        stock_id: entry.stock_id,
        stock_entry_id: item.deleteEntry ? null : entry.id,
        correlation_id: correlationId,
        transaction_id: crypto.randomUUID(),
        undone: false,
        note: entry.note ?? null,
      });
      if (logError) throw logError;
    }

    return { success: true, consumed: plan.totalConsumed, correlationId };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "consume failed" };
  }
}

export async function openStockMcp(
  supabase: Supa,
  householdId: string,
  productId: string,
  count = 1,
): Promise<Result<{ opened: number }>> {
  try {
    const entries = await fetchStockEntries(supabase, householdId, productId);
    if (entries.length === 0) {
      return { success: false, error: "Product not found in this household" };
    }

    const plan = computeOpenPlan(entries, count);
    if (plan.items.length === 0) {
      return { success: false, error: "Nothing to open (no sealed entries)" };
    }

    const correlationId = crypto.randomUUID();
    const today = new Date().toISOString().split("T")[0];
    const product = entries[0].product;
    const dueDaysAfterOpen = product.default_due_days_after_open ?? 0;
    const moveOnOpen = product.move_on_open && product.default_consume_location_id;
    const entryMap = new Map(entries.map((e) => [e.id, e]));

    for (const item of plan.items) {
      const entry = entryMap.get(item.entryId)!;
      const update: Record<string, unknown> = { open: true, opened_date: today };

      if (dueDaysAfterOpen > 0) {
        const d = new Date();
        d.setDate(d.getDate() + dueDaysAfterOpen);
        const newDueStr = d.toISOString().split("T")[0];
        update.best_before_date = entry.best_before_date
          ? (newDueStr < entry.best_before_date ? newDueStr : entry.best_before_date)
          : newDueStr;
      }
      if (moveOnOpen) {
        update.location_id = product.default_consume_location_id;
      }

      const { error } = await supabase
        .from("stock_entries")
        .update(update)
        .eq("id", item.entryId)
        .eq("household_id", householdId);
      if (error) throw error;

      const { error: logError } = await supabase.from("stock_log").insert({
        household_id: householdId,
        product_id: productId,
        amount: entry.amount,
        transaction_type: "product-opened",
        best_before_date: entry.best_before_date ?? null,
        purchased_date: entry.purchased_date ?? null,
        used_date: today,
        opened_date: today,
        price: entry.price ?? null,
        location_id: entry.location_id ?? null,
        shopping_location_id: entry.shopping_location_id ?? null,
        spoiled: false,
        stock_id: entry.stock_id,
        stock_entry_id: entry.id,
        correlation_id: correlationId,
        transaction_id: crypto.randomUUID(),
        undone: false,
        note: entry.note ?? null,
      });
      if (logError) throw logError;
    }

    return { success: true, opened: plan.totalOpened, correlationId };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "open failed" };
  }
}

export async function transferStockMcp(
  supabase: Supa,
  householdId: string,
  entryId: string,
  destinationLocationId: string,
): Promise<Result<{ warning?: string }>> {
  try {
    const { data: entryRow, error: entryError } = await supabase
      .from("stock_entries")
      .select("*, product:products(*), location:locations(*)")
      .eq("id", entryId)
      .eq("household_id", householdId)
      .maybeSingle();
    if (entryError) throw entryError;
    if (!entryRow) return { success: false, error: "Stock entry not found in this household" };

    const entry = entryRow as StockEntryWithProduct;

    if (entry.location_id === destinationLocationId) {
      return { success: false, error: "Already at that location" };
    }

    const { data: destLoc, error: locErr } = await supabase
      .from("locations")
      .select("id, is_freezer")
      .eq("id", destinationLocationId)
      .eq("household_id", householdId)
      .maybeSingle();
    if (locErr) throw locErr;
    if (!destLoc) return { success: false, error: "Destination location not found in this household" };

    const sourceIsFreezer = entry.location?.is_freezer ?? false;
    const destinationIsFreezer = destLoc.is_freezer;

    const correlationId = crypto.randomUUID();
    const today = new Date().toISOString().split("T")[0];
    const product = entry.product;

    let newBestBeforeDate = entry.best_before_date;
    if (sourceIsFreezer && !destinationIsFreezer && (product.default_due_days_after_thawing ?? 0) > 0) {
      const d = new Date();
      d.setDate(d.getDate() + product.default_due_days_after_thawing);
      newBestBeforeDate = d.toISOString().split("T")[0];
    }

    const update: Record<string, unknown> = { location_id: destinationLocationId };
    if (newBestBeforeDate !== entry.best_before_date) {
      update.best_before_date = newBestBeforeDate;
    }

    const { error: updateError } = await supabase
      .from("stock_entries")
      .update(update)
      .eq("id", entry.id)
      .eq("household_id", householdId);
    if (updateError) throw updateError;

    const sharedLog = {
      household_id: householdId,
      product_id: entry.product_id,
      amount: entry.amount,
      purchased_date: entry.purchased_date ?? null,
      used_date: today,
      opened_date: entry.opened_date ?? null,
      price: entry.price ?? null,
      shopping_location_id: entry.shopping_location_id ?? null,
      spoiled: false,
      stock_id: entry.stock_id,
      stock_entry_id: entry.id,
      correlation_id: correlationId,
      undone: false,
      note: entry.note ?? null,
    };

    await supabase.from("stock_log").insert({
      ...sharedLog,
      transaction_type: "transfer-from",
      location_id: entry.location_id ?? null,
      best_before_date: entry.best_before_date ?? null,
      transaction_id: crypto.randomUUID(),
    });
    await supabase.from("stock_log").insert({
      ...sharedLog,
      transaction_type: "transfer-to",
      location_id: destinationLocationId,
      best_before_date: newBestBeforeDate ?? null,
      transaction_id: crypto.randomUUID(),
    });

    const warning = product.should_not_be_frozen && destinationIsFreezer
      ? "This product should not be frozen"
      : undefined;

    return { success: true, correlationId, ...(warning ? { warning } : {}) };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "transfer failed" };
  }
}

export async function correctStockMcp(
  supabase: Supa,
  householdId: string,
  productId: string,
  newAmount: number,
): Promise<Result<{ delta: number }>> {
  try {
    const entries = await fetchStockEntries(supabase, householdId, productId);
    if (entries.length === 0) {
      return { success: false, error: "Product not found in this household" };
    }

    const currentTotal = entries.reduce((sum, e) => sum + e.amount, 0);
    const delta = newAmount - currentTotal;
    if (delta === 0) return { success: true, delta: 0 };

    const correlationId = crypto.randomUUID();
    const today = new Date().toISOString().split("T")[0];
    const entryMap = new Map(entries.map((e) => [e.id, e]));

    if (delta < 0) {
      const plan = computeConsumePlan(entries, Math.abs(delta));
      if (plan.items.length === 0) return { success: false, error: "Nothing to correct" };

      for (const item of plan.items) {
        const entry = entryMap.get(item.entryId)!;
        if (item.deleteEntry) {
          await supabase
            .from("stock_entries")
            .delete()
            .eq("id", item.entryId)
            .eq("household_id", householdId);
        } else {
          await supabase
            .from("stock_entries")
            .update({ amount: item.newAmount })
            .eq("id", item.entryId)
            .eq("household_id", householdId);
        }
        await supabase.from("stock_log").insert({
          household_id: householdId,
          product_id: productId,
          amount: item.amountToConsume,
          transaction_type: "inventory-correction",
          best_before_date: entry.best_before_date ?? null,
          purchased_date: entry.purchased_date ?? null,
          used_date: today,
          opened_date: entry.opened_date ?? null,
          price: entry.price ?? null,
          location_id: entry.location_id ?? null,
          shopping_location_id: entry.shopping_location_id ?? null,
          spoiled: false,
          stock_id: entry.stock_id,
          stock_entry_id: item.deleteEntry ? null : entry.id,
          correlation_id: correlationId,
          transaction_id: crypto.randomUUID(),
          undone: false,
          note: JSON.stringify({ direction: "decrease" }),
        });
      }
    } else {
      const sorted = [...entries].sort((a, b) =>
        (b.created_at ?? "").localeCompare(a.created_at ?? "")
      );
      const target = sorted[0];
      await supabase
        .from("stock_entries")
        .update({ amount: target.amount + delta })
        .eq("id", target.id)
        .eq("household_id", householdId);

      await supabase.from("stock_log").insert({
        household_id: householdId,
        product_id: productId,
        amount: delta,
        transaction_type: "inventory-correction",
        best_before_date: target.best_before_date ?? null,
        purchased_date: target.purchased_date ?? null,
        used_date: today,
        opened_date: target.opened_date ?? null,
        price: target.price ?? null,
        location_id: target.location_id ?? null,
        shopping_location_id: target.shopping_location_id ?? null,
        spoiled: false,
        stock_id: target.stock_id,
        stock_entry_id: target.id,
        correlation_id: correlationId,
        transaction_id: crypto.randomUUID(),
        undone: false,
        note: JSON.stringify({ direction: "increase" }),
      });
    }

    return { success: true, delta, correlationId };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "correction failed" };
  }
}

export type SimpleStockAddItem = {
  productId: string;
  amount: number;
  bestBeforeDate?: string | null;
  price?: number | null;
  locationId?: string | null;
  shoppingLocationId?: string | null;
  note?: string | null;
};

/**
 * Bulk-add stock entries to existing products. All product IDs must already
 * exist in the caller's household. For receipts containing new products,
 * call the existing /api/inventory/export flow or use bulkCreateProductsAndStock
 * via a separate path — this MCP tool is intentionally constrained to existing
 * products so the LLM can't accidentally create product rows it didn't intend to.
 */
export async function addStockMcp(
  supabase: Supa,
  householdId: string,
  items: SimpleStockAddItem[],
): Promise<Result<{ created: number; failed: { index: number; error: string }[] }>> {
  if (items.length === 0) {
    return { success: true, created: 0, failed: [] };
  }

  const correlationId = crypto.randomUUID();
  const purchasedDate = new Date().toISOString().split("T")[0];
  const failed: { index: number; error: string }[] = [];
  let created = 0;

  const productIds = [...new Set(items.map((i) => i.productId))];
  const { data: validProducts } = await supabase
    .from("products")
    .select("id")
    .eq("household_id", householdId)
    .in("id", productIds);
  const validIds = new Set((validProducts ?? []).map((p) => p.id));

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!validIds.has(item.productId)) {
      failed.push({ index: i, error: "Product not found in this household" });
      continue;
    }

    try {
      const { data: newEntry, error: insertError } = await supabase
        .from("stock_entries")
        .insert({
          household_id: householdId,
          product_id: item.productId,
          amount: item.amount,
          location_id: item.locationId ?? null,
          shopping_location_id: item.shoppingLocationId ?? null,
          best_before_date: item.bestBeforeDate ?? null,
          price: item.price ?? null,
          note: item.note ?? null,
          purchased_date: purchasedDate,
        })
        .select("id, stock_id")
        .single();
      if (insertError || !newEntry) {
        failed.push({ index: i, error: insertError?.message ?? "insert failed" });
        continue;
      }

      await supabase.from("stock_log").insert({
        household_id: householdId,
        product_id: item.productId,
        amount: item.amount,
        transaction_type: "purchase",
        price: item.price ?? null,
        shopping_location_id: item.shoppingLocationId ?? null,
        purchased_date: purchasedDate,
        stock_entry_id: newEntry.id,
        stock_id: newEntry.stock_id,
        correlation_id: correlationId,
        transaction_id: crypto.randomUUID(),
        undone: false,
      });
      created++;
    } catch (err) {
      failed.push({ index: i, error: err instanceof Error ? err.message : "insert exception" });
    }
  }

  return { success: true, created, failed, correlationId };
}

/**
 * Consume every ingredient of a recipe (scaled to desiredServings) under a
 * single correlation_id so the Journal shows it as one cook event and the
 * existing undo flow restores the whole thing at once.
 */
export async function consumeRecipeMcp(
  supabase: Supa,
  householdId: string,
  recipeId: string,
  desiredServings?: number,
): Promise<Result<{ consumedIngredients: number; skipped: number }>> {
  try {
    const { data: recipe, error: recipeError } = await supabase
      .from("recipes")
      .select("*")
      .eq("id", recipeId)
      .eq("household_id", householdId)
      .maybeSingle();
    if (recipeError) throw recipeError;
    if (!recipe) return { success: false, error: "Recipe not found in this household" };

    const servings = desiredServings ?? recipe.desired_servings ?? recipe.base_servings;
    const scale = servings / (recipe.base_servings || 1);

    const { data: ingredients, error: ingError } = await supabase
      .from("recipe_ingredients")
      .select("*, product:products(id, not_check_stock_fulfillment_for_recipes)")
      .eq("household_id", householdId)
      .eq("recipe_id", recipeId);
    if (ingError) throw ingError;

    const sharedCorrelationId = crypto.randomUUID();
    let consumed = 0;
    let skipped = 0;

    for (const ing of (ingredients ?? []) as Array<{
      product_id: string | null;
      amount: number;
      not_check_stock_fulfillment: boolean;
      product?: { id: string; not_check_stock_fulfillment_for_recipes?: boolean } | null;
    }>) {
      if (
        !ing.product_id ||
        ing.not_check_stock_fulfillment ||
        ing.product?.not_check_stock_fulfillment_for_recipes
      ) {
        skipped++;
        continue;
      }

      const needed = ing.amount * scale;
      const entries = await fetchStockEntries(supabase, householdId, ing.product_id);
      const totalAvailable = entries.reduce((sum, e) => sum + e.amount, 0);
      if (totalAvailable < needed) {
        skipped++;
        continue;
      }

      const plan = computeConsumePlan(entries, needed);
      const usedDate = new Date().toISOString().split("T")[0];
      const entryMap = new Map(entries.map((e) => [e.id, e]));

      for (const item of plan.items) {
        const entry = entryMap.get(item.entryId)!;
        if (item.deleteEntry) {
          await supabase
            .from("stock_entries")
            .delete()
            .eq("id", item.entryId)
            .eq("household_id", householdId);
        } else {
          await supabase
            .from("stock_entries")
            .update({ amount: item.newAmount })
            .eq("id", item.entryId)
            .eq("household_id", householdId);
        }
        await supabase.from("stock_log").insert({
          household_id: householdId,
          product_id: ing.product_id,
          amount: item.amountToConsume,
          transaction_type: "consume",
          best_before_date: entry.best_before_date ?? null,
          purchased_date: entry.purchased_date ?? null,
          used_date: usedDate,
          opened_date: entry.opened_date ?? null,
          price: entry.price ?? null,
          location_id: entry.location_id ?? null,
          shopping_location_id: entry.shopping_location_id ?? null,
          spoiled: false,
          stock_id: entry.stock_id,
          stock_entry_id: item.deleteEntry ? null : entry.id,
          correlation_id: sharedCorrelationId,
          transaction_id: crypto.randomUUID(),
          undone: false,
          note: entry.note ?? null,
          recipe_id: recipeId,
        });
      }
      consumed++;
    }

    return { success: true, consumedIngredients: consumed, skipped, correlationId: sharedCorrelationId };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "recipe consume failed" };
  }
}

// ===========================================================================
// Undo (service-role mirror of the browser undoTransaction dispatcher in
// src/lib/stock-actions.ts). The browser handlers rely on auth.getUser() + RLS
// and take no householdId; these take an explicit householdId and filter every
// query by it, per this module's safety invariant. Keep behaviour in sync with
// the originals if those change.
// ===========================================================================

type UndoResult = { success: true } | { success: false; error: string };

type StockLogRow = {
  household_id: string;
  product_id: string;
  amount: number;
  transaction_type: string;
  best_before_date: string | null;
  purchased_date: string | null;
  price: number | null;
  location_id: string | null;
  shopping_location_id: string | null;
  stock_id: string | null;
  stock_entry_id: string | null;
  opened_date: string | null;
  note: string | null;
};

async function fetchUndoLogRows(
  supabase: Supa,
  householdId: string,
  correlationId: string,
): Promise<StockLogRow[]> {
  const { data, error } = await supabase
    .from("stock_log")
    .select("*")
    .eq("household_id", householdId)
    .eq("correlation_id", correlationId)
    .eq("undone", false);
  if (error) throw error;
  return (data ?? []) as StockLogRow[];
}

async function markUndone(
  supabase: Supa,
  householdId: string,
  correlationId: string,
  transactionType?: string,
): Promise<void> {
  let q = supabase
    .from("stock_log")
    .update({ undone: true, undone_timestamp: new Date().toISOString() })
    .eq("household_id", householdId)
    .eq("correlation_id", correlationId);
  if (transactionType) q = q.eq("transaction_type", transactionType);
  const { error } = await q;
  if (error) throw error;
}

async function restoreConsumedRows(
  supabase: Supa,
  householdId: string,
  rows: StockLogRow[],
): Promise<void> {
  for (const row of rows) {
    if (row.stock_entry_id) {
      const { data: existing, error: getError } = await supabase
        .from("stock_entries")
        .select("amount")
        .eq("id", row.stock_entry_id)
        .eq("household_id", householdId)
        .single();
      if (getError) throw getError;
      const { error: updateError } = await supabase
        .from("stock_entries")
        .update({ amount: existing.amount + row.amount })
        .eq("id", row.stock_entry_id)
        .eq("household_id", householdId);
      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await supabase.from("stock_entries").insert({
        household_id: householdId,
        product_id: row.product_id,
        amount: row.amount,
        best_before_date: row.best_before_date,
        purchased_date: row.purchased_date,
        price: row.price,
        location_id: row.location_id,
        shopping_location_id: row.shopping_location_id,
        stock_id: row.stock_id,
        open: row.opened_date !== null,
        opened_date: row.opened_date,
        note: row.note,
      });
      if (insertError) throw insertError;
    }
  }
}

export async function undoTransactionMcp(
  supabase: Supa,
  householdId: string,
  correlationId: string,
  transactionType: string,
): Promise<UndoResult> {
  try {
    const rows = await fetchUndoLogRows(supabase, householdId, correlationId);
    if (rows.length === 0) return { success: false, error: "Nothing to undo (already undone or not found in this household)" };

    switch (transactionType) {
      case "consume":
      case "spoiled": {
        await restoreConsumedRows(supabase, householdId, rows);
        await markUndone(supabase, householdId, correlationId);
        return { success: true };
      }
      case "product-opened": {
        for (const row of rows) {
          if (!row.stock_entry_id) continue;
          const { error } = await supabase
            .from("stock_entries")
            .update({
              open: false,
              opened_date: null,
              best_before_date: row.best_before_date,
              location_id: row.location_id,
            })
            .eq("id", row.stock_entry_id)
            .eq("household_id", householdId);
          if (error) throw error;
        }
        await markUndone(supabase, householdId, correlationId);
        return { success: true };
      }
      case "transfer-from": {
        const fromRow = rows.find((r) => r.transaction_type === "transfer-from");
        if (!fromRow || !fromRow.stock_entry_id) return { success: false, error: "Transfer-from log not found" };
        const { error } = await supabase
          .from("stock_entries")
          .update({ location_id: fromRow.location_id, best_before_date: fromRow.best_before_date })
          .eq("id", fromRow.stock_entry_id)
          .eq("household_id", householdId);
        if (error) throw error;
        await markUndone(supabase, householdId, correlationId);
        return { success: true };
      }
      case "inventory-correction": {
        let direction: string;
        try {
          direction = JSON.parse(rows[0].note ?? "{}").direction;
        } catch {
          return { success: false, error: "Invalid correction log data" };
        }
        if (direction === "decrease") {
          await restoreConsumedRows(supabase, householdId, rows);
        } else if (direction === "increase") {
          const row = rows[0];
          if (!row.stock_entry_id) return { success: false, error: "Correction entry not found" };
          const { data: existing, error: getError } = await supabase
            .from("stock_entries")
            .select("amount")
            .eq("id", row.stock_entry_id)
            .eq("household_id", householdId)
            .single();
          if (getError) throw getError;
          const restoredAmount = existing.amount - row.amount;
          if (restoredAmount <= 0) {
            const { error: deleteError } = await supabase
              .from("stock_entries")
              .delete()
              .eq("id", row.stock_entry_id)
              .eq("household_id", householdId);
            if (deleteError) throw deleteError;
          } else {
            const { error: updateError } = await supabase
              .from("stock_entries")
              .update({ amount: restoredAmount })
              .eq("id", row.stock_entry_id)
              .eq("household_id", householdId);
            if (updateError) throw updateError;
          }
        } else {
          return { success: false, error: "Unknown correction direction" };
        }
        await markUndone(supabase, householdId, correlationId);
        return { success: true };
      }
      case "purchase": {
        // Mark undone first (mirrors browser ordering), then delete entries.
        await markUndone(supabase, householdId, correlationId, "purchase");
        for (const row of rows) {
          if (row.transaction_type !== "purchase") continue;
          if (row.stock_entry_id) {
            const { error: deleteError } = await supabase
              .from("stock_entries")
              .delete()
              .eq("id", row.stock_entry_id)
              .eq("household_id", householdId);
            if (deleteError) throw deleteError;
          }
        }
        return { success: true };
      }
      default:
        return { success: false, error: `Cannot undo transaction type '${transactionType}'` };
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "undo failed" };
  }
}
