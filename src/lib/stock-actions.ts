import { StockEntryWithProduct, StockTransactionType } from '@/types/database';
import { computeConsumePlan, computeOpenPlan } from '@/lib/inventory-utils';
import { createClient } from '@/lib/supabase/client';
import { getHouseholdId } from '@/lib/supabase/get-household';

type ConsumeOptions = {
  spoiled?: boolean;
  /** If provided, use this correlation ID instead of generating a new one (e.g., for recipe consume). */
  correlationId?: string;
  /** Recipe ID to record in the stock log for recipe-initiated consumption. */
  recipeId?: string;
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

    const household = await getHouseholdId(supabase);
    if (!household.success) return { success: false, error: household.error, consumed: 0 };
    const { householdId, userId } = household;

    const correlationId = options?.correlationId ?? crypto.randomUUID();
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
        user_id: userId,
        note: entry.note ?? null,
        recipe_id: options?.recipeId ?? null,
      });
      if (logError) throw logError;
    }

    // Auto-add to shopping list if below min stock (fire-and-forget)
    checkAutoAddToShoppingList(productId, entries, plan.totalConsumed, householdId, supabase).catch((err) => {
      console.error("[stock-actions] checkAutoAddToShoppingList failed:", err);
    });

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
      error: err instanceof Error ? err.message : 'Failed to undo consume',
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

// ============================================
// OPEN STOCK
// ============================================

type OpenResult = {
  success: boolean;
  error?: string;
  opened: number;
  correlationId?: string;
};

/**
 * Mark sealed stock entries as opened, applying FIFO logic.
 * Sets open=true, opened_date, recalculates best_before_date,
 * and optionally moves to default_consume_location_id.
 */
export async function openStock(
  productId: string,
  entries: StockEntryWithProduct[],
  count: number
): Promise<OpenResult> {
  try {
    const plan = computeOpenPlan(entries, count);

    if (plan.items.length === 0) {
      return { success: false, error: 'Nothing to open', opened: 0 };
    }

    const supabase = createClient();

    const household = await getHouseholdId(supabase);
    if (!household.success) return { success: false, error: household.error, opened: 0 };
    const { householdId, userId } = household;

    const correlationId = crypto.randomUUID();
    const today = new Date().toISOString().split('T')[0];

    const product = entries[0].product;
    const dueDaysAfterOpen = product.default_due_days_after_open;
    const moveOnOpen = product.move_on_open && product.default_consume_location_id;

    const entryMap = new Map(entries.map((e) => [e.id, e]));

    for (const item of plan.items) {
      const entry = entryMap.get(item.entryId)!;

      // Build update payload
      const update: Record<string, unknown> = {
        open: true,
        opened_date: today,
      };

      // Recalculate best_before_date if default_due_days_after_open > 0
      if (dueDaysAfterOpen > 0) {
        const newDueDate = new Date();
        newDueDate.setDate(newDueDate.getDate() + dueDaysAfterOpen);
        const newDueStr = newDueDate.toISOString().split('T')[0];

        if (entry.best_before_date) {
          // Never extend original due date
          update.best_before_date = newDueStr < entry.best_before_date
            ? newDueStr
            : entry.best_before_date;
        } else {
          update.best_before_date = newDueStr;
        }
      }

      // Auto-move to default_consume_location_id if move_on_open
      if (moveOnOpen) {
        update.location_id = product.default_consume_location_id;
      }

      const { error } = await supabase
        .from('stock_entries')
        .update(update)
        .eq('id', item.entryId);
      if (error) throw error;

      // Insert stock_log row (captures ORIGINAL values for undo)
      const { error: logError } = await supabase.from('stock_log').insert({
        household_id: householdId,
        product_id: productId,
        amount: entry.amount,
        transaction_type: 'product-opened',
        best_before_date: entry.best_before_date ?? null,
        purchased_date: entry.purchased_date ?? null,
        used_date: today,
        opened_date: today,
        price: entry.price ?? null,
        location_id: entry.location_id ?? null,
        shopping_location_id: entry.shopping_location_id ?? null,
        spoiled: false,
        stock_id: entry.stock_id,
        stock_entry_id: entry.id,
        correlation_id: correlationId,
        transaction_id: crypto.randomUUID(),
        undone: false,
        user_id: userId,
        note: entry.note ?? null,
      });
      if (logError) throw logError;
    }

    return { success: true, opened: plan.totalOpened, correlationId };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to open stock',
      opened: 0,
    };
  }
}

