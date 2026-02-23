import { createClient } from '@/lib/supabase/client';
import { getHouseholdId } from '@/lib/supabase/get-household';
import type { MealPlanEntry } from '@/types/database';

type ActionResult = {
  success: boolean;
  error?: string;
};

export type AddMealPlanEntryParams = {
  day: string; // YYYY-MM-DD
  type: 'recipe' | 'product' | 'note';
  section_id: string | null;
  recipe_id?: string | null;
  recipe_servings?: number | null;
  product_id?: string | null;
  product_amount?: number | null;
  product_qu_id?: string | null;
  note?: string | null;
};

/**
 * Add a new meal plan entry for the given day + section.
 * sort_order is set to max+1 within the day×section slot.
 */
export async function addMealPlanEntry(
  params: AddMealPlanEntryParams
): Promise<ActionResult & { entryId?: string }> {
  try {
    const supabase = createClient();
    const household = await getHouseholdId(supabase);
    if (!household.success) return { success: false, error: household.error };

    // Compute next sort_order for this day×section slot
    const { data: existing } = await supabase
      .from('meal_plan')
      .select('sort_order')
      .eq('household_id', household.householdId)
      .eq('day', params.day)
      .eq('section_id', params.section_id ?? '')
      .order('sort_order', { ascending: false })
      .limit(1);

    const nextOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0;

    const { data, error } = await supabase
      .from('meal_plan')
      .insert({
        household_id: household.householdId,
        day: params.day,
        type: params.type,
        section_id: params.section_id ?? null,
        recipe_id: params.recipe_id ?? null,
        recipe_servings: params.recipe_servings ?? null,
        product_id: params.product_id ?? null,
        product_amount: params.product_amount ?? null,
        product_qu_id: params.product_qu_id ?? null,
        note: params.note ?? null,
        sort_order: nextOrder,
      })
      .select('id')
      .single();

    if (error) throw error;

    return { success: true, entryId: data?.id };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to add meal plan entry',
    };
  }
}

/**
 * Remove a meal plan entry, returning a snapshot for undo.
 */
export async function removeMealPlanEntry(
  id: string
): Promise<ActionResult & { snapshot?: MealPlanEntry }> {
  try {
    const supabase = createClient();
    const household = await getHouseholdId(supabase);
    if (!household.success) return { success: false, error: household.error };

    // Fetch snapshot before deletion
    const { data: snapshot, error: fetchError } = await supabase
      .from('meal_plan')
      .select('*')
      .eq('id', id)
      .eq('household_id', household.householdId)
      .single();

    if (fetchError) throw fetchError;

    const { error } = await supabase
      .from('meal_plan')
      .delete()
      .eq('id', id)
      .eq('household_id', household.householdId);

    if (error) throw error;

    return { success: true, snapshot: snapshot as MealPlanEntry };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to remove meal plan entry',
    };
  }
}

/**
 * Restore a previously deleted meal plan entry using its snapshot.
 * Re-inserts with the original ID to maintain referential integrity.
 */
export async function undoRemoveMealPlanEntry(
  snapshot: MealPlanEntry
): Promise<ActionResult> {
  try {
    const supabase = createClient();
    const household = await getHouseholdId(supabase);
    if (!household.success) return { success: false, error: household.error };

    const { error } = await supabase.from('meal_plan').insert({
      id: snapshot.id,
      household_id: household.householdId,
      day: snapshot.day,
      type: snapshot.type,
      section_id: snapshot.section_id,
      recipe_id: snapshot.recipe_id,
      recipe_servings: snapshot.recipe_servings,
      product_id: snapshot.product_id,
      product_amount: snapshot.product_amount,
      product_qu_id: snapshot.product_qu_id,
      note: snapshot.note,
      sort_order: snapshot.sort_order,
    });

    if (error) throw error;

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to undo removal',
    };
  }
}

/**
 * Reorder entries within a day×section slot.
 * Takes an ordered array of entry IDs and assigns sequential sort_order values.
 */
export async function reorderMealPlanEntries(
  ids: string[]
): Promise<ActionResult> {
  try {
    const supabase = createClient();
    const household = await getHouseholdId(supabase);
    if (!household.success) return { success: false, error: household.error };

    for (let i = 0; i < ids.length; i++) {
      const { error } = await supabase
        .from('meal_plan')
        .update({ sort_order: i })
        .eq('id', ids[i])
        .eq('household_id', household.householdId);
      if (error) throw error;
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to reorder entries',
    };
  }
}

/**
 * Update fields on an existing meal plan entry.
 * Used for servings edits and DnD moves (day/section/sort_order).
 */
export async function updateMealPlanEntry(
  id: string,
  params: Partial<AddMealPlanEntryParams> & { sort_order?: number }
): Promise<ActionResult> {
  try {
    const supabase = createClient();
    const household = await getHouseholdId(supabase);
    if (!household.success) return { success: false, error: household.error };

    const { error } = await supabase
      .from('meal_plan')
      .update(params)
      .eq('id', id)
      .eq('household_id', household.householdId);

    if (error) throw error;

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update meal plan entry',
    };
  }
}

// ---------------------------------------------------------------------------
// Section actions
// ---------------------------------------------------------------------------

export type SectionParams = {
  name: string;
  time?: string | null;
};

/**
 * Add a new meal plan section at the end of the sort order.
 */
