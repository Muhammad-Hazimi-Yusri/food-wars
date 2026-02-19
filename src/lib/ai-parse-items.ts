import { ParsedStockItem } from "@/types/database";
import { findBestMatch } from "@/lib/fuzzy-match";

type MinProduct = { id: string; name: string };
type MinUnit = { id: string; name: string; name_plural: string | null };
type MinStore = { id: string; name: string };
type MinLocation = { id: string; name: string };

/**
 * Find the index of the matching closing bracket for the bracket at `start`.
 * Handles nested brackets and string literals.
 */
function findMatchingBracket(str: string, start: number): number {
  const open = str[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < str.length; i++) {
    const ch = str[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\" && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === open) depth++;
    if (ch === close) depth--;
    if (depth === 0) return i;
  }
  return -1;
}

/** Try to extract an items array from a parsed JSON value. */
function extractFromParsed(parsed: unknown): unknown[] | null {
  if (Array.isArray((parsed as Record<string, unknown>)?.items))
    return (parsed as Record<string, unknown>).items as unknown[];
  if (Array.isArray(parsed)) return parsed;
  if (typeof parsed === "object" && parsed !== null) {
    for (const value of Object.values(parsed)) {
      if (Array.isArray(value) && value.length > 0) return value;
    }
  }
  return null;
}

/**
 * Extract an array of raw items from an AI response string.
 * Tries multiple strategies to handle different model output formats.
 */
function extractRawItems(response: string): unknown[] {
  // Strategy 1: Parse as JSON directly
  try {
    const parsed = JSON.parse(response);
    const items = extractFromParsed(parsed);
    if (items) return items;
  } catch {
    // Not valid JSON — try other strategies
  }

  // Strategy 2: Extract JSON from markdown code fences
  const fenceMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    try {
      const inner = JSON.parse(fenceMatch[1]);
      const items = extractFromParsed(inner);
      if (items) return items;
    } catch {
      // fall through
    }
  }

  // Strategy 3: Find first { or [ and try to parse from there
  const jsonStart = response.search(/[{[]/);
  if (jsonStart >= 0) {
    try {
      const inner = JSON.parse(response.slice(jsonStart));
      const items = extractFromParsed(inner);
      if (items) return items;
    } catch {
      // fall through
    }
  }

  // Strategy 4: Bracket-match to extract JSON even with trailing text
  // Handles: "Here are items: {...} Hope this helps!" and stray {braces} before JSON
  for (const startChar of ["{", "["]) {
    let searchFrom = 0;
    while (searchFrom < response.length) {
      const startIdx = response.indexOf(startChar, searchFrom);
      if (startIdx < 0) break;

      const endIdx = findMatchingBracket(response, startIdx);
      if (endIdx > startIdx) {
        try {
          const candidate = response.slice(startIdx, endIdx + 1);
          const parsed = JSON.parse(candidate);
          const items = extractFromParsed(parsed);
          if (items) return items;
        } catch {
          // Not valid JSON at this position, try next
        }
      }
      searchFrom = startIdx + 1;
    }
  }

  return [];
}

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

    return {
      raw: productName,
      product_id: productId,
      product_name: productId
        ? (products.find((p) => p.id === productId)?.name ?? productName)
        : productName,
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