/**
 * Undo an open transaction by correlation ID.
 * Restores entries to sealed state with original best_before_date and location.
 */
export async function undoOpen(
  correlationId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not authenticated' };

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
      if (!row.stock_entry_id) continue;

      // Restore entry to sealed state with original values from log
      const { error: updateError } = await supabase
        .from('stock_entries')
        .update({
          open: false,
          opened_date: null,
          best_before_date: row.best_before_date,
          location_id: row.location_id,
        })
        .eq('id', row.stock_entry_id);
      if (updateError) throw updateError;
    }

    const { error: undoError } = await supabase
      .from('stock_log')
      .update({ undone: true, undone_timestamp: new Date().toISOString() })
      .eq('correlation_id', correlationId);
    if (undoError) throw undoError;

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to undo open',
    };
  }
}

// ============================================
// TRANSFER STOCK
// ============================================

type TransferResult = {
  success: boolean;
  error?: string;
  warning?: string;
  correlationId?: string;
};

/**
 * Transfer a stock entry to a different location.
 * Inserts two stock_log rows (transfer-from + transfer-to) with the same correlation_id.
 * Recalculates best_before_date when moving to/from a freezer.
 */
export async function transferStock(
  entry: StockEntryWithProduct,
  destinationLocationId: string,
  sourceIsFreezer: boolean,
  destinationIsFreezer: boolean,
  options?: { useFreezingDueDate?: boolean; manualDueDate?: string }
): Promise<TransferResult> {
  try {
    if (entry.location_id === destinationLocationId) {
      return { success: false, error: 'Already at that location' };
    }

    const supabase = createClient();

    const household = await getHouseholdId(supabase);
    if (!household.success) return { success: false, error: household.error };
    const { householdId, userId } = household;

    const correlationId = crypto.randomUUID();
    const today = new Date().toISOString().split('T')[0];
    const product = entry.product;

    // Determine new best_before_date based on freezer/thaw detection
    let newBestBeforeDate = entry.best_before_date;

    if (!sourceIsFreezer && destinationIsFreezer && product.default_due_days_after_freezing > 0) {
      // Freezing: user chooses to keep current date or use freezer shelf life
      if (options?.useFreezingDueDate) {
        const d = new Date();
        d.setDate(d.getDate() + product.default_due_days_after_freezing);
        newBestBeforeDate = d.toISOString().split('T')[0];
      }
      // else: keep original due date (default)
    } else if (sourceIsFreezer && !destinationIsFreezer && product.default_due_days_after_thawing > 0) {
      // Thawing: always replace — frozen food is preserved, thawing starts fresh shelf life
      const d = new Date();
      d.setDate(d.getDate() + product.default_due_days_after_thawing);
      newBestBeforeDate = d.toISOString().split('T')[0];
    }

    // Manual override from user input (when no auto days configured)
    if (options?.manualDueDate) {
      newBestBeforeDate = options.manualDueDate;
    }

    // Update the stock entry
    const update: Record<string, unknown> = { location_id: destinationLocationId };
    if (newBestBeforeDate !== entry.best_before_date) {
      update.best_before_date = newBestBeforeDate;
    }

    const { error: updateError } = await supabase
      .from('stock_entries')
      .update(update)
      .eq('id', entry.id);
    if (updateError) throw updateError;

    // Shared log fields
    const sharedLog = {
      household_id: householdId,
      product_id: entry.product_id,
      amount: entry.amount,
      purchased_date: entry.purchased_date ?? null,
      used_date: today,
      opened_date: entry.opened_date ?? null,
      price: entry.price ?? null,
      shopping_location_id: entry.shopping_location_id ?? null,
      spoiled: false,
      stock_id: entry.stock_id,
      stock_entry_id: entry.id,
      correlation_id: correlationId,
      undone: false,
      user_id: userId,
      note: entry.note ?? null,
    };

    // Insert transfer-from log (original values for undo)
    const { error: fromError } = await supabase.from('stock_log').insert({
      ...sharedLog,
      transaction_type: 'transfer-from',
      location_id: entry.location_id ?? null,
      best_before_date: entry.best_before_date ?? null,
      transaction_id: crypto.randomUUID(),
    });
    if (fromError) throw fromError;

    // Insert transfer-to log (new values for audit)
    const { error: toError } = await supabase.from('stock_log').insert({
      ...sharedLog,
      transaction_type: 'transfer-to',
      location_id: destinationLocationId,
      best_before_date: newBestBeforeDate ?? null,
      transaction_id: crypto.randomUUID(),
    });
    if (toError) throw toError;

    const warning = product.should_not_be_frozen && destinationIsFreezer
      ? 'This product should not be frozen'
      : undefined;

    return { success: true, correlationId, warning };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to transfer stock',
    };
  }
}

