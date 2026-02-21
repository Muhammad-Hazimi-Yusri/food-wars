import { createClient } from '@/lib/supabase/client';
import { getHouseholdId } from '@/lib/supabase/get-household';
import type { Recipe, RecipeIngredient } from '@/types/database';
import { deleteRecipePicture } from '@/lib/supabase/storage';

type ActionResult = {
  success: boolean;
  error?: string;
};

type CreateRecipeParams = {
  name: string;
  description?: string | null;
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
