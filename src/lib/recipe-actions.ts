import { createClient } from '@/lib/supabase/client';
import { getHouseholdId } from '@/lib/supabase/get-household';
import type { Recipe } from '@/types/database';
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