// ============================================
// INVENTORY CORRECTION
// ============================================

type CorrectionResult = {
  success: boolean;
  error?: string;
  delta: number;
  correlationId?: string;
};

/**
 * Correct stock for a product to a new total amount (Grocy-style).
 * If the new amount is less, entries are removed via FIFO.
 * If the new amount is more, the newest entry is increased.
 * Logs to stock_log with transaction_type = 'inventory-correction'.
 */
export async function correctInventory(
  productId: string,
  entries: StockEntryWithProduct[],
  newAmount: number
): Promise<CorrectionResult> {
  try {
    const currentTotal = entries.reduce((sum, e) => sum + e.amount, 0);
    const delta = newAmount - currentTotal;

    if (delta === 0) {
      return { success: true, delta: 0 };
    }

    const supabase = createClient();

    const household = await getHouseholdId(supabase);
    if (!household.success) return { success: false, error: household.error, delta: 0 };
    const { householdId, userId } = household;

    const correlationId = crypto.randomUUID();
    const today = new Date().toISOString().split('T')[0];
    const entryMap = new Map(entries.map((e) => [e.id, e]));

    if (delta < 0) {
      // DECREASE: remove stock via FIFO
      const plan = computeConsumePlan(entries, Math.abs(delta));
      if (plan.items.length === 0) {
        return { success: false, error: 'Nothing to correct', delta: 0 };
      }

      for (const item of plan.items) {
        const entry = entryMap.get(item.entryId)!;

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

        const { error: logError } = await supabase.from('stock_log').insert({
          household_id: householdId,
          product_id: productId,
          amount: item.amountToConsume,
          transaction_type: 'inventory-correction',
          best_before_date: entry.best_before_date ?? null,
          purchased_date: entry.purchased_date ?? null,
          used_date: today,
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
          user_id: userId,
          note: JSON.stringify({ direction: 'decrease' }),
        });
        if (logError) throw logError;
      }
    } else {
      // INCREASE: add stock to the most recent entry
      const sorted = [...entries].sort((a, b) =>
        (b.created_at ?? '').localeCompare(a.created_at ?? '')
      );
      const target = sorted[0];
      const newEntryAmount = target.amount + delta;

      const { error: updateError } = await supabase
        .from('stock_entries')
        .update({ amount: newEntryAmount })
        .eq('id', target.id);
      if (updateError) throw updateError;

      const { error: logError } = await supabase.from('stock_log').insert({
        household_id: householdId,
        product_id: productId,
        amount: delta,
        transaction_type: 'inventory-correction',
        best_before_date: target.best_before_date ?? null,
        purchased_date: target.purchased_date ?? null,
        used_date: today,
        opened_date: target.opened_date ?? null,
        price: target.price ?? null,
        location_id: target.location_id ?? null,
        shopping_location_id: target.shopping_location_id ?? null,
        spoiled: false,
        stock_id: target.stock_id,
        stock_entry_id: target.id,
        correlation_id: correlationId,
        transaction_id: crypto.randomUUID(),
        undone: false,
        user_id: userId,
        note: JSON.stringify({ direction: 'increase' }),
      });
      if (logError) throw logError;
    }

    return { success: true, delta, correlationId };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to correct inventory',
      delta: 0,
    };
  }
}

