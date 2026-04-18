/**
 * Parse pasted JSON from an external LLM (Claude.ai / ChatGPT) into
 * `ParsedImportItem[]` ready for review and bulk import.
 *
 * Responsibilities:
 *   - Extract a JSON object from the pasted text (even when the LLM wraps it
 *     in code fences or prose) via the shared `extractRawItems` helper.
 *   - Validate each item has at least the minimum fields needed for import.
 *   - Fuzzy-match product / unit / location / store / group names against
 *     the household's existing master-data.
 *   - Classify each item as `existing-product` (matched via id, barcode, or
 *     fuzzy name ≥ 0.85) or `new-product` (requires creation on import).
 */

import { findBestMatch } from "@/lib/fuzzy-match";
import { extractRawItems } from "@/lib/ai-json-extract";
import type {
  ParsedImportItem,
  ParseImportResult,
  NameRef,
  PendingProduct,
  ResolvedStock,
  ImportProductBlock,
  ImportStockBlock,
  ImportNutrition,
} from "@/types/ai-import";
import type { CookingRole, DueType } from "@/types/database";

// Threshold above which a fuzzy match is accepted as definitive.
// Below this we force the user to manually map in the review UI.
const STRONG_MATCH_THRESHOLD = 0.85;

// Shapes we need for matching. Loose to accept whatever the caller supplies.
export type MatchProduct = {
  id: string;
  name: string;
  qu_id_purchase?: string | null;
  qu_id_stock?: string | null;
  location_id?: string | null;
  shopping_location_id?: string | null;
  default_due_days?: number | null;
};
export type MatchUnit = { id: string; name: string; name_plural?: string | null };
export type MatchStore = { id: string; name: string };
export type MatchLocation = { id: string; name: string };
export type MatchGroup = { id: string; name: string };
export type MatchBarcode = { barcode: string; product_id: string };

export type ImportMatchContext = {
  products: MatchProduct[];
  units: MatchUnit[];
  stores: MatchStore[];
  locations: MatchLocation[];
  groups: MatchGroup[];
  barcodes: MatchBarcode[];
};

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function asNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function asPositiveNumber(v: unknown, fallback = 1): number {
  const n = asNumber(v);
  return n != null && n > 0 ? n : fallback;
}

function resolveDueType(v: unknown): DueType {
  return v === "expiration" ? 2 : 1;
}

const VALID_COOKING_ROLES: readonly CookingRole[] = [
  "protein", "vegetable", "starch", "seasoning_system",
  "sauce", "produce", "form_factor_base", "other",
];

function resolveCookingRole(v: unknown): CookingRole | null {
  if (typeof v !== "string") return null;
  return VALID_COOKING_ROLES.includes(v as CookingRole) ? (v as CookingRole) : null;
}

function isIsoDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/**
 * Build a NameRef for a master-data reference. Strong matches (≥ threshold)
 * are auto-resolved to an id; weaker matches leave id = null so the review UI
 * forces a decision.
 */
function resolveNameRef<T extends { id: string; name: string }>(
  name: string,
  candidates: T[],
  threshold: number,
): NameRef | null {
  if (!name) return null;
  const best = findBestMatch(name, candidates, (c) => c.name, threshold);
  if (best && best.score >= STRONG_MATCH_THRESHOLD) {
    return { id: best.item.id, name: best.item.name };
  }
  return { id: null, name };
}

function resolveUnitNameRef(name: string, units: MatchUnit[]): NameRef | null {
  if (!name) return null;
  const match = findBestMatch(
    name,
    units,
    (u) => u.name + (u.name_plural ? ` ${u.name_plural}` : ""),
    STRONG_MATCH_THRESHOLD,
  );
  if (match) return { id: match.item.id, name: match.item.name };
  return { id: null, name };
}

function parseNutrition(v: unknown): ImportNutrition | null {
  if (!v || typeof v !== "object") return null;
  const r = v as Record<string, unknown>;
  const out: ImportNutrition = {
    energy_kj: asNumber(r.energy_kj),
    energy_kcal: asNumber(r.energy_kcal),
    fat: asNumber(r.fat),
    saturated_fat: asNumber(r.saturated_fat),
    carbohydrates: asNumber(r.carbohydrates),
    sugars: asNumber(r.sugars),
    fibre: asNumber(r.fibre),
    protein: asNumber(r.protein),
    salt: asNumber(r.salt),
    nutrition_grade: typeof r.nutrition_grade === "string" ? r.nutrition_grade : null,
  };
  const hasAny = Object.values(out).some((x) => x !== null);
  return hasAny ? out : null;
}

