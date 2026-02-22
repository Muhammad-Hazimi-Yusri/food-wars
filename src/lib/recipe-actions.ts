import { createClient } from '@/lib/supabase/client';
import { getHouseholdId } from '@/lib/supabase/get-household';
import type { Recipe, RecipeIngredient, RecipeNesting, RecipeIngredientWithRelations, StockEntryWithProduct } from '@/types/database';
import { deleteRecipePicture } from '@/lib/supabase/storage';
import { consumeStock, undoConsume } from '@/lib/stock-actions';
import { computeRecipeFulfillment } from '@/lib/recipe-utils';

type ActionResult = {
  success: boolean;
  error?: string;
};

type CreateRecipeParams = {
  name: string;
  description?: string | null;
  instructions?: string | null;
  base_servings?: number;
  picture_file_name?: string | null;
};

type UpdateRecipeParams = Partial<CreateRecipeParams> & {
  desired_servings?: number;
  not_check_shoppinglist?: boolean;
  product_id?: string | null;
};

/**
 * Create a new recipe.
 */
export async function createRecipe(
  params: CreateRecipeParams
): Promise<ActionResult & { recipeId?: string }> {
  try {
    const supabase = createClient();
    const household = await getHouseholdId(supabase);
    if (!household.success) return { success: false, error: household.error };

    const { data, error } = await supabase
      .from('recipes')
      .insert({
        household_id: household.householdId,
        name: params.name,
        description: params.description ?? null,
        base_servings: params.base_servings ?? 1,
        picture_file_name: params.picture_file_name ?? null,
      })
      .select('id')
      .single();
    if (error) throw error;

    return { success: true, recipeId: data?.id };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to create recipe',
    };
  }
}

/**
 * Update an existing recipe.
 */
export async function updateRecipe(
  recipeId: string,
  params: UpdateRecipeParams
): Promise<ActionResult> {
  try {
    const supabase = createClient();

    const { error } = await supabase
      .from('recipes')
      .update(params)
      .eq('id', recipeId);
    if (error) throw error;

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update recipe',
    };
  }
}

/**
 * Delete a recipe. Returns a snapshot for undo.
 * Also deletes the recipe picture from storage if present.
 */
export async function deleteRecipe(
  recipeId: string
): Promise<ActionResult & { snapshot?: Recipe }> {
  try {
    const supabase = createClient();

    // Capture snapshot before delete (for undo)
    const { data: snapshot, error: fetchError } = await supabase
      .from('recipes')
      .select('*')
      .eq('id', recipeId)
      .single();
    if (fetchError) throw fetchError;

    // Delete picture from storage if present
    if (snapshot?.picture_file_name) {
      await deleteRecipePicture(snapshot.picture_file_name);
    }

    const { error } = await supabase
      .from('recipes')
      .delete()
      .eq('id', recipeId);
    if (error) throw error;

    return { success: true, snapshot: snapshot as Recipe };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to delete recipe',
    };
  }
}

// ============================================
// RECIPE INGREDIENT ACTIONS
// ============================================

type IngredientParams = {
  product_id?: string | null;
  amount: number;
  qu_id?: string | null;
  note?: string | null;
  ingredient_group?: string | null;
  variable_amount?: string | null;
  only_check_single_unit_in_stock?: boolean;
  not_check_stock_fulfillment?: boolean;
  price_factor?: number;
};

/**
 * Add an ingredient to a recipe.
 * Automatically assigns sort_order as max(existing) + 1.
 */
export async function addIngredient(
  recipeId: string,
  params: IngredientParams
): Promise<ActionResult & { ingredientId?: string }> {
  try {
    const supabase = createClient();
    const household = await getHouseholdId(supabase);
    if (!household.success) return { success: false, error: household.error };

    // Get current max sort_order
    const { data: existing } = await supabase
      .from('recipe_ingredients')
      .select('sort_order')
      .eq('recipe_id', recipeId)
      .order('sort_order', { ascending: false })
      .limit(1);
    const maxSort = existing?.[0]?.sort_order ?? -1;

    const { data, error } = await supabase
      .from('recipe_ingredients')
      .insert({
        household_id: household.householdId,
        recipe_id: recipeId,
        product_id: params.product_id ?? null,
        amount: params.amount,
        qu_id: params.qu_id ?? null,
        note: params.note ?? null,
        ingredient_group: params.ingredient_group ?? null,
        variable_amount: params.variable_amount ?? null,
        only_check_single_unit_in_stock: params.only_check_single_unit_in_stock ?? false,
        not_check_stock_fulfillment: params.not_check_stock_fulfillment ?? false,
        price_factor: params.price_factor ?? 1,
        sort_order: maxSort + 1,
      })
      .select('id')
      .single();
    if (error) throw error;

    return { success: true, ingredientId: data?.id };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to add ingredient',
    };
  }
}

