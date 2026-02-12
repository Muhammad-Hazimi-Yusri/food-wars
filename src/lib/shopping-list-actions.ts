import { createClient } from '@/lib/supabase/client';
import { getHouseholdId } from '@/lib/supabase/get-household';
import type { ShoppingListItem } from '@/types/database';
import { findExistingItem } from '@/lib/shopping-list-utils';

type ActionResult = {
  success: boolean;
  error?: string;
};

type AddItemParams = {
  productId?: string | null;
  note?: string | null;
  amount: number;
  quId?: string | null;
};

/**
 * Add an item to a shopping list.
 * If a product-linked item with the same product_id already exists (and isn't done),
 * increments its amount instead of creating a duplicate.
 */
export async function addItemToList(
  listId: string,
  params: AddItemParams,
  existingItems: ShoppingListItem[] = []
): Promise<ActionResult & { itemId?: string }> {
  try {
    const supabase = createClient();
    const household = await getHouseholdId(supabase);
    if (!household.success) return { success: false, error: household.error };

    // Duplicate detection for product-linked items
    if (params.productId) {
      const existing = findExistingItem(existingItems, params.productId);
      if (existing) {
        const newAmount = existing.amount + params.amount;
        const { error } = await supabase
          .from('shopping_list_items')
          .update({ amount: newAmount })
          .eq('id', existing.id);
        if (error) throw error;
        return { success: true, itemId: existing.id };
      }
    }

    // Determine sort_order: place new item at end
    const maxSort = existingItems.reduce(
      (max, item) => Math.max(max, item.sort_order),
      -1
    );

    const { data, error } = await supabase
      .from('shopping_list_items')
      .insert({
        household_id: household.householdId,
        shopping_list_id: listId,
        product_id: params.productId ?? null,
        note: params.note ?? null,
        amount: params.amount,
        qu_id: params.quId ?? null,
        sort_order: maxSort + 1,
      })
      .select('id')
      .single();
    if (error) throw error;

    return { success: true, itemId: data?.id };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to add item',
    };
  }
}

/**
 * Remove an item from a shopping list.
 */
export async function removeItemFromList(
  itemId: string
): Promise<ActionResult> {
  try {
    const supabase = createClient();
    const { error } = await supabase
      .from('shopping_list_items')
      .delete()
      .eq('id', itemId);
    if (error) throw error;
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to remove item',
    };
  }
}

/**
 * Toggle the done state of a shopping list item.
 */
export async function toggleItemDone(
  itemId: string,
  done: boolean
): Promise<ActionResult> {
  try {
    const supabase = createClient();
    const { error } = await supabase
      .from('shopping_list_items')
      .update({ done })
      .eq('id', itemId);
    if (error) throw error;
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update item',
    };
  }
}

/**
 * Delete all done items from a shopping list.
 */
export async function clearDoneItems(
  listId: string
): Promise<ActionResult & { count?: number }> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('shopping_list_items')
      .delete()
      .eq('shopping_list_id', listId)
      .eq('done', true)
      .select('id');
    if (error) throw error;
    return { success: true, count: data?.length ?? 0 };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to clear done items',
    };
  }
}

/**
 * Update the sort_order of items after drag-and-drop reorder.
 */
export async function reorderItems(
  itemIds: string[]
): Promise<ActionResult> {
  try {
    const supabase = createClient();

    for (let i = 0; i < itemIds.length; i++) {
      const { error } = await supabase
        .from('shopping_list_items')
        .update({ sort_order: i })
        .eq('id', itemIds[i]);
      if (error) throw error;
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to reorder items',
    };
  }
}

/**
 * Update the amount of a shopping list item.
 */
export async function updateItemAmount(
  itemId: string,
  amount: number
): Promise<ActionResult> {
  try {
    const supabase = createClient();
    const { error } = await supabase
      .from('shopping_list_items')
      .update({ amount })
      .eq('id', itemId);
    if (error) throw error;
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update amount',
    };
  }
}

type ConversionInfo = {
  from_qu_id: string;
  to_qu_id: string;
  factor: number;
  product_id: string | null;
};

type ProductDefaults = {
  qu_id_stock: string | null;
  location_id: string | null;
  shopping_location_id: string | null;
  default_due_days: number;
};

/**
 * Purchase a shopping list item: create a stock entry using product defaults,
 * then remove the item from the list.
 */
export async function purchaseItem(
  itemId: string,
  productId: string,
  amount: number,
  quId: string | null,
  conversions: ConversionInfo[],
  product: ProductDefaults
): Promise<ActionResult> {
  try {
    const supabase = createClient();
    const household = await getHouseholdId(supabase);
    if (!household.success) return { success: false, error: household.error };

    // Compute conversion factor from item unit → stock unit
    let conversionFactor = 1;
    if (quId && product.qu_id_stock && quId !== product.qu_id_stock) {
      const productConv = conversions.find(
        (c) =>
          c.product_id === productId &&
          c.from_qu_id === quId &&
          c.to_qu_id === product.qu_id_stock
      );
      if (productConv) {
        conversionFactor = productConv.factor;
      } else {
        const globalConv = conversions.find(
          (c) =>
            c.product_id === null &&
            c.from_qu_id === quId &&
            c.to_qu_id === product.qu_id_stock
        );
        if (globalConv) conversionFactor = globalConv.factor;
      }
    }

    const stockAmount = amount * conversionFactor;

    // Compute best_before_date from product defaults
    let bestBeforeDate: string | null = null;
    if (product.default_due_days > 0) {
      const date = new Date();
      date.setDate(date.getDate() + product.default_due_days);
      bestBeforeDate = date.toISOString().split('T')[0];
    } else if (product.default_due_days === -1) {
      bestBeforeDate = '2999-12-31'; // never expires
    }

    // Insert stock entry
    const { error: stockError } = await supabase.from('stock_entries').insert({
      household_id: household.householdId,
      product_id: productId,
      amount: stockAmount,
      location_id: product.location_id,
      shopping_location_id: product.shopping_location_id,
      best_before_date: bestBeforeDate,
      purchased_date: new Date().toISOString().split('T')[0],
    });
    if (stockError) throw stockError;

    // Mark item as done (purchased)
    const { error: updateError } = await supabase
      .from('shopping_list_items')
      .update({ done: true })
      .eq('id', itemId);
    if (updateError) throw updateError;

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to purchase item',
    };
  }
}
