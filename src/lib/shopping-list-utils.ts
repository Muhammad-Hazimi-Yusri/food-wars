import type { ShoppingListItem, StockEntryWithProduct, Product } from '@/types/database';
import { getExpiryStatus } from '@/lib/inventory-utils';

type ProductWithMinStock = Pick<Product, 'id' | 'min_stock_amount' | 'qu_id_purchase'>;

export type StockGapItem = {
  productId: string;
  missingAmount: number;
  quId: string | null;
};

/**
 * Find an existing item on a shopping list for a given product.
 * Used for duplicate detection — if found, we increment amount instead of adding a new row.
 */
export function findExistingItem(
  items: ShoppingListItem[],
  productId: string
): ShoppingListItem | undefined {
  return items.find((item) => item.product_id === productId && !item.done);
}

/**
 * Compute the stock gap for a product: max(0, min_stock - current_stock).
 * Returns 0 if the product has no min_stock_amount set.
 */
function computeStockGap(
  product: ProductWithMinStock,
  entries: StockEntryWithProduct[]
): number {
  if (!product.min_stock_amount || product.min_stock_amount <= 0) return 0;
  const currentStock = entries
    .filter((e) => e.product_id === product.id)
    .reduce((sum, e) => sum + e.amount, 0);
  return Math.max(0, product.min_stock_amount - currentStock);
}

/**
 * Compute products that are below their minimum stock level.
 * Returns items with missingAmount = max(0, min_stock - current_stock).
 * Skips products with min_stock_amount = 0 or those already at/above min stock.
 */
export function computeBelowMinStock(
  entries: StockEntryWithProduct[],
  products: ProductWithMinStock[]
): StockGapItem[] {
  const result: StockGapItem[] = [];

  for (const product of products) {
    const gap = computeStockGap(product, entries);
    if (gap > 0) {
      result.push({
        productId: product.id,
        missingAmount: gap,
        quId: product.qu_id_purchase ?? null,
      });
    }
  }

  return result;
}

/**
 * Compute products that have expired stock entries.
 * Amount = max(0, min_stock - current_stock) for each product with at least one expired entry.
 * Products with min_stock_amount = 0 are skipped.
 */
export function computeExpiredProducts(
  entries: StockEntryWithProduct[],
  products: ProductWithMinStock[]
): StockGapItem[] {
  // Find product IDs that have at least one expired entry
  const expiredProductIds = new Set<string>();
  for (const entry of entries) {
    const status = getExpiryStatus(
      entry.best_before_date,
      entry.product.due_type
    );
    if (status === 'expired') {
      expiredProductIds.add(entry.product_id);
    }
  }

  const result: StockGapItem[] = [];
  for (const product of products) {
    if (!expiredProductIds.has(product.id)) continue;
    const gap = computeStockGap(product, entries);
    if (gap > 0) {
      result.push({
        productId: product.id,
        missingAmount: gap,
        quId: product.qu_id_purchase ?? null,
      });
    }
  }

  return result;
}

/**
 * Compute products that have overdue stock entries.
 * Amount = max(0, min_stock - current_stock) for each product with at least one overdue entry.
 * Products with min_stock_amount = 0 are skipped.
 */
export function computeOverdueProducts(
  entries: StockEntryWithProduct[],
  products: ProductWithMinStock[]
): StockGapItem[] {
  // Find product IDs that have at least one overdue entry
  const overdueProductIds = new Set<string>();
  for (const entry of entries) {
    const status = getExpiryStatus(
      entry.best_before_date,
      entry.product.due_type
    );
    if (status === 'overdue') {
      overdueProductIds.add(entry.product_id);
    }
  }

  const result: StockGapItem[] = [];
  for (const product of products) {
    if (!overdueProductIds.has(product.id)) continue;
    const gap = computeStockGap(product, entries);
    if (gap > 0) {
      result.push({
        productId: product.id,
        missingAmount: gap,
        quId: product.qu_id_purchase ?? null,
      });
    }
  }

  return result;
}