/**
 * Update an existing ingredient.
 */
export async function updateIngredient(
  ingredientId: string,
  params: Partial<IngredientParams>
): Promise<ActionResult> {
  try {
    const supabase = createClient();

    const { error } = await supabase
      .from('recipe_ingredients')
      .update(params)
      .eq('id', ingredientId);
    if (error) throw error;

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update ingredient',
    };
  }
}

/**
 * Remove an ingredient. Returns snapshot for undo.
 */
export async function removeIngredient(
  ingredientId: string
): Promise<ActionResult & { snapshot?: RecipeIngredient }> {
  try {
    const supabase = createClient();

    const { data: snapshot, error: fetchError } = await supabase
      .from('recipe_ingredients')
      .select('*')
      .eq('id', ingredientId)
      .single();
    if (fetchError) throw fetchError;

    const { error } = await supabase
      .from('recipe_ingredients')
      .delete()
      .eq('id', ingredientId);
    if (error) throw error;

    return { success: true, snapshot: snapshot as RecipeIngredient };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to remove ingredient',
    };
  }
}

/**
 * Undo ingredient removal by re-inserting from snapshot.
 */
export async function undoRemoveIngredient(
  snapshot: RecipeIngredient
): Promise<ActionResult> {
  try {
    const supabase = createClient();

    const { error } = await supabase
      .from('recipe_ingredients')
      .insert({
        id: snapshot.id,
        household_id: snapshot.household_id,
        recipe_id: snapshot.recipe_id,
        product_id: snapshot.product_id,
        amount: snapshot.amount,
        qu_id: snapshot.qu_id,
        note: snapshot.note,
        ingredient_group: snapshot.ingredient_group,
        variable_amount: snapshot.variable_amount,
        only_check_single_unit_in_stock: snapshot.only_check_single_unit_in_stock,
        not_check_stock_fulfillment: snapshot.not_check_stock_fulfillment,
        price_factor: snapshot.price_factor,
        sort_order: snapshot.sort_order,
      });
    if (error) throw error;

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to undo remove',
    };
  }
}

/**
 * Reorder ingredients by updating sort_order for each ID in the given order.
 */
export async function reorderIngredients(
  ingredientIds: string[]
): Promise<ActionResult> {
  try {
    const supabase = createClient();

    for (let i = 0; i < ingredientIds.length; i++) {
      const { error } = await supabase
        .from('recipe_ingredients')
        .update({ sort_order: i })
        .eq('id', ingredientIds[i]);
      if (error) throw error;
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to reorder ingredients',
    };
  }
}

// ============================================
// RECIPE CONSUMPTION
// ============================================

/**
 * Consume stock for all fulfilled, checkable ingredients in a recipe.
 * Uses a shared correlation_id so the entire cook can be undone at once.
 */
export async function consumeRecipe(
  recipe: Recipe,
  ingredients: RecipeIngredientWithRelations[],
  desiredServings: number
): Promise<ActionResult & { correlationId?: string }> {
  try {
    const supabase = createClient();

    // Collect product IDs that should be consumed
    const consumableIngredients = ingredients.filter(
      (i) =>
        i.product_id &&
        !i.not_check_stock_fulfillment &&
        !i.product?.not_check_stock_fulfillment_for_recipes
    );

    if (consumableIngredients.length === 0) {
      return { success: true };
    }

    const productIds = [...new Set(consumableIngredients.map((i) => i.product_id!))];

    // Fetch stock entries with product join (needed by consumeStock's auto-add logic)
    const { data: stockData, error: stockError } = await supabase
      .from('stock_entries')
      .select('*, product:products(*)')
      .in('product_id', productIds);
    if (stockError) throw stockError;

    const stockEntries = (stockData ?? []) as StockEntryWithProduct[];

    // Group entries by product_id
    const byProduct = new Map<string, StockEntryWithProduct[]>();
    for (const entry of stockEntries) {
      const arr = byProduct.get(entry.product_id) ?? [];
      arr.push(entry);
      byProduct.set(entry.product_id, arr);
    }

    // Build totals map for fulfillment check
    const stockByProduct = new Map<string, number>();
    for (const [pid, entries] of byProduct) {
      stockByProduct.set(pid, entries.reduce((sum, e) => sum + e.amount, 0));
    }

    const fulfillment = computeRecipeFulfillment(
      ingredients,
      stockByProduct,
      recipe.base_servings,
      desiredServings
    );

    const sharedCorrelationId = crypto.randomUUID();

    for (const f of fulfillment.ingredients) {
      if (f.skipped || !f.fulfilled || !f.productId) continue;

      const entries = byProduct.get(f.productId) ?? [];
      if (entries.length === 0) continue;

      const result = await consumeStock(f.productId, entries, f.needed, {
        correlationId: sharedCorrelationId,
        recipeId: recipe.id,
      });
      if (!result.success) throw new Error(result.error);
    }

    // If this recipe produces a product, add a stock entry for it
    if (recipe.product_id) {
      const hhResult = await getHouseholdId(supabase);
      if (!hhResult.success) throw new Error(hhResult.error);
      const today = new Date().toISOString().split('T')[0];
      await supabase.from('stock_entries').insert({
        household_id: hhResult.householdId,
        product_id: recipe.product_id,
        amount: desiredServings,
        purchased_date: today,
        best_before_date: null,
        price: null,
        location_id: null,
        shopping_location_id: null,
        open: false,
        opened_date: null,
        stock_id: crypto.randomUUID(),
        note: `Produced by recipe cook`,
      });
    }

    return { success: true, correlationId: sharedCorrelationId };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to consume recipe',
    };
  }
}

