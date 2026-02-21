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

// ============================================
// NESTING + DUE SCORE
// ============================================

type NestingRef = {
  includes_recipe_id: string;
  servings: number;
};

/**
 * Flatten nested recipe ingredients into a scaled list.
 * Recursively resolves sub-recipes; visited set prevents infinite loops.
 * Returns ingredients with amounts already scaled to the parent recipe's desired servings.
 */
export function flattenNestedIngredients(
  nestings: NestingRef[],
  ingredientsByRecipe: Map<string, RecipeIngredientWithRelations[]>,
  nestingsByRecipe: Map<string, NestingRef[]>,
  baseServingsByRecipe: Map<string, number>,
  parentBaseServings: number,
  desiredServings: number,
  visited: Set<string> = new Set()
): RecipeIngredientWithRelations[] {
  const result: RecipeIngredientWithRelations[] = [];

  for (const nesting of nestings) {
    const includesId = nesting.includes_recipe_id;
    if (visited.has(includesId)) continue; // cycle guard

    const includedBaseServings = baseServingsByRecipe.get(includesId) ?? 1;
    // Scale factor: how many times the included recipe runs (relative to parent base)
    const nestingScale =
      (nesting.servings / includedBaseServings) * (desiredServings / parentBaseServings);

    // Scale the included recipe's own ingredients
    const ownIngredients = ingredientsByRecipe.get(includesId) ?? [];
    for (const ing of ownIngredients) {
      result.push({
        ...ing,
        amount: ing.amount * nestingScale,
      });
    }

    // Recurse into sub-nestings
    const subNestings = nestingsByRecipe.get(includesId) ?? [];
    if (subNestings.length > 0) {
      const nextVisited = new Set([...visited, includesId]);
      const nested = flattenNestedIngredients(
        subNestings,
        ingredientsByRecipe,
        nestingsByRecipe,
        baseServingsByRecipe,
        includedBaseServings,
        nesting.servings * (desiredServings / parentBaseServings),
        nextVisited
      );
      result.push(...nested);
    }
  }

  return result;
}

/**
 * Compute a due-urgency score for a recipe.
 * Higher score = more ingredients expiring soon (better to cook now).
 * Uses only stock entries for products that appear in the recipe.
 */
export function computeDueScore(
  ingredients: { product_id: string | null }[],
  stockEntries: { product_id: string; best_before_date: string | null }[],
  today: string // YYYY-MM-DD
): number {
  const relevantIds = new Set(
    ingredients.map((i) => i.product_id).filter((id): id is string => id !== null)
  );

  let score = 0;
  for (const entry of stockEntries) {
    if (!relevantIds.has(entry.product_id) || !entry.best_before_date) continue;

    const days = Math.floor(
      (new Date(entry.best_before_date).getTime() - new Date(today).getTime()) /
        (1000 * 60 * 60 * 24)
    );

    if (days < 0) score += 100;       // expired
    else if (days === 0) score += 50; // expires today
    else if (days <= 3) score += 20;  // 1–3 days
    else if (days <= 7) score += 5;   // 4–7 days
  }

  return score;
}

// ============================================
// STOCK FULFILLMENT
// ============================================

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