export async function addMealPlanSection(
  params: SectionParams
): Promise<ActionResult & { sectionId?: string }> {
  try {
    const supabase = createClient();
    const household = await getHouseholdId(supabase);
    if (!household.success) return { success: false, error: household.error };

    const { data: existing } = await supabase
      .from('meal_plan_sections')
      .select('sort_order')
      .eq('household_id', household.householdId)
      .order('sort_order', { ascending: false })
      .limit(1);

    const nextOrder =
      existing && existing.length > 0 ? existing[0].sort_order + 1 : 0;

    const { data, error } = await supabase
      .from('meal_plan_sections')
      .insert({
        household_id: household.householdId,
        name: params.name,
        time: params.time ?? null,
        sort_order: nextOrder,
      })
      .select('id')
      .single();

    if (error) throw error;

    return { success: true, sectionId: data?.id };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to add section',
    };
  }
}

/**
 * Update name and/or time of a meal plan section.
 */
export async function updateMealPlanSection(
  id: string,
  params: Partial<SectionParams>
): Promise<ActionResult> {
  try {
    const supabase = createClient();
    const household = await getHouseholdId(supabase);
    if (!household.success) return { success: false, error: household.error };

    const { error } = await supabase
      .from('meal_plan_sections')
      .update(params)
      .eq('id', id)
      .eq('household_id', household.householdId);

    if (error) throw error;

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update section',
    };
  }
}

/**
 * Delete a meal plan section.
 * Entries assigned to this section will have section_id set to NULL (ON DELETE SET NULL).
 */
export async function removeMealPlanSection(id: string): Promise<ActionResult> {
  try {
    const supabase = createClient();
    const household = await getHouseholdId(supabase);
    if (!household.success) return { success: false, error: household.error };

    const { error } = await supabase
      .from('meal_plan_sections')
      .delete()
      .eq('id', id)
      .eq('household_id', household.householdId);

    if (error) throw error;

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to remove section',
    };
  }
}

/**
 * Reorder sections by assigning sequential sort_order values.
 */
export async function reorderMealPlanSections(
  ids: string[]
): Promise<ActionResult> {
  try {
    const supabase = createClient();
    const household = await getHouseholdId(supabase);
    if (!household.success) return { success: false, error: household.error };

    for (let i = 0; i < ids.length; i++) {
      const { error } = await supabase
        .from('meal_plan_sections')
        .update({ sort_order: i })
        .eq('id', ids[i])
        .eq('household_id', household.householdId);
      if (error) throw error;
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to reorder sections',
    };
  }
}

// ---------------------------------------------------------------------------
// Copy actions
// ---------------------------------------------------------------------------

/**
 * Copy all entries from one day to another.
 * New entries get fresh IDs; sort_order is preserved within each slot.
 */
export async function copyMealPlanDay(
  fromDate: string,
  toDate: string
): Promise<ActionResult & { copiedCount?: number }> {
  try {
    const supabase = createClient();
    const household = await getHouseholdId(supabase);
    if (!household.success) return { success: false, error: household.error };

    const { data: entries, error: fetchError } = await supabase
      .from('meal_plan')
      .select('*')
      .eq('household_id', household.householdId)
      .eq('day', fromDate)
      .order('sort_order');

    if (fetchError) throw fetchError;
    if (!entries || entries.length === 0) return { success: true, copiedCount: 0 };

    // Strip id + created_at so DB generates fresh ones; replace day
    const copies = entries.map(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      ({ id: _id, created_at: _created_at, ...rest }) => ({
        ...rest,
        day: toDate,
      })
    );

    const { error: insertError } = await supabase.from('meal_plan').insert(copies);
    if (insertError) throw insertError;

    return { success: true, copiedCount: copies.length };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to copy day',
    };
  }
}

/**
 * Copy all entries from one week to another.
 * Day offsets are preserved (Mon→Mon, Tue→Tue, etc.).
 */
export async function copyMealPlanWeek(
  fromWeekStart: string,
  toWeekStart: string
): Promise<ActionResult & { copiedCount?: number }> {
  try {
    const supabase = createClient();
    const household = await getHouseholdId(supabase);
    if (!household.success) return { success: false, error: household.error };

    const fromStart = new Date(fromWeekStart + 'T00:00:00');
    const fromEndDate = new Date(fromStart);
    fromEndDate.setDate(fromEndDate.getDate() + 6);
    const fromEndStr = fromEndDate.toISOString().split('T')[0];

    const toStart = new Date(toWeekStart + 'T00:00:00');
    const dayOffsetDays = Math.round(
      (toStart.getTime() - fromStart.getTime()) / (1000 * 60 * 60 * 24)
    );

    const { data: entries, error: fetchError } = await supabase
      .from('meal_plan')
      .select('*')
      .eq('household_id', household.householdId)
      .gte('day', fromWeekStart)
      .lte('day', fromEndStr)
      .order('day')
      .order('sort_order');

    if (fetchError) throw fetchError;
    if (!entries || entries.length === 0) return { success: true, copiedCount: 0 };

    const copies = entries.map(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      ({ id: _id, created_at: _created_at, ...rest }) => {
        const origDay = new Date(rest.day + 'T00:00:00');
        origDay.setDate(origDay.getDate() + dayOffsetDays);
        return { ...rest, day: origDay.toISOString().split('T')[0] };
      }
    );

    const { error: insertError } = await supabase.from('meal_plan').insert(copies);
    if (insertError) throw insertError;

    return { success: true, copiedCount: copies.length };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to copy week',
    };
  }
}
