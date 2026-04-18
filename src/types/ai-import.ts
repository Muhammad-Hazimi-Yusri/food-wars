// ============================================
// AI INGREDIENT IMPORT — JSON schema + types
// ============================================
// Types and runtime validators for the "Paste JSON from external LLM" flow.
// A user copies a prompt bundle into Claude.ai / ChatGPT, sends photos,
// receives structured JSON back, and pastes it into PasteJsonImportDialog.
// This module defines:
//   - raw `ImportJson` the LLM should emit
//   - resolved `ParsedImportItem` after fuzzy matching to household master-data
//   - a JSON-schema string embedded in the exported prompt bundle

import type { CookingRole, DueType } from "./database";

// ============================================
// RAW JSON SHAPE (what the LLM emits)
// ============================================

export type ImportNutrition = {
  energy_kj?: number | null;
  energy_kcal?: number | null;
  fat?: number | null;
  saturated_fat?: number | null;
  carbohydrates?: number | null;
  sugars?: number | null;
  fibre?: number | null;
  protein?: number | null;
  salt?: number | null;
  nutrition_grade?: string | null;
};

export type ImportProductBlock = {
  match_id?: string | null;
  name?: string;
  brand?: string | null;
  barcode?: string | null;
  qu_stock_name?: string | null;
  qu_purchase_name?: string | null;
  purchase_to_stock_factor?: number | null;
  location_name?: string | null;
  shopping_location_name?: string | null;
  product_group_name?: string | null;
  default_due_days?: number | null;
  due_type?: "best_before" | "expiration" | null;
  cooking_role?: CookingRole | null;
  nutrition?: ImportNutrition | null;
};

export type ImportStockBlock = {
  amount?: number;
  unit_name?: string | null;
  best_before_date?: string | null;
  price?: number | null;
  store_name?: string | null;
  location_name?: string | null;
  note?: string | null;
};

export type ImportItem = {
  product: ImportProductBlock;
  stock?: ImportStockBlock | null;
};

export type ImportJson = {
  version?: string;
  items: ImportItem[];
};

// ============================================
// RESOLVED SHAPE (after fuzzy match)
// ============================================

/** A master-data reference that may already exist (`id`) or need to be created by name. */
export type NameRef = {
  /** Resolved ID if we found a fuzzy match in the household, else null. */
  id: string | null;
  /** Original name from the LLM — surfaced in the review UI. */
  name: string;
};

export type PendingProduct = {
  name: string;
  brand: string | null;
  barcode: string | null;
  qu_stock: NameRef | null;
  qu_purchase: NameRef | null;
  purchase_to_stock_factor: number | null;
  location: NameRef | null;
  shopping_location: NameRef | null;
  product_group: NameRef | null;
  default_due_days: number;
  due_type: DueType;
  cooking_role: CookingRole | null;
  nutrition: ImportNutrition | null;
};

export type ResolvedStock = {
  amount: number;
  qu: NameRef | null;
  best_before_date: string | null;
  price: number | null;
  shopping_location: NameRef | null;
  location: NameRef | null;
  note: string;
};

export type ParsedImportItem =
  | {
      kind: "existing-product";
      /** Matched product id (by match_id, fuzzy name, or barcode). */
      product_id: string;
      /** Display label shown in review. */
      product_name: string;
      /** How the match was made — surfaced as a badge. */
      match_reason: "match_id" | "barcode" | "fuzzy_name";
      stock: ResolvedStock;
      /** Per-item parse errors (missing amount, bad date, etc). */
      errors: string[];
    }
  | {
      kind: "new-product";
      product: PendingProduct;
      stock: ResolvedStock;
      errors: string[];
    };

// ============================================
// VALIDATION
// ============================================

export type ParseImportResult = {
  items: ParsedImportItem[];
  /** Global errors (malformed JSON, wrong top-level shape). */
  errors: string[];
  /** Raw LLM response preserved for a "Show raw" toggle. */
  rawResponse: string;
};

export const CURRENT_SCHEMA_VERSION = "1";

// ============================================
// JSON SCHEMA (embedded in prompt bundle)
// ============================================

/**
 * JSON-schema-style description emitted into the prompt bundle so the external
 * LLM produces the exact shape we expect. Kept as a hand-written string (not
 * generated from a schema library) because it doubles as human-readable
 * documentation for LLMs.
 */
export const IMPORT_JSON_SCHEMA = `{
  "version": "1",
  "items": [
    {
      "product": {
        "name": "string — human-readable product name",
        "brand": "string or null",
        "barcode": "string or null — EAN/UPC digits only",
        "qu_stock_name": "string — unit used for stock tracking (e.g. 'g', 'mL', 'piece'). MUST match a name from UNITS below.",
        "qu_purchase_name": "string — unit used when purchased (e.g. 'tin', 'pack'). MUST match UNITS.",
        "purchase_to_stock_factor": "number — how many stock units one purchase unit equals (e.g. 415 if a 415g tin)",
        "location_name": "string — default storage location. MUST match LOCATIONS.",
        "shopping_location_name": "string — default store. MUST match STORES.",
        "product_group_name": "string — category. MUST match GROUPS, or a new name if truly none fit.",
        "default_due_days": "number — typical shelf-life from purchase (e.g. 7 for fresh, 365 for canned)",
        "due_type": "'best_before' | 'expiration'",
        "cooking_role": "'protein' | 'vegetable' | 'starch' | 'seasoning_system' | 'sauce' | 'produce' | 'form_factor_base' | 'other' | null",
        "nutrition": {
          "energy_kj": "number per 100g/mL or null",
          "energy_kcal": "number per 100g/mL or null",
          "fat": "number or null",
          "saturated_fat": "number or null",
          "carbohydrates": "number or null",
          "sugars": "number or null",
          "fibre": "number or null",
          "protein": "number or null",
          "salt": "number or null",
          "nutrition_grade": "'a'|'b'|'c'|'d'|'e' or null"
        }
      },
      "stock": {
        "amount": "number — quantity purchased",
        "unit_name": "string — unit that amount is measured in. MUST match UNITS or qu_purchase_name above.",
        "best_before_date": "'YYYY-MM-DD' or null",
        "price": "number or null — total paid (not per-unit)",
        "store_name": "string or null — where it was bought. MUST match STORES.",
        "location_name": "string or null — where it will be stored. MUST match LOCATIONS.",
        "note": "string or null"
      }
    }
  ]
}`;