/**
 * Undo a recipe consumption by correlation ID.
 */
export async function undoConsumeRecipe(
  correlationId: string
): Promise<ActionResult> {
  return undoConsume(correlationId);
}

type MissingIngredient = {
  productId: string;
  amount: number;
  quId: string | null;
};

/**
 * Add missing recipe ingredients to a shopping list.
 * Increments existing undone items for the same product, inserts new ones otherwise.
 */
export async function addMissingToShoppingList(
  missing: MissingIngredient[],
  shoppingListId: string
): Promise<ActionResult> {
  try {
    const supabase = createClient();
    const household = await getHouseholdId(supabase);
    if (!household.success) return { success: false, error: household.error };
    const { householdId } = household;

    // Fetch existing undone items for duplicate detection
    const { data: existingData } = await supabase
      .from('shopping_list_items')
      .select('id, product_id, amount, sort_order')
      .eq('shopping_list_id', shoppingListId)
      .eq('done', false);

    const items = (existingData ?? []) as {
      id: string;
      product_id: string | null;
      amount: number;
      sort_order: number;
    }[];

    for (const m of missing) {
      const existingItem = items.find((i) => i.product_id === m.productId);
      if (existingItem) {
        await supabase
          .from('shopping_list_items')
          .update({ amount: existingItem.amount + m.amount })
          .eq('id', existingItem.id);
        existingItem.amount += m.amount;
      } else {
        const maxSort = items.reduce((max, i) => Math.max(max, i.sort_order), -1);
        await supabase.from('shopping_list_items').insert({
          household_id: householdId,
          shopping_list_id: shoppingListId,
          product_id: m.productId,
          amount: m.amount,
          qu_id: m.quId,
          sort_order: maxSort + 1,
          note: null,
        });
        items.push({ id: '', product_id: m.productId, amount: m.amount, sort_order: maxSort + 1 });
      }
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to add to shopping list',
    };
  }
}

/**
 * Undo a recipe deletion by re-inserting from snapshot.
 */
export async function undoDeleteRecipe(
  snapshot: Recipe
): Promise<ActionResult> {
  try {
    const supabase = createClient();

    const { error } = await supabase
      .from('recipes')
      .insert({
        id: snapshot.id,
        household_id: snapshot.household_id,
        name: snapshot.name,
        description: snapshot.description,
        picture_file_name: snapshot.picture_file_name,
        base_servings: snapshot.base_servings,
        desired_servings: snapshot.desired_servings,
        not_check_shoppinglist: snapshot.not_check_shoppinglist,
        product_id: snapshot.product_id,
      });
    if (error) throw error;

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to undo delete',
    };
  }
}

// ============================================
// RECIPE NESTING ACTIONS
// ============================================

/**
 * Add a nested recipe to a recipe.
 */
export async function addNestedRecipe(
  recipeId: string,
  includesRecipeId: string,
  servings: number
): Promise<ActionResult & { nestingId?: string }> {
  try {
    const supabase = createClient();
    const household = await getHouseholdId(supabase);
    if (!household.success) return { success: false, error: household.error };

    const { data, error } = await supabase
      .from('recipe_nestings')
      .insert({
        household_id: household.householdId,
        recipe_id: recipeId,
        includes_recipe_id: includesRecipeId,
        servings,
      })
      .select('id')
      .single();
    if (error) throw error;

    return { success: true, nestingId: data?.id };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to add nested recipe',
    };
  }
}

/**
 * Update the servings for a recipe nesting.
 */
export async function updateNestedRecipe(
  nestingId: string,
  servings: number
): Promise<ActionResult> {
  try {
    const supabase = createClient();
    const { error } = await supabase
      .from('recipe_nestings')
      .update({ servings })
      .eq('id', nestingId);
    if (error) throw error;
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update nesting',
    };
  }
}

