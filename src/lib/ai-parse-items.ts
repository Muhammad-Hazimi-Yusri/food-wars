import { ParsedStockItem } from "@/types/database";
import { findBestMatch } from "@/lib/fuzzy-match";
import { extractRawItems } from "@/lib/ai-json-extract";

type MinProduct = {
  id: string;
  name: string;
  qu_id_purchase?: string | null;
  qu_id_stock?: string | null;
  location_id?: string | null;
  shopping_location_id?: string | null;
  default_due_days?: number | null;
};
type MinUnit = { id: string; name: string; name_plural: string | null };
type MinStore = { id: string; name: string };
type MinLocation = { id: string; name: string };

/**
 * Parse a raw AI response string containing stock items and apply
 * fuzzy matching against household context data.
 */
export function parseAndMatchItems(
  response: string,
  products: MinProduct[],
  units: MinUnit[],
  stores: MinStore[],
  locations: MinLocation[],
): ParsedStockItem[] {
  const rawItems = extractRawItems(response);
  if (rawItems.length === 0) return [];

  return rawItems.map((raw: unknown) => {
    const r = raw as Record<string, unknown>;

    const productName = String(r.product_name ?? "").trim();
    const unitName = String(r.unit_name ?? "").trim();
    const storeName = String(r.store_name ?? "").trim();
    const locationName = String(r.location_name ?? "").trim();

    // Fuzzy match product (AI may have matched via [id:], but verify)
    let productId = typeof r.product_id === "string" ? r.product_id : null;
    if (productId) {
      const exists = products.find((p) => p.id === productId);
      if (!exists) productId = null;
    }
    if (!productId && productName) {
      const match = findBestMatch(productName, products, (p) => p.name);
      if (match) productId = match.item.id;
    }

    // Fuzzy match unit
    let quId: string | null = null;
    if (unitName) {
      const match = findBestMatch(
        unitName,
        units,
        (u) => u.name + (u.name_plural ? ` ${u.name_plural}` : ""),
      );
      if (match) quId = match.item.id;
    }

    // Fuzzy match store
    let shoppingLocationId: string | null = null;
    if (storeName) {
      const match = findBestMatch(storeName, stores, (s) => s.name);
      if (match) shoppingLocationId = match.item.id;
    }

    // Fuzzy match location
    let locationId: string | null = null;
    if (locationName) {
      const match = findBestMatch(locationName, locations, (l) => l.name);
      if (match) locationId = match.item.id;
    }

    // Normalize date
    let bestBeforeDate: string | null = null;
    if (r.best_before_date && typeof r.best_before_date === "string") {
      const dateStr = r.best_before_date.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        bestBeforeDate = dateStr;
      }
    }

    // Apply product defaults for matched items
    const matchedProduct = productId ? products.find((p) => p.id === productId) : null;
    if (matchedProduct) {
      if (!quId) quId = matchedProduct.qu_id_purchase ?? matchedProduct.qu_id_stock ?? null;
      if (!locationId) locationId = matchedProduct.location_id ?? null;
      if (!shoppingLocationId) shoppingLocationId = matchedProduct.shopping_location_id ?? null;
      if (!bestBeforeDate && matchedProduct.default_due_days) {
        const due = new Date();
        due.setDate(due.getDate() + matchedProduct.default_due_days);
        bestBeforeDate = due.toISOString().split("T")[0];
      }
    }

    return {
      raw: productName,
      product_id: productId,
      product_name: matchedProduct?.name ?? productName,
      amount: typeof r.amount === "number" && r.amount > 0 ? r.amount : 1,
      qu_id: quId,
      unit_name: unitName,
      best_before_date: bestBeforeDate,
      shopping_location_id: shoppingLocationId,
      store_name: storeName,
      price: typeof r.price === "number" ? r.price : null,
      location_id: locationId,
      location_name: locationName,
      note: String(r.note ?? "").trim(),
    };
  });
}
