/**
 * Pure utility functions for meal plan calculations.
 * No Supabase or server-side dependencies — safe to import anywhere.
 */

import type { RecipeIngredientWithRelations } from "@/types/database";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Minimal shape of a meal plan entry needed for aggregation */
export type EntryForAggregation = {
  type: string;
  recipe_id: string | null;
  recipe_servings: number | null;
};

/** A consolidated missing ingredient across all recipes in a week */
export type AggregatedIngredient = {
  productId: string;
  /** Total amount still needed after subtracting current stock */
  amount: number;
  quId: string | null;
};

// ---------------------------------------------------------------------------
// aggregateWeekIngredients
// ---------------------------------------------------------------------------

/**
 * Aggregate ingredient requirements from a week's recipe meal plan entries.
 *
 * For each recipe entry:
 *  - Scales ingredient amounts by `recipe_servings / base_servings`
 *  - Skips: variable_amount ingredients, not_check_stock_fulfillment, no product_id
 *
 * Consolidates duplicate product × qu_id combinations.
 * Subtracts current stock; returns only items with a positive deficit, sorted
 * by productId (caller can sort by name using a product lookup if desired).
 */
export function aggregateWeekIngredients(
  entries: EntryForAggregation[],
  ingredientsByRecipe: Map<string, RecipeIngredientWithRelations[]>,
  stockByProduct: Map<string, number>,
  baseServingsByRecipe: Map<string, number>
): AggregatedIngredient[] {
  // Accumulate total needed amounts keyed by `productId:quId`
  const totals = new Map<
    string,
    { productId: string; quId: string | null; amount: number }
  >();

  for (const entry of entries) {
    if (entry.type !== "recipe" || !entry.recipe_id) continue;

    const ings = ingredientsByRecipe.get(entry.recipe_id) ?? [];
    const base = baseServingsByRecipe.get(entry.recipe_id) ?? 1;
    const desired = entry.recipe_servings ?? base;
    const scale = base > 0 ? desired / base : 1;

    for (const ing of ings) {
      // Skip ingredients that bypass stock checks
      if (ing.not_check_stock_fulfillment) continue;
      if (!ing.product_id) continue;
      if (ing.product?.not_check_stock_fulfillment_for_recipes) continue;
      // Skip "to taste" / variable amount ingredients
      if (ing.variable_amount) continue;

      const key = `${ing.product_id}:${ing.qu_id ?? "__none__"}`;
      const scaled = (ing.amount ?? 0) * scale;

      const existing = totals.get(key);
      if (existing) {
        existing.amount += scaled;
      } else {
        totals.set(key, {
          productId: ing.product_id,
          quId: ing.qu_id ?? null,
          amount: scaled,
        });
      }
    }
  }

  // Subtract stock; keep only items with a deficit
  const missing: AggregatedIngredient[] = [];
  for (const { productId, quId, amount } of totals.values()) {
    const inStock = stockByProduct.get(productId) ?? 0;
    const deficit = amount - inStock;
    if (deficit > 0) {
      missing.push({ productId, quId, amount: deficit });
    }
  }

  return missing.sort((a, b) => a.productId.localeCompare(b.productId));
}