function parseStockBlock(
  raw: ImportStockBlock | null | undefined,
  ctx: ImportMatchContext,
  productDefaults: {
    qu_id_purchase?: string | null;
    qu_id_stock?: string | null;
    location_id?: string | null;
    shopping_location_id?: string | null;
    default_due_days?: number | null;
  } | null,
  errors: string[],
): ResolvedStock {
  const r = (raw ?? {}) as ImportStockBlock;

  const amount = asPositiveNumber(r.amount, 1);
  if (r.amount != null && amount !== r.amount) {
    errors.push("Invalid amount — defaulted to 1");
  }

  const unitName = asString(r.unit_name);
  let qu = resolveUnitNameRef(unitName, ctx.units);
  if (!qu && productDefaults?.qu_id_purchase) {
    const existing = ctx.units.find((u) => u.id === productDefaults.qu_id_purchase);
    if (existing) qu = { id: existing.id, name: existing.name };
  }

  const rawDate = asString(r.best_before_date);
  let bestBeforeDate: string | null = isIsoDate(rawDate) ? rawDate : null;
  if (!bestBeforeDate && productDefaults?.default_due_days) {
    const due = new Date();
    due.setDate(due.getDate() + productDefaults.default_due_days);
    bestBeforeDate = due.toISOString().split("T")[0];
  }

  const storeName = asString(r.store_name);
  let shoppingLoc = resolveNameRef(storeName, ctx.stores, STRONG_MATCH_THRESHOLD);
  if (!shoppingLoc && productDefaults?.shopping_location_id) {
    const existing = ctx.stores.find((s) => s.id === productDefaults.shopping_location_id);
    if (existing) shoppingLoc = { id: existing.id, name: existing.name };
  }

  const locationName = asString(r.location_name);
  let location = resolveNameRef(locationName, ctx.locations, STRONG_MATCH_THRESHOLD);
  if (!location && productDefaults?.location_id) {
    const existing = ctx.locations.find((l) => l.id === productDefaults.location_id);
    if (existing) location = { id: existing.id, name: existing.name };
  }

  return {
    amount,
    qu,
    best_before_date: bestBeforeDate,
    price: asNumber(r.price),
    shopping_location: shoppingLoc,
    location,
    note: asString(r.note),
  };
}

function parseProductAsNew(
  product: ImportProductBlock,
  ctx: ImportMatchContext,
  errors: string[],
): PendingProduct {
  const name = asString(product.name);
  if (!name) errors.push("Missing product name");

  const qu_stock_name = asString(product.qu_stock_name);
  const qu_purchase_name = asString(product.qu_purchase_name);
  const locationName = asString(product.location_name);
  const shoppingLocationName = asString(product.shopping_location_name);
  const groupName = asString(product.product_group_name);

  return {
    name,
    brand: asString(product.brand) || null,
    barcode: asString(product.barcode) || null,
    qu_stock: resolveUnitNameRef(qu_stock_name, ctx.units),
    qu_purchase: resolveUnitNameRef(qu_purchase_name, ctx.units),
    purchase_to_stock_factor: asNumber(product.purchase_to_stock_factor),
    location: resolveNameRef(locationName, ctx.locations, STRONG_MATCH_THRESHOLD),
    shopping_location: resolveNameRef(shoppingLocationName, ctx.stores, STRONG_MATCH_THRESHOLD),
    product_group: resolveNameRef(groupName, ctx.groups, STRONG_MATCH_THRESHOLD),
    default_due_days: asNumber(product.default_due_days) ?? 0,
    due_type: resolveDueType(product.due_type),
    cooking_role: resolveCookingRole(product.cooking_role),
    nutrition: parseNutrition(product.nutrition),
  };
}

/** Resolve a single raw LLM item to a ParsedImportItem. */
function resolveItem(raw: unknown, ctx: ImportMatchContext): ParsedImportItem | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const product = (r.product && typeof r.product === "object")
    ? r.product as ImportProductBlock
    : r as ImportProductBlock;
  const stock = (r.stock && typeof r.stock === "object")
    ? r.stock as ImportStockBlock
    : null;

  const errors: string[] = [];

  // Step 1: match_id → existing product
  const matchId = asString(product.match_id);
  if (matchId) {
    const existing = ctx.products.find((p) => p.id === matchId);
    if (existing) {
      return {
        kind: "existing-product",
        product_id: existing.id,
        product_name: existing.name,
        match_reason: "match_id",
        stock: parseStockBlock(stock, ctx, existing, errors),
        errors,
      };
    }
  }

  // Step 2: barcode → existing product
  const barcode = asString(product.barcode);
  if (barcode) {
    const match = ctx.barcodes.find((b) => b.barcode === barcode);
    if (match) {
      const existing = ctx.products.find((p) => p.id === match.product_id);
      if (existing) {
        return {
          kind: "existing-product",
          product_id: existing.id,
          product_name: existing.name,
          match_reason: "barcode",
          stock: parseStockBlock(stock, ctx, existing, errors),
          errors,
        };
      }
    }
  }

  // Step 3: fuzzy name → existing product (strong match only)
  const name = asString(product.name);
  if (name) {
    const best = findBestMatch(name, ctx.products, (p) => p.name, STRONG_MATCH_THRESHOLD);
    if (best) {
      return {
        kind: "existing-product",
        product_id: best.item.id,
        product_name: best.item.name,
        match_reason: "fuzzy_name",
        stock: parseStockBlock(stock, ctx, best.item, errors),
        errors,
      };
    }
  }

  // Step 4: new product
  if (!name) {
    errors.push("Missing product name — cannot import");
    return null;
  }

  const pending = parseProductAsNew(product, ctx, errors);
  const resolvedStock = parseStockBlock(stock, ctx, null, errors);

  return {
    kind: "new-product",
    product: pending,
    stock: resolvedStock,
    errors,
  };
}

/** Main entry point: parse pasted JSON text into ParsedImportItem[]. */
export function parseImportJson(
  text: string,
  ctx: ImportMatchContext,
): ParseImportResult {
  const result: ParseImportResult = { items: [], errors: [], rawResponse: text };

  const rawItems = extractRawItems(text);
  if (rawItems.length === 0) {
    result.errors.push(
      "Couldn't find a JSON object with an 'items' array in the pasted text.",
    );
    return result;
  }

  for (const raw of rawItems) {
    const item = resolveItem(raw, ctx);
    if (item) result.items.push(item);
  }

  if (result.items.length === 0) {
    result.errors.push("No importable items found in the JSON.");
  }

  return result;
}
