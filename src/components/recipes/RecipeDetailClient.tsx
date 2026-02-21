"use client";

import { useState, useMemo } from "react";
import { ServingScaler } from "@/components/recipes/ServingScaler";
import { RecipeIngredientsClient } from "@/components/recipes/RecipeIngredientsClient";
import { RecipeFulfillment } from "@/components/recipes/RecipeFulfillment";
import { RecipeNestingClient } from "@/components/recipes/RecipeNestingClient";
import { ProducesProduct } from "@/components/recipes/ProducesProduct";
import { updateRecipe } from "@/lib/recipe-actions";
import { flattenNestedIngredients } from "@/lib/recipe-utils";
import type {
  Recipe,
  RecipeIngredientWithRelations,
  RecipeNestingWithRelations,
  Product,
  QuantityUnit,
  ShoppingList,
} from "@/types/database";

type Props = {
  recipe: Recipe;
  initialIngredients: RecipeIngredientWithRelations[];
  products: Product[];
  quantityUnits: QuantityUnit[];
  /** product_id → total amount in stock */
  stockByProduct: Record<string, number>;
  shoppingLists: ShoppingList[];
  nestings: RecipeNestingWithRelations[];
  allRecipes: Pick<Recipe, "id" | "name" | "base_servings">[];
  /** All household recipe_ingredients, keyed by recipe_id (for nested fulfillment) */
  allIngredientsByRecipe: Record<string, RecipeIngredientWithRelations[]>;
  initialProducesProductName: string | null;
};

export function RecipeDetailClient({
  recipe,
  initialIngredients,
  products,
  quantityUnits,
  stockByProduct,
  shoppingLists,
  nestings,
  allRecipes,
  allIngredientsByRecipe,
  initialProducesProductName,
}: Props) {
  const [desiredServings, setDesiredServings] = useState(recipe.desired_servings);

  const handleServingChange = async (value: number) => {
    setDesiredServings(value);
    await updateRecipe(recipe.id, { desired_servings: value });
  };

  // Build maps for flattenNestedIngredients
  const ingredientsByRecipe = useMemo(
    () => new Map(Object.entries(allIngredientsByRecipe)),
    [allIngredientsByRecipe]
  );

  const nestingsByRecipe = useMemo(() => {
    const map = new Map<string, { includes_recipe_id: string; servings: number }[]>();
    for (const recipe of allRecipes) {
      map.set(recipe.id, []);
    }
    // Note: we only have nestings for the current recipe from the page
    // For nested nestings, we'd need all household nestings (future enhancement)
    for (const n of nestings) {
      map.set(recipe.id, [...(map.get(recipe.id) ?? []), {
        includes_recipe_id: n.includes_recipe_id,
        servings: n.servings,
      }]);
    }
    return map;
  }, [nestings, allRecipes, recipe.id]);

  const baseServingsByRecipe = useMemo(
    () => new Map(allRecipes.map((r) => [r.id, r.base_servings])),
    [allRecipes]
  );

  // Flatten nested ingredients (scaled to current desired servings)
  const nestedIngredients = useMemo(
    () =>
      flattenNestedIngredients(
        nestings.map((n) => ({
          includes_recipe_id: n.includes_recipe_id,
          servings: n.servings,
        })),
        ingredientsByRecipe,
        nestingsByRecipe,
        baseServingsByRecipe,
        recipe.base_servings,
        desiredServings
      ),
    [nestings, ingredientsByRecipe, nestingsByRecipe, baseServingsByRecipe, recipe.base_servings, desiredServings]
  );

  // Combined ingredients for fulfillment.
  // nestedIngredients amounts are already scaled to desiredServings by flattenNestedIngredients,
  // but computeRecipeFulfillment applies its own scaling (desired/base). Normalize nested
  // amounts back to base scale so they aren't double-scaled.
  const allIngredientsForFulfillment = useMemo(() => {
    if (nestedIngredients.length === 0) return initialIngredients;
    const normFactor =
      desiredServings > 0 ? recipe.base_servings / desiredServings : 1;
    const normalizedNested = nestedIngredients.map((ing) => ({
      ...ing,
      amount: ing.amount * normFactor,
    }));
    return [...initialIngredients, ...normalizedNested];
  }, [initialIngredients, nestedIngredients, recipe.base_servings, desiredServings]);

  const hasContent = initialIngredients.length > 0 || nestings.length > 0;

  return (
    <div className="space-y-4">
      {/* Serving scaler */}
      {hasContent && (
        <ServingScaler
          baseServings={recipe.base_servings}
          desiredServings={desiredServings}
          onChange={handleServingChange}
        />
      )}

      {/* Stock fulfillment + cook action */}
      <RecipeFulfillment
        recipe={recipe}
        ingredients={allIngredientsForFulfillment}
        ownIngredients={initialIngredients}
        stockByProduct={stockByProduct}
        shoppingLists={shoppingLists}
        desiredServings={desiredServings}
      />

      {/* Ingredient list with DnD */}
      <RecipeIngredientsClient
        recipe={recipe}
        initialIngredients={initialIngredients}
        products={products}
        quantityUnits={quantityUnits}
        desiredServings={desiredServings}
      />

      {/* Sub-recipes */}
      <RecipeNestingClient
        recipe={recipe}
        initialNestings={nestings}
        allRecipes={allRecipes}
      />

      {/* Produces product */}
      <ProducesProduct
        recipeId={recipe.id}
        initialProductId={recipe.product_id}
        initialProductName={initialProducesProductName}
        products={products.map((p) => ({ id: p.id, name: p.name }))}
      />
    </div>
  );
}
