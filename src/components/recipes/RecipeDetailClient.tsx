"use client";

import { useState } from "react";
import { ServingScaler } from "@/components/recipes/ServingScaler";
import { RecipeIngredientsClient } from "@/components/recipes/RecipeIngredientsClient";
import { RecipeFulfillment } from "@/components/recipes/RecipeFulfillment";
import { updateRecipe } from "@/lib/recipe-actions";
import type {
  Recipe,
  RecipeIngredientWithRelations,
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
};

export function RecipeDetailClient({
  recipe,
  initialIngredients,
  products,
  quantityUnits,
  stockByProduct,
  shoppingLists,
}: Props) {
  const [desiredServings, setDesiredServings] = useState(recipe.desired_servings);

  const handleServingChange = async (value: number) => {
    setDesiredServings(value);
    await updateRecipe(recipe.id, { desired_servings: value });
  };

  return (
    <div className="space-y-4">
      {/* Serving scaler (only shown when ingredients exist) */}
      {initialIngredients.length > 0 && (
        <ServingScaler
          baseServings={recipe.base_servings}
          desiredServings={desiredServings}
          onChange={handleServingChange}
        />
      )}

      {/* Stock fulfillment + cook action */}
      <RecipeFulfillment
        recipe={recipe}
        ingredients={initialIngredients}
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
    </div>
  );
}