/**
 * Undo an inventory correction by correlation ID.
 * Parses direction from log note to determine decrease vs increase undo path.
 */
export async function undoCorrectInventory(
  correlationId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not authenticated' };

    const { data: logRows, error: fetchError } = await supabase
      .from('stock_log')
      .select('*')
      .eq('correlation_id', correlationId)
      .eq('undone', false);
    if (fetchError) throw fetchError;
    if (!logRows || logRows.length === 0) {
      return { success: false, error: 'Nothing to undo' };
    }

    let direction: string;
    try {
      direction = JSON.parse(logRows[0].note ?? '{}').direction;
    } catch {
      return { success: false, error: 'Invalid correction log data' };
    }

    if (direction === 'decrease') {
      // Same undo logic as undoConsume
      for (const row of logRows) {
        if (row.stock_entry_id) {
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
              note: null,
            });
          if (insertError) throw insertError;
        }
      }
    } else if (direction === 'increase') {
      const row = logRows[0];
      if (!row.stock_entry_id) {
        return { success: false, error: 'Correction entry not found' };
      }

      const { data: existing, error: getError } = await supabase
        .from('stock_entries')
        .select('amount')
        .eq('id', row.stock_entry_id)
        .single();
      if (getError) throw getError;

      const restoredAmount = existing.amount - row.amount;
      if (restoredAmount <= 0) {
        const { error: deleteError } = await supabase
          .from('stock_entries')
          .delete()
          .eq('id', row.stock_entry_id);
        if (deleteError) throw deleteError;
      } else {
        const { error: updateError } = await supabase
          .from('stock_entries')
          .update({ amount: restoredAmount })
          .eq('id', row.stock_entry_id);
        if (updateError) throw updateError;
      }
    } else {
      return { success: false, error: 'Unknown correction direction' };
    }

    const { error: undoError } = await supabase
      .from('stock_log')
      .update({ undone: true, undone_timestamp: new Date().toISOString() })
      .eq('correlation_id', correlationId);
    if (undoError) throw undoError;

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to undo correction',
    };
  }
}

/**
 * Undo a transfer by correlation ID.
 * Restores original location and best_before_date from the transfer-from log row.
 */
export async function undoTransfer(
  correlationId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not authenticated' };

    const { data: logRows, error: fetchError } = await supabase
      .from('stock_log')
      .select('*')
      .eq('correlation_id', correlationId)
      .eq('undone', false);
    if (fetchError) throw fetchError;
    if (!logRows || logRows.length === 0) {
      return { success: false, error: 'Nothing to undo' };
    }

    // Find the transfer-from row (has original values)
    const fromRow = logRows.find((r) => r.transaction_type === 'transfer-from');
    if (!fromRow || !fromRow.stock_entry_id) {
      return { success: false, error: 'Transfer-from log not found' };
    }

    // Restore original location and due date
    const { error: updateError } = await supabase
      .from('stock_entries')
      .update({
        location_id: fromRow.location_id,
        best_before_date: fromRow.best_before_date,
      })
      .eq('id', fromRow.stock_entry_id);
    if (updateError) throw updateError;

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
      error: err instanceof Error ? err.message : 'Failed to undo transfer',
    };
  }
}

/**
 * Undo a purchase transaction by correlation ID.
 * Marks the stock_log row as undone, then deletes the associated stock entry.
 * If stock has been partially consumed since purchase, the remaining amount is deleted.
 */