/**
 * Remove a nested recipe. Returns snapshot for undo.
 */
export async function removeNestedRecipe(
  nestingId: string
): Promise<ActionResult & { snapshot?: RecipeNesting }> {
  try {
    const supabase = createClient();

    const { data: snapshot, error: fetchError } = await supabase
      .from('recipe_nestings')
      .select('*')
      .eq('id', nestingId)
      .single();
    if (fetchError) throw fetchError;

    const { error } = await supabase
      .from('recipe_nestings')
      .delete()
      .eq('id', nestingId);
    if (error) throw error;

    return { success: true, snapshot: snapshot as RecipeNesting };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to remove nested recipe',
    };
  }
}

/**
 * Undo a nested recipe removal.
 */
export async function undoRemoveNestedRecipe(
  snapshot: RecipeNesting
): Promise<ActionResult> {
  try {
    const supabase = createClient();
    const { error } = await supabase.from('recipe_nestings').insert({
      id: snapshot.id,
      household_id: snapshot.household_id,
      recipe_id: snapshot.recipe_id,
      includes_recipe_id: snapshot.includes_recipe_id,
      servings: snapshot.servings,
    });
    if (error) throw error;
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to undo nesting remove',
    };
  }
}

/**
 * Set or clear the product that this recipe produces on cook.
 */
export async function setProducesProduct(
  recipeId: string,
  productId: string | null
): Promise<ActionResult> {
  try {
    const supabase = createClient();
    const { error } = await supabase
      .from('recipes')
      .update({ product_id: productId })
      .eq('id', recipeId);
    if (error) throw error;
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to set produces product',
    };
  }
}

// ============================================
// AI CHAT ACTIONS
// ============================================

/**
 * Compute missing ingredients for a recipe and add them to the household's
 * default shopping list (is_auto_target, or first list alphabetically).
 * Used by the AI chat widget "add missing to shopping list" action.
 */
export async function addRecipeMissingToDefaultList(
  recipeId: string
): Promise<ActionResult & { addedCount?: number; listName?: string }> {
  try {
    const supabase = createClient();
    const household = await getHouseholdId(supabase);
    if (!household.success) return { success: false, error: household.error };

    // Find default shopping list
    const { data: listsData } = await supabase
      .from('shopping_lists')
      .select('id, name, is_auto_target')
      .order('name');
    const lists = (listsData ?? []) as { id: string; name: string; is_auto_target: boolean }[];
    if (lists.length === 0) return { success: false, error: 'No shopping lists found. Create one first.' };
    const targetList = lists.find((l) => l.is_auto_target) ?? lists[0];

    // Fetch recipe base servings
    const { data: recipeData } = await supabase
      .from('recipes')
      .select('id, base_servings')
      .eq('id', recipeId)
      .single();
    if (!recipeData) return { success: false, error: 'Recipe not found' };

    // Fetch ingredients with product + unit joins
    const { data: ingredientsData } = await supabase
      .from('recipe_ingredients')
      .select('*, product:products(id, name, qu_id_stock, not_check_stock_fulfillment_for_recipes), qu:quantity_units(id, name, name_plural)')
      .eq('recipe_id', recipeId);
    const ingredients = (ingredientsData ?? []) as RecipeIngredientWithRelations[];

    // Fetch stock for relevant products only
    const productIds = ingredients
      .map((i) => i.product_id)
      .filter((id): id is string => id !== null);
    const { data: stockData } = productIds.length > 0
      ? await supabase.from('stock_entries').select('product_id, amount').in('product_id', productIds)
      : { data: [] };

    const stockByProduct = new Map<string, number>();
    for (const entry of (stockData ?? []) as { product_id: string; amount: number }[]) {
      stockByProduct.set(entry.product_id, (stockByProduct.get(entry.product_id) ?? 0) + entry.amount);
    }

    const fulfillment = computeRecipeFulfillment(
      ingredients,
      stockByProduct,
      recipeData.base_servings,
      recipeData.base_servings,
    );

    const missing = fulfillment.ingredients
      .filter((f) => !f.skipped && !f.fulfilled && f.productId)
      .map((f) => {
        const ing = ingredients.find((i) => i.id === f.ingredientId);
        return { productId: f.productId!, amount: f.missing, quId: ing?.qu_id ?? null };
      });

    if (missing.length === 0) {
      return { success: true, addedCount: 0, listName: targetList.name };
    }

    const result = await addMissingToShoppingList(missing, targetList.id);
    if (!result.success) return result;

    return { success: true, addedCount: missing.length, listName: targetList.name };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to add missing ingredients',
    };
  }
}
