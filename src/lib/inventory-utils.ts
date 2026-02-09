import { StockEntry, StockEntryWithProduct } from '@/types/database';

export type ExpiryStatus = 'expired' | 'overdue' | 'due_soon' | 'fresh' | 'none';

/**
 * Get expiry status for a stock entry
 * @param bestBeforeDate - The best before date string (ISO format)
 * @param dueType - 1=best_before (overdue when past), 2=expiration (expired when past)
 * @param warningDays - Days before date to show "due soon" warning (default 5)
 */
export function getExpiryStatus(
  bestBeforeDate: string | null,
  dueType: number = 1,
  warningDays: number = 5
): ExpiryStatus {
  if (!bestBeforeDate) return 'none';

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiry = new Date(bestBeforeDate);
  expiry.setHours(0, 0, 0, 0);

  const daysUntilExpiry = Math.ceil(
    (expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysUntilExpiry < 0) {
    // Past the date: due_type 2 = expired (unsafe), due_type 1 = overdue (still edible)
    return dueType === 2 ? 'expired' : 'overdue';
  }
  if (daysUntilExpiry <= warningDays) return 'due_soon';
  return 'fresh';
}

/**
 * Get human-readable label for expiry status
 */
export function getExpiryLabel(
  bestBeforeDate: string | null,
  dueType: number = 1
): string {
  if (!bestBeforeDate) return 'No expiry';

  const status = getExpiryStatus(bestBeforeDate, dueType);
  const date = new Date(bestBeforeDate);
  const formatted = date.toLocaleDateString();

  switch (status) {
    case 'expired':
      return `Expired ${formatted}`;
    case 'overdue':
      return `Overdue ${formatted}`;
    case 'due_soon':
      return `Due ${formatted}`;
    default:
      return formatted;
  }
}

/**
 * Get days until/since expiry as human-readable string
 */
export function getExpiryDaysLabel(bestBeforeDate: string | null): string {
  if (!bestBeforeDate) return '';

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiry = new Date(bestBeforeDate);
  expiry.setHours(0, 0, 0, 0);

  const days = Math.ceil(
    (expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (days < 0) {
    const absDays = Math.abs(days);
    return absDays === 1 ? '1d ago' : `${absDays}d ago`;
  }
  if (days === 0) return 'Today';
  if (days === 1) return '1d';
  return `${days}d`;
}

export type InventoryStats = {
  total: number;
  expired: number;
  overdue: number;
  due_soon: number;
  fresh: number;
  none: number;
  belowMinStock: number;
  byLocation: Record<string, number>;
  byProductGroup: Record<string, number>;
  totalValue: number;
};

/**
 * Calculate inventory statistics from stock entries
 */
export function getInventoryStats(
  entries: StockEntryWithProduct[]
): InventoryStats {
  const stats: InventoryStats = {
    total: entries.length,
    expired: 0,
    overdue: 0,
    due_soon: 0,
    fresh: 0,
    none: 0,
    belowMinStock: 0,
    byLocation: {},
    byProductGroup: {},
    totalValue: 0,
  };

  // Track product totals for min stock calculation
  const productTotals: Record<string, { total: number; min: number }> = {};

  for (const entry of entries) {
    // Count by expiry status
    const status = getExpiryStatus(
      entry.best_before_date,
      entry.product?.due_type ?? 1
    );
    stats[status]++;

    // Count by location
    const locationName = entry.location?.name ?? 'Unknown';
    stats.byLocation[locationName] = (stats.byLocation[locationName] || 0) + 1;

    // Count by product group
    const groupName = entry.product?.product_group?.name ?? 'Uncategorized';
    stats.byProductGroup[groupName] = (stats.byProductGroup[groupName] || 0) + 1;

    // Sum total value
    stats.totalValue += (entry.price ?? 0) * entry.amount;

    // Track product totals for min stock
    const pid = entry.product_id;
    if (!productTotals[pid]) {
      productTotals[pid] = {
        total: 0,
        min: entry.product?.min_stock_amount ?? 0,
      };
    }
    productTotals[pid].total += entry.amount;
  }

  // Count products below min stock
  for (const { total, min } of Object.values(productTotals)) {
    if (min > 0 && total < min) {
      stats.belowMinStock++;
    }
  }

  return stats;
}

// ============================================
// CONSUME LOGIC
// ============================================

export type ConsumeInput = Pick<StockEntry, 'id' | 'amount' | 'open' | 'best_before_date' | 'purchased_date'>;

export type ConsumePlanItem = {
  entryId: string;
  amountToConsume: number;
  deleteEntry: boolean;
  newAmount: number;
};

export type ConsumePlan = {
  items: ConsumePlanItem[];
  totalConsumed: number;
  shortfall: number;
};

/**
 * Compute which stock entries to update/delete when consuming a given amount.
 * Pure function — no DB calls.
 *
 * FIFO priority:
 *  1. Opened entries first
 *  2. Earliest best_before_date (nulls last)
 *  3. Oldest purchased_date (nulls last)
 */
export function computeConsumePlan(
  entries: ConsumeInput[],
  amountToConsume: number
): ConsumePlan {
  if (amountToConsume <= 0 || entries.length === 0) {
    return { items: [], totalConsumed: 0, shortfall: Math.max(0, amountToConsume) };
  }

  const sorted = [...entries].sort((a, b) => {
    // 1. Opened first
    if (a.open !== b.open) return a.open ? -1 : 1;

    // 2. Earliest best_before_date (nulls last)
    if (a.best_before_date !== b.best_before_date) {
      if (!a.best_before_date) return 1;
      if (!b.best_before_date) return -1;
      return a.best_before_date.localeCompare(b.best_before_date);
    }

    // 3. Oldest purchased_date (nulls last)
    if (a.purchased_date !== b.purchased_date) {
      if (!a.purchased_date) return 1;
      if (!b.purchased_date) return -1;
      return a.purchased_date.localeCompare(b.purchased_date);
    }

    return 0;
  });

  let remaining = amountToConsume;
  const items: ConsumePlanItem[] = [];

  for (const entry of sorted) {
    if (remaining <= 0) break;

    const take = Math.min(remaining, entry.amount);
    const newAmount = entry.amount - take;

    items.push({
      entryId: entry.id,
      amountToConsume: take,
      deleteEntry: newAmount === 0,
      newAmount,
    });

    remaining -= take;
  }

  return {
    items,
    totalConsumed: amountToConsume - remaining,
    shortfall: remaining,
  };
}

// ============================================
// OPEN LOGIC
// ============================================

export type OpenInput = Pick<StockEntry, 'id' | 'open' | 'best_before_date' | 'purchased_date'>;

export type OpenPlanItem = {
  entryId: string;
};

export type OpenPlan = {
  items: OpenPlanItem[];
  totalOpened: number;
};

/**
 * Compute which sealed stock entries to mark as opened.
 * Pure function — no DB calls.
 *
 * FIFO priority (sealed entries only):
 *  1. Earliest best_before_date (nulls last)
 *  2. Oldest purchased_date (nulls last)
 */
export function computeOpenPlan(
  entries: OpenInput[],
  count: number
): OpenPlan {
  if (count <= 0 || entries.length === 0) {
    return { items: [], totalOpened: 0 };
  }

  const sealed = entries.filter((e) => !e.open);

  const sorted = [...sealed].sort((a, b) => {
    // 1. Earliest best_before_date (nulls last)
    if (a.best_before_date !== b.best_before_date) {
      if (!a.best_before_date) return 1;
      if (!b.best_before_date) return -1;
      return a.best_before_date.localeCompare(b.best_before_date);
    }

    // 2. Oldest purchased_date (nulls last)
    if (a.purchased_date !== b.purchased_date) {
      if (!a.purchased_date) return 1;
      if (!b.purchased_date) return -1;
      return a.purchased_date.localeCompare(b.purchased_date);
    }

    return 0;
  });

  const items: OpenPlanItem[] = sorted.slice(0, count).map((entry) => ({
    entryId: entry.id,
  }));

  return { items, totalOpened: items.length };
}