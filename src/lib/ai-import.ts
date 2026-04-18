/**
 * Client-side orchestrator for the AI paste-JSON import flow.
 *
 * `bulkCreateProductsAndStock` takes resolved `ParsedImportItem[]` and, for
 * each item:
 *   1. Ensures any new master-data (location, shopping_location, product_group)
 *      exists — creating rows as needed with an in-memory cache to dedupe
 *      repeats within the batch.
 *   2. Creates the product + product_nutrition + product_barcode rows for
 *      `new-product` items.
 *   3. Creates a stock_entry + stock_log row for every item whose stock block
 *      is importable.
 *
 * No transaction: Supabase JS doesn't support multi-statement transactions.
 * We create sequentially and tolerate partial success — failures are returned
 * in `failed[]` and surfaced in the result step of the UI.
 *
 * Units are never auto-created. If a unit reference is missing an `id` at
 * this point, the review UI should have already forced the user to pick one
 * or clear the field — so we treat unresolved units as "use null".
 */

import { createClient } from "@/lib/supabase/client";
import { GUEST_HOUSEHOLD_ID } from "@/lib/constants";
import { resolveBuiltInConversion } from "@/lib/unit-conversions";
import type { ParsedImportItem, PendingProduct, NameRef, ResolvedStock } from "@/types/ai-import";

export type ImportBatchResult = {
  created_products: number;
  created_stock: number;
  created_master_data: {
    locations: number;
    shopping_locations: number;
    product_groups: number;
  };
  failed: { index: number; reason: string; detail?: string }[];
};

type Cache = {
  locations: Map<string, string>;
  shopping_locations: Map<string, string>;
  product_groups: Map<string, string>;
};

type SupabaseLike = ReturnType<typeof createClient>;

type MasterTable = "locations" | "shopping_locations" | "product_groups";

async function ensureMasterData(
  supabase: SupabaseLike,
  table: MasterTable,
  ref: NameRef | null,
  householdId: string,
  cache: Cache,
  masterCounter: { locations: number; shopping_locations: number; product_groups: number },
): Promise<string | null> {
  if (!ref) return null;
  if (ref.id) return ref.id;

  const key = ref.name.trim().toLowerCase();
  if (!key) return null;

  const cacheMap = cache[table];
  const cached = cacheMap.get(key);
  if (cached) return cached;

  const { data, error } = await supabase
    .from(table)
    .insert({ household_id: householdId, name: ref.name.trim() })
    .select("id")
    .single();

  if (error || !data) return null;

  cacheMap.set(key, data.id);
  masterCounter[table]++;
  return data.id;
}

async function createProduct(
  supabase: SupabaseLike,
  pending: PendingProduct,
  householdId: string,
  cache: Cache,
  masterCounter: { locations: number; shopping_locations: number; product_groups: number },
): Promise<{ id: string } | { error: string }> {
  const locationId = await ensureMasterData(
    supabase, "locations", pending.location, householdId, cache, masterCounter,
  );
  const shoppingLocationId = await ensureMasterData(
    supabase, "shopping_locations", pending.shopping_location, householdId, cache, masterCounter,
  );
  const productGroupId = await ensureMasterData(
    supabase, "product_groups", pending.product_group, householdId, cache, masterCounter,
  );

  const { data, error } = await supabase
    .from("products")
    .insert({
      household_id: householdId,
      name: pending.name,
      brand: pending.brand,
      location_id: locationId,
      shopping_location_id: shoppingLocationId,
      product_group_id: productGroupId,
      qu_id_stock: pending.qu_stock?.id ?? null,
      qu_id_purchase: pending.qu_purchase?.id ?? pending.qu_stock?.id ?? null,
      default_due_days: pending.default_due_days ?? 0,
      due_type: pending.due_type,
      cooking_role: pending.cooking_role,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: error?.message ?? "Insert failed" };
  }
  return { id: data.id };
}

