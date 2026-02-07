import { StockEntryWithProduct } from '@/types/database';
import { computeConsumePlan } from '@/lib/inventory-utils';
import { createClient } from '@/lib/supabase/client';
import { GUEST_HOUSEHOLD_ID } from '@/lib/constants';

/**
 * Consume stock for a product, applying FIFO logic.
 * Mutates stock_entries (update/delete) and inserts stock_log rows.
 */
export async function consumeStock(
  productId: string,
  entries: StockEntryWithProduct[],
  amount: number
): Promise<{ success: boolean; error?: string; consumed: number }> {
  try {
    const plan = computeConsumePlan(entries, amount);

    if (plan.items.length === 0) {
      return { success: false, error: 'Nothing to consume', consumed: 0 };
    }

    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not authenticated', consumed: 0 };

    const isGuest = user.is_anonymous === true;
    let householdId: string;

    if (isGuest) {
      householdId = GUEST_HOUSEHOLD_ID;
    } else {
      const { data: household } = await supabase
        .from('households')
        .select('id')
        .eq('owner_id', user.id)
        .single();
      if (!household) return { success: false, error: 'No household found', consumed: 0 };
      householdId = household.id;
    }

    const correlationId = crypto.randomUUID();
    const usedDate = new Date().toISOString().split('T')[0];

    // Build a lookup from entry id → full entry for log fields
    const entryMap = new Map(entries.map((e) => [e.id, e]));

    for (const item of plan.items) {
      const entry = entryMap.get(item.entryId)!;

      // Update or delete the stock entry
      if (item.deleteEntry) {
        const { error } = await supabase
          .from('stock_entries')
          .delete()
          .eq('id', item.entryId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('stock_entries')
          .update({ amount: item.newAmount })
          .eq('id', item.entryId);
        if (error) throw error;
      }

      // Insert stock_log row
      const { error: logError } = await supabase.from('stock_log').insert({
        household_id: householdId,
        product_id: productId,
        amount: item.amountToConsume,
        transaction_type: 'consume',
        best_before_date: entry.best_before_date ?? null,
        purchased_date: entry.purchased_date ?? null,
        used_date: usedDate,
        opened_date: entry.opened_date ?? null,
        price: entry.price ?? null,
        location_id: entry.location_id ?? null,
        shopping_location_id: entry.shopping_location_id ?? null,
        spoiled: false,
        stock_id: entry.stock_id,
        stock_entry_id: item.deleteEntry ? null : entry.id,
        correlation_id: correlationId,
        transaction_id: crypto.randomUUID(),
        undone: false,
        user_id: user.id,
      });
      if (logError) throw logError;
    }

    return { success: true, consumed: plan.totalConsumed };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to consume stock',
      consumed: 0,
    };
  }
}
