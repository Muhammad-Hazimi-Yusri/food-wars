import { ParsedStockItem } from "@/types/database";
import { createClient } from "@/lib/supabase/client";
import { GUEST_HOUSEHOLD_ID } from "@/lib/constants";
import { resolveBuiltInConversion } from "@/lib/unit-conversions";

type HouseholdData = {
  products: { id: string; name: string; qu_id_stock: string | null; location_id: string | null; shopping_location_id: string | null }[];
  locations: { id: string; name: string }[];
  quantityUnits: { id: string; name: string; name_plural: string | null }[];
  shoppingLocations: { id: string; name: string }[];
  conversions: { id: string; product_id: string | null; from_qu_id: string; to_qu_id: string; factor: number }[];
};

/**
 * Convert a purchase amount → stock amount using conversion tables.
 * Priority: product-specific DB → global DB → built-in SI conversions.
 */
export function getStockAmount(
  item: ParsedStockItem,
  products: HouseholdData["products"],
  conversions: HouseholdData["conversions"],
  quantityUnits: HouseholdData["quantityUnits"] = [],
): number {
  if (!item.product_id || !item.qu_id) return item.amount;

  const product = products.find((p) => p.id === item.product_id);
  if (!product?.qu_id_stock) return item.amount;

  // Already in stock unit — no conversion
  if (item.qu_id === product.qu_id_stock) return item.amount;

  // Product-specific conversion first
  const productConv = conversions.find(
    (c) =>
      c.product_id === product.id &&
      c.from_qu_id === item.qu_id &&
      c.to_qu_id === product.qu_id_stock
  );
  if (productConv) return item.amount * productConv.factor;

  // Global DB conversion fallback
  const globalConv = conversions.find(
    (c) =>
      c.product_id === null &&
      c.from_qu_id === item.qu_id &&
      c.to_qu_id === product.qu_id_stock
  );
  if (globalConv) return item.amount * globalConv.factor;

  // Built-in SI conversion fallback (kg↔g, L↔mL, pint↔mL, etc.)
  const fromName = quantityUnits.find((u) => u.id === item.qu_id)?.name;
  const toName = quantityUnits.find((u) => u.id === product.qu_id_stock)?.name;
  if (fromName && toName) {
    const builtIn = resolveBuiltInConversion(fromName, toName);
    if (builtIn !== null) return item.amount * builtIn;
  }

  return item.amount;
}

/**
 * Bulk-create stock entries from parsed items.
 * Handles auth, household resolution, unit conversion, price adjustment.
 */
export async function bulkCreateStockEntries(
  items: ParsedStockItem[],
  householdData: HouseholdData,
  excludeIndices?: Set<number>,
): Promise<{ successCount: number; savedIndices: number[] }> {
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

  const products = householdData.products;
  const conversions = householdData.conversions;

  let successCount = 0;
  const savedIndices: number[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item.product_id || excludeIndices?.has(i)) continue;

    const product = products.find((p) => p.id === item.product_id);
    const stockAmount = getStockAmount(item, products, conversions, householdData.quantityUnits);

    // Convert price to per-stock-unit if a unit conversion was applied
    let finalPrice = item.price;
    if (finalPrice != null && stockAmount !== item.amount && stockAmount > 0) {
      finalPrice = (finalPrice * item.amount) / stockAmount;
    }

    const { error: insertError } = await supabase
      .from("stock_entries")
      .insert({
        household_id: householdId,
        product_id: item.product_id,
        amount: stockAmount,
        location_id: item.location_id || product?.location_id || null,
        shopping_location_id:
          item.shopping_location_id || product?.shopping_location_id || null,
        best_before_date: item.best_before_date || null,
        price: finalPrice,
        note: item.note || null,
        purchased_date: new Date().toISOString().split("T")[0],
      });

    if (!insertError) {
      successCount++;
      savedIndices.push(i);
    }
  }

  return { successCount, savedIndices };
}
