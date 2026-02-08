import { StockEntryWithProduct } from '@/types/database';
import { computeConsumePlan } from '@/lib/inventory-utils';
import { createClient } from '@/lib/supabase/client';
import { GUEST_HOUSEHOLD_ID } from '@/lib/constants';

type ConsumeOptions = {
  spoiled?: boolean;
};

type ConsumeResult = {
  success: boolean;
  error?: string;
  consumed: number;
  correlationId?: string;
};

/**
 * Consume stock for a product, applying FIFO logic.
 * Mutates stock_entries (update/delete) and inserts stock_log rows.
 */
export async function consumeStock(
  productId: string,
  entries: StockEntryWithProduct[],
  amount: number,
  options?: ConsumeOptions
): Promise<ConsumeResult> {
  try {
    const plan = computeConsumePlan(entries, amount);

    if (plan.items.length === 0) {
      return { success: false, error: 'Nothing to consume', consumed: 0 };
    }

    const spoiled = options?.spoiled ?? false;
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
        transaction_type: spoiled ? 'spoiled' : 'consume',
        best_before_date: entry.best_before_date ?? null,
        purchased_date: entry.purchased_date ?? null,
        used_date: usedDate,
        opened_date: entry.opened_date ?? null,
        price: entry.price ?? null,
        location_id: entry.location_id ?? null,
        shopping_location_id: entry.shopping_location_id ?? null,
        spoiled,
        stock_id: entry.stock_id,
        stock_entry_id: item.deleteEntry ? null : entry.id,
        correlation_id: correlationId,
        transaction_id: crypto.randomUUID(),
        undone: false,
        user_id: user.id,
        note: entry.note ?? null,
      });
      if (logError) throw logError;
    }

    return { success: true, consumed: plan.totalConsumed, correlationId };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to consume stock',
      consumed: 0,
    };
  }
}

/**
 * Undo a consume/spoiled transaction by correlation ID.
 * Re-creates deleted entries and increments partially-consumed entries.
 * Marks stock_log rows as undone.
 */
export async function undoConsume(
  correlationId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not authenticated' };

    // Fetch log rows for this transaction
    const { data: logRows, error: fetchError } = await supabase
      .from('stock_log')
      .select('*')
      .eq('correlation_id', correlationId)
      .eq('undone', false);
    if (fetchError) throw fetchError;
    if (!logRows || logRows.length === 0) {
      return { success: false, error: 'Nothing to undo' };
    }

    for (const row of logRows) {
      if (row.stock_entry_id) {
        // Entry still exists — increment its amount
        const { data: existing, error: getError } = await supabase
          .from('stock_entries')
          .select('amount')
          .eq('id', row.stock_entry_id)
          .single();
        if (getError) throw getError;

        const { error: updateError } = await supabase
          .from('stock_entries')
          .update({ amount: existing.amount + row.amount })
          .eq('id', row.stock_entry_id);
        if (updateError) throw updateError;
      } else {
        // Entry was deleted — re-create it from log data
        const { error: insertError } = await supabase
          .from('stock_entries')
          .insert({
            household_id: row.household_id,
            product_id: row.product_id,
            amount: row.amount,
            best_before_date: row.best_before_date,
            purchased_date: row.purchased_date,
            price: row.price,
            location_id: row.location_id,
            shopping_location_id: row.shopping_location_id,
            stock_id: row.stock_id,
            open: row.opened_date !== null,
            opened_date: row.opened_date,
            note: row.note,
          });
        if (insertError) throw insertError;
      }
    }

    // Mark all log rows as undone
    const { error: undoError } = await supabase
      .from('stock_log')
      .update({ undone: true, undone_timestamp: new Date().toISOString() })
      .eq('correlation_id', correlationId);
    if (undoError) throw undoError;

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to undo',
    };
  }
}

/**
 * Undo a stock entry deletion by re-inserting it.
 */
export async function undoDeleteEntry(snapshot: {
  household_id: string;
  product_id: string;
  amount: number;
  best_before_date: string | null;
  purchased_date: string | null;
  price: number | null;
  location_id: string | null;
  shopping_location_id: string | null;
  open: boolean;
  opened_date: string | null;
  stock_id: string;
  note: string | null;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient();
    const { error } = await supabase.from('stock_entries').insert(snapshot);
    if (error) throw error;
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to restore entry',
    };
  }
}

/**
 * Undo a stock entry edit by restoring old values.
 */
export async function undoEditEntry(
  entryId: string,
  oldValues: {
    amount: number;
    location_id: string | null;
    shopping_location_id: string | null;
    best_before_date: string | null;
    price: number | null;
    note: string | null;
    open: boolean;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient();
    const { error } = await supabase
      .from('stock_entries')
      .update(oldValues)
      .eq('id', entryId);
    if (error) throw error;
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to restore entry',
    };
  }
}
