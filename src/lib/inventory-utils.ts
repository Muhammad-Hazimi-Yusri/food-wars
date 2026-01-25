import { StockEntryWithProduct } from '@/types/database';

export type ExpiryStatus = 'expired' | 'expiring' | 'fresh' | 'none';

/**
 * Get expiry status for a stock entry
 * @param bestBeforeDate - The best before date string (ISO format)
 * @param dueType - 1=best_before (warning only), 2=expiration (strict)
 * @param warningDays - Days before expiry to show warning (default 3)
 */
export function getExpiryStatus(
  bestBeforeDate: string | null,
  warningDays: number = 3
): ExpiryStatus {
  if (!bestBeforeDate) return 'none';

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiry = new Date(bestBeforeDate);
  expiry.setHours(0, 0, 0, 0);

  const daysUntilExpiry = Math.ceil(
    (expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysUntilExpiry < 0) return 'expired';
  if (daysUntilExpiry <= warningDays) return 'expiring';
  return 'fresh';
}

/**
 * Get label for expiry status
 */
export function getExpiryLabel(
  bestBeforeDate: string | null,
  dueType: 1 | 2 = 1
): string {
  if (!bestBeforeDate) return 'No expiry';

  const status = getExpiryStatus(bestBeforeDate, dueType);
  const date = new Date(bestBeforeDate);
  const formatted = date.toLocaleDateString();

  switch (status) {
    case 'expired':
      // dueType 1 = "best before" (still edible), dueType 2 = "expiration" (unsafe)
      return dueType === 2 ? `Expired ${formatted}` : `Past best before ${formatted}`;
    case 'expiring':
      return `Expires ${formatted}`;
    default:
      return formatted;
  }
}

export type InventoryStats = {
  total: number;
  expired: number;
  expiring: number;
  fresh: number;
  noExpiry: number;
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
    expiring: 0,
    fresh: 0,
    noExpiry: 0,
    byLocation: {},
    byProductGroup: {},
    totalValue: 0,
  };

  for (const entry of entries) {
    // Count by expiry status
    const status = getExpiryStatus(
      entry.best_before_date,
      entry.product?.due_type ?? 1
    );
    
    switch (status) {
      case 'expired':
        stats.expired++;
        break;
      case 'expiring':
        stats.expiring++;
        break;
      case 'fresh':
        stats.fresh++;
        break;
      case 'none':
        stats.noExpiry++;
        break;
    }

    // Count by location
    const locationName = entry.location?.name ?? 'Unknown';
    stats.byLocation[locationName] = (stats.byLocation[locationName] || 0) + 1;

    // Count by product group
    const groupName = entry.product?.product_group?.name ?? 'Uncategorized';
    stats.byProductGroup[groupName] = (stats.byProductGroup[groupName] || 0) + 1;

    // Sum total value
    if (entry.price && entry.amount) {
      stats.totalValue += entry.price * entry.amount;
    }
  }

  return stats;
}

/**
 * Filter stock entries by expiry status
 */
export function filterByExpiryStatus(
  entries: StockEntryWithProduct[],
  status: ExpiryStatus | 'all'
): StockEntryWithProduct[] {
  if (status === 'all') return entries;

  return entries.filter((entry) => {
    const entryStatus = getExpiryStatus(
      entry.best_before_date,
      entry.product?.due_type ?? 1
    );
    return entryStatus === status;
  });
}

/**
 * Sort stock entries by next to expire (for consume priority)
 * Rule: opened first → due soonest → FIFO (purchased first)
 */
export function sortByConsumePriority(
  entries: StockEntryWithProduct[]
): StockEntryWithProduct[] {
  return [...entries].sort((a, b) => {
    // Opened items first
    if (a.open && !b.open) return -1;
    if (!a.open && b.open) return 1;

    // Then by due date (soonest first)
    if (a.best_before_date && b.best_before_date) {
      const dateA = new Date(a.best_before_date).getTime();
      const dateB = new Date(b.best_before_date).getTime();
      if (dateA !== dateB) return dateA - dateB;
    }
    // Items with expiry before items without
    if (a.best_before_date && !b.best_before_date) return -1;
    if (!a.best_before_date && b.best_before_date) return 1;

    // Then FIFO (purchased first)
    if (a.purchased_date && b.purchased_date) {
      return new Date(a.purchased_date).getTime() - new Date(b.purchased_date).getTime();
    }

    return 0;
  });
}