async function insertNutrition(
  supabase: SupabaseLike,
  productId: string,
  householdId: string,
  pending: PendingProduct,
): Promise<void> {
  if (!pending.nutrition) return;
  const n = pending.nutrition;
  const hasAny = [
    n.energy_kj, n.energy_kcal, n.fat, n.saturated_fat,
    n.carbohydrates, n.sugars, n.fibre, n.protein, n.salt,
  ].some((v) => v != null);
  if (!hasAny && !n.nutrition_grade) return;

  await supabase.from("product_nutrition").insert({
    household_id: householdId,
    product_id: productId,
    energy_kj: n.energy_kj ?? null,
    energy_kcal: n.energy_kcal ?? null,
    fat: n.fat ?? null,
    saturated_fat: n.saturated_fat ?? null,
    carbohydrates: n.carbohydrates ?? null,
    sugars: n.sugars ?? null,
    fibre: n.fibre ?? null,
    protein: n.protein ?? null,
    salt: n.salt ?? null,
    nutrition_grade: n.nutrition_grade ?? null,
    data_source: "manual",
  });
}

async function insertBarcode(
  supabase: SupabaseLike,
  productId: string,
  householdId: string,
  pending: PendingProduct,
): Promise<void> {
  if (!pending.barcode) return;
  await supabase.from("product_barcodes").insert({
    household_id: householdId,
    product_id: productId,
    barcode: pending.barcode,
    qu_id: pending.qu_purchase?.id ?? null,
    amount: pending.purchase_to_stock_factor ?? null,
  });
}

/**
 * Compute stock amount from a ResolvedStock, converting purchase unit → stock
 * unit when possible. Mirrors `getStockAmount` in stock-entry-utils.ts but
 * operates on the richer ParsedImportItem shape.
 */
function computeStockAmount(
  stock: ResolvedStock,
  product: { qu_id_stock: string | null; qu_id_purchase: string | null },
  conversions: { product_id: string | null; from_qu_id: string; to_qu_id: string; factor: number }[],
  units: { id: string; name: string }[],
  productId: string,
  productSpecificFactor?: number | null,
): number {
  if (!stock.qu?.id || !product.qu_id_stock) return stock.amount;
  if (stock.qu.id === product.qu_id_stock) return stock.amount;

  // If the import provided purchase_to_stock_factor AND the stock unit matches
  // the product's purchase unit, use that factor directly.
  if (
    productSpecificFactor != null &&
    stock.qu.id === product.qu_id_purchase
  ) {
    return stock.amount * productSpecificFactor;
  }

  const productConv = conversions.find(
    (c) => c.product_id === productId && c.from_qu_id === stock.qu!.id && c.to_qu_id === product.qu_id_stock,
  );
  if (productConv) return stock.amount * productConv.factor;

  const globalConv = conversions.find(
    (c) => c.product_id === null && c.from_qu_id === stock.qu!.id && c.to_qu_id === product.qu_id_stock,
  );
  if (globalConv) return stock.amount * globalConv.factor;

  const fromName = units.find((u) => u.id === stock.qu!.id)?.name;
  const toName = units.find((u) => u.id === product.qu_id_stock)?.name;
  if (fromName && toName) {
    const builtIn = resolveBuiltInConversion(fromName, toName);
    if (builtIn != null) return stock.amount * builtIn;
  }

  return stock.amount;
}

export type ImportHouseholdData = {
  products: { id: string; qu_id_stock: string | null; qu_id_purchase: string | null; location_id: string | null; shopping_location_id: string | null }[];
  quantityUnits: { id: string; name: string }[];
  conversions: { product_id: string | null; from_qu_id: string; to_qu_id: string; factor: number }[];
};

/**
 * Run the batch import. Progress callback is invoked after each item.
 */
