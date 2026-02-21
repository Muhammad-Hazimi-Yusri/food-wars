/**
 * Pure utility functions for recipe calculations.
 * No Supabase or server-side dependencies — safe to import in client components.
 */

import type { RecipeIngredientWithRelations } from "@/types/database";

export function scaleAmount(
  amount: number,
  baseServings: number,
  desiredServings: number
): number {
  if (baseServings <= 0) return amount;
  return amount * (desiredServings / baseServings);
}

export function formatScaledAmount(scaled: number): string {
  // Round to at most 2 decimal places, drop trailing zeros
  return parseFloat(scaled.toFixed(2)).toString();
}

// ============================================
// STOCK FULFILLMENT
// ============================================

export type IngredientFulfillment = {
  ingredientId: string;
  productId: string | null;
  needed: number;
  inStock: number;
  missing: number;
  fulfilled: boolean;
  skipped: boolean;
};

export type RecipeFulfillmentResult = {
  ingredients: IngredientFulfillment[];
  canMake: boolean;
  fulfillmentRatio: number; // 0–1
};

/**
 * Compute per-ingredient fulfillment given a stock totals map.
 * stockByProduct: product_id → total amount in stock
 * Skips ingredients with not_check_stock_fulfillment or no product_id.
 */
export function computeRecipeFulfillment(
  ingredients: RecipeIngredientWithRelations[],
  stockByProduct: Map<string, number>,
  baseServings: number,
  desiredServings: number
): RecipeFulfillmentResult {
  const results: IngredientFulfillment[] = [];

  for (const ing of ingredients) {
    const skipped =
      ing.not_check_stock_fulfillment ||
      !ing.product_id ||
      (ing.product?.not_check_stock_fulfillment_for_recipes ?? false);

    if (skipped) {
      results.push({
        ingredientId: ing.id,
        productId: ing.product_id,
        needed: 0,
        inStock: 0,
        missing: 0,
        fulfilled: true,
        skipped: true,
      });
      continue;
    }

    const needed = scaleAmount(ing.amount, baseServings, desiredServings);
    const inStock = stockByProduct.get(ing.product_id!) ?? 0;
    const missing = Math.max(0, needed - inStock);
    const fulfilled = missing <= 0;

    results.push({
      ingredientId: ing.id,
      productId: ing.product_id,
      needed,
      inStock,
      missing,
      fulfilled,
      skipped: false,
    });
  }

  const checkable = results.filter((r) => !r.skipped);
  const fulfilledCount = checkable.filter((r) => r.fulfilled).length;
  const fulfillmentRatio =
    checkable.length === 0 ? 1 : fulfilledCount / checkable.length;
  const canMake = checkable.every((r) => r.fulfilled);

  return { ingredients: results, canMake, fulfillmentRatio };
}