export async function undoPurchase(
  correlationId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not authenticated' };

    const { data: logRows, error: fetchError } = await supabase
      .from('stock_log')
      .select('stock_entry_id')
      .eq('correlation_id', correlationId)
      .eq('transaction_type', 'purchase')
      .eq('undone', false);
    if (fetchError) throw fetchError;
    if (!logRows || logRows.length === 0) {
      return { success: false, error: 'Nothing to undo' };
    }

    // Mark as undone first so the history query stops showing this row
    // even if the entry deletion below is slow
    const { error: undoError } = await supabase
      .from('stock_log')
      .update({ undone: true, undone_timestamp: new Date().toISOString() })
      .eq('correlation_id', correlationId)
      .eq('transaction_type', 'purchase');
    if (undoError) throw undoError;

    // Delete the associated stock entries (DB FK will set stock_entry_id=NULL)
    for (const row of logRows) {
      if (row.stock_entry_id) {
        const { error: deleteError } = await supabase
          .from('stock_entries')
          .delete()
          .eq('id', row.stock_entry_id);
        if (deleteError) throw deleteError;
      }
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to undo purchase',
    };
  }
}

/**
 * Dispatcher: undo any transaction by its correlation_id and type.
 * Routes to the correct undo function based on transaction_type.
 */
export async function undoTransaction(
  correlationId: string,
  transactionType: StockTransactionType
): Promise<{ success: boolean; error?: string }> {
  switch (transactionType) {
    case 'consume':
    case 'spoiled':
      return undoConsume(correlationId);
    case 'product-opened':
      return undoOpen(correlationId);
    case 'transfer-from':
      return undoTransfer(correlationId);
    case 'inventory-correction':
      return undoCorrectInventory(correlationId);
    case 'purchase':
      return undoPurchase(correlationId);
    default:
      return { success: false, error: 'Cannot undo this transaction type' };
  }
}

// ============================================
// AUTO-ADD TO SHOPPING LIST
// ============================================

/**
 * Check if a product has fallen below min stock after consumption,
 * and automatically add it to the household's auto-target shopping list.
 * This is fire-and-forget — failures are silently caught at the call site.
 */
async function checkAutoAddToShoppingList(
  productId: string,
  entries: StockEntryWithProduct[],
  totalConsumed: number,
  householdId: string,
  supabase: ReturnType<typeof createClient>
): Promise<void> {
  const product = entries[0]?.product;
  if (!product || !product.min_stock_amount || product.min_stock_amount <= 0) return;

  // Compute new total stock after consumption
  const currentTotal = entries
    .filter((e) => e.product_id === productId)
    .reduce((sum, e) => sum + e.amount, 0);
  const newTotal = currentTotal - totalConsumed;

  if (newTotal >= product.min_stock_amount) return;

  const missingAmount = product.min_stock_amount - newTotal;

  // Find the household's auto-target shopping list
  const { data: autoList } = await supabase
    .from('shopping_lists')
    .select('id')
    .eq('household_id', householdId)
    .eq('is_auto_target', true)
    .single();

  if (!autoList) return;

  // Fetch existing undone items on that list for duplicate detection
  const { data: existingItems } = await supabase
    .from('shopping_list_items')
    .select('*')
    .eq('shopping_list_id', autoList.id)
    .eq('done', false);

  const existing = (existingItems ?? []).find(
    (item: { product_id: string | null }) => item.product_id === productId
  );

  if (existing) {
    // Increment existing item's amount
    await supabase
      .from('shopping_list_items')
      .update({ amount: (existing as { amount: number }).amount + missingAmount })
      .eq('id', (existing as { id: string }).id);
  } else {
    // Add new item at the end
    const maxSort = (existingItems ?? []).reduce(
      (max: number, item: { sort_order: number }) => Math.max(max, item.sort_order),
      -1
    );

    await supabase
      .from('shopping_list_items')
      .insert({
        household_id: householdId,
        shopping_list_id: autoList.id,
        product_id: productId,
        note: null,
        amount: missingAmount,
        qu_id: product.qu_id_purchase ?? null,
        sort_order: maxSort + 1,
      });
  }
}
