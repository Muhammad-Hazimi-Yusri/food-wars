import { COOKING_ROLE_TO_BUCKET } from "@/lib/constants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ComboProduct = {
  id: string;
  name: string;
  cooking_role: string;
  earliest_expiry: string | null;
};

export type ComboSuggestion = {
  protein: ComboProduct;
  seasoning: ComboProduct;
  base?: ComboProduct;
};

// ---------------------------------------------------------------------------
// Quick combo generation
// ---------------------------------------------------------------------------

/** Sort comparator: earliest expiry first, nulls last. */
function byExpiryAsc(a: ComboProduct, b: ComboProduct): number {
  if (a.earliest_expiry === b.earliest_expiry) return 0;
  if (!a.earliest_expiry) return 1;
  if (!b.earliest_expiry) return -1;
  return a.earliest_expiry.localeCompare(b.earliest_expiry);
}

/**
 * Generate up to 3 quick combo suggestions from in-stock tagged products.
 *
 * Each combo = 1 protein/produce + 1 seasoning_system + 1 form_factor_base (if available).
 * Items expiring soonest are prioritised. Each product is used at most once.
 *
 * Pure function — no side-effects, fully deterministic for the same input order.
 */
export function generateQuickCombos(products: ComboProduct[]): ComboSuggestion[] {
  const proteins: ComboProduct[] = [];
  const seasonings: ComboProduct[] = [];
  const bases: ComboProduct[] = [];

  for (const p of products) {
    const bucket = COOKING_ROLE_TO_BUCKET[p.cooking_role];
    if (bucket === "protein" || bucket === "produce") {
      proteins.push(p);
    } else if (bucket === "seasoning_system") {
      seasonings.push(p);
    } else if (bucket === "form_factor_base") {
      bases.push(p);
    }
  }

  proteins.sort(byExpiryAsc);
  seasonings.sort(byExpiryAsc);
  bases.sort(byExpiryAsc);

  const combos: ComboSuggestion[] = [];
  const maxCombos = Math.min(3, proteins.length, seasonings.length);

  for (let i = 0; i < maxCombos; i++) {
    const combo: ComboSuggestion = {
      protein: proteins[i],
      seasoning: seasonings[i],
    };
    if (bases[i]) {
      combo.base = bases[i];
    }
    combos.push(combo);
  }

  return combos;
}