export async function bulkCreateProductsAndStock(
  items: ParsedImportItem[],
  householdData: ImportHouseholdData,
  onProgress?: (done: number, total: number) => void,
): Promise<ImportBatchResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const isGuest = user.is_anonymous === true;
  let householdId: string;
  if (isGuest) {
    householdId = GUEST_HOUSEHOLD_ID;
  } else {
    const { data: household } = await supabase
      .from("households")
      .select("id")
      .eq("owner_id", user.id)
      .single();
    if (!household) throw new Error("No household found");
    householdId = household.id;
  }

  const cache: Cache = {
    locations: new Map(),
    shopping_locations: new Map(),
    product_groups: new Map(),
  };

  const result: ImportBatchResult = {
    created_products: 0,
    created_stock: 0,
    created_master_data: { locations: 0, shopping_locations: 0, product_groups: 0 },
    failed: [],
  };

  // Mutable-by-ref counter passed to ensureMasterData.
  // We need the counter to survive across ensureMasterData calls, hence the
  // sub-objects with getter/setter pairs above.
  const masterCounter = result.created_master_data;

  // Mutable extended view of products so stock insertion sees newly-created ones.
  const products = [...householdData.products];

  const purchaseFactorByIndex = new Map<number, number | null>();

  // Pass 1: create master-data, products, nutrition, barcodes.
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    try {
      if (item.kind === "new-product") {
        const created = await createProduct(
          supabase, item.product, householdId, cache, masterCounter,
        );
        if ("error" in created) {
          result.failed.push({ index: i, reason: "product_insert_failed", detail: created.error });
          continue;
        }
        await insertNutrition(supabase, created.id, householdId, item.product);
        await insertBarcode(supabase, created.id, householdId, item.product);
        result.created_products++;

        // Remember the factor so Pass 2 can convert purchase → stock amount
        purchaseFactorByIndex.set(i, item.product.purchase_to_stock_factor);

        products.push({
          id: created.id,
          qu_id_stock: item.product.qu_stock?.id ?? null,
          qu_id_purchase: item.product.qu_purchase?.id ?? null,
          location_id: item.product.location?.id ?? null,
          shopping_location_id: item.product.shopping_location?.id ?? null,
        });

        items[i] = {
          kind: "existing-product",
          product_id: created.id,
          product_name: item.product.name,
          match_reason: "match_id",
          stock: item.stock,
          errors: item.errors,
        };
      }
    } catch (err) {
      result.failed.push({
        index: i,
        reason: "product_create_exception",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
    onProgress?.(i + 1, items.length * 2);
  }

  // Pass 2: create stock entries.
  const purchasedDate = new Date().toISOString().split("T")[0];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.kind !== "existing-product") continue; // Pass 1 failure

    try {
      const product = products.find((p) => p.id === item.product_id);
      if (!product) {
        result.failed.push({ index: i, reason: "product_not_found_after_create" });
        continue;
      }

      const stockAmount = computeStockAmount(
        item.stock,
        product,
        householdData.conversions,
        householdData.quantityUnits,
        product.id,
        purchaseFactorByIndex.get(i) ?? null,
      );

      let finalPrice = item.stock.price;
      if (finalPrice != null && stockAmount !== item.stock.amount && stockAmount > 0) {
        finalPrice = (finalPrice * item.stock.amount) / stockAmount;
      }

      const shoppingLocationId =
        item.stock.shopping_location?.id ?? product.shopping_location_id ?? null;
      const locationId =
        item.stock.location?.id ?? product.location_id ?? null;

      const { data: newEntry, error: insertError } = await supabase
        .from("stock_entries")
        .insert({
          household_id: householdId,
          product_id: item.product_id,
          amount: stockAmount,
          location_id: locationId,
          shopping_location_id: shoppingLocationId,
          best_before_date: item.stock.best_before_date,
          price: finalPrice,
          note: item.stock.note || null,
          purchased_date: purchasedDate,
        })
        .select("id, stock_id")
        .single();

      if (insertError || !newEntry) {
        result.failed.push({
          index: i,
          reason: "stock_insert_failed",
          detail: insertError?.message,
        });
        continue;
      }

      await supabase.from("stock_log").insert({
        household_id: householdId,
        product_id: item.product_id,
        amount: stockAmount,
        transaction_type: "purchase",
        price: finalPrice,
        shopping_location_id: shoppingLocationId,
        purchased_date: purchasedDate,
        stock_entry_id: newEntry.id,
        stock_id: newEntry.stock_id,
        correlation_id: crypto.randomUUID(),
        transaction_id: crypto.randomUUID(),
        undone: false,
        user_id: user.id,
      });

      result.created_stock++;
    } catch (err) {
      result.failed.push({
        index: i,
        reason: "stock_create_exception",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
    onProgress?.(items.length + i + 1, items.length * 2);
  }

  return result;
}
