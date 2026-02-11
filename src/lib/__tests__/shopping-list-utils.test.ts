import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { ShoppingListItem, StockEntryWithProduct } from '@/types/database';
import {
  findExistingItem,
  computeBelowMinStock,
  computeExpiredProducts,
  computeOverdueProducts,
} from '../shopping-list-utils';

// Mock current date for deterministic expiry tests
const MOCK_TODAY = new Date('2025-02-01T00:00:00.000Z');

// ============================================
// Test helpers
// ============================================

const mockItem = (overrides: Partial<ShoppingListItem> = {}): ShoppingListItem => ({
  id: 'item-1',
  household_id: 'hh-1',
  shopping_list_id: 'list-1',
  product_id: 'prod-1',
  note: null,
  amount: 1,
  qu_id: null,
  done: false,
  sort_order: 0,
  created_at: '2025-01-01',
  ...overrides,
});

const mockProduct = (overrides: Record<string, unknown> = {}) => ({
  id: 'prod-1',
  household_id: 'hh-1',
  name: 'Milk',
  description: null,
  active: true,
  picture_file_name: null,
  location_id: 'loc-1',
  default_consume_location_id: null,
  shopping_location_id: null,
  move_on_open: false,
  product_group_id: null,
  qu_id_stock: 'qu-1',
  qu_id_purchase: 'qu-1',
  min_stock_amount: 5,
  quick_consume_amount: 1,
  quick_open_amount: 1,
  treat_opened_as_out_of_stock: false,
  due_type: 1 as const,
  default_due_days: 14,
  default_due_days_after_open: 0,
  default_due_days_after_freezing: 0,
  default_due_days_after_thawing: 0,
  should_not_be_frozen: false,
  calories: null,
  enable_tare_weight_handling: false,
  tare_weight: 0,
  parent_product_id: null,
  no_own_stock: false,
  cumulate_min_stock_amount_of_sub_products: false,
  not_check_stock_fulfillment_for_recipes: false,
  default_stock_label_type: 0 as const,
  auto_reprint_stock_label: false,
  hide_on_stock_overview: false,
  created_at: '2025-01-01',
  updated_at: '2025-01-01',
  ...overrides,
});

const mockEntry = (overrides: Partial<StockEntryWithProduct> = {}): StockEntryWithProduct => ({
  id: 'entry-1',
  household_id: 'hh-1',
  product_id: 'prod-1',
  amount: 3,
  best_before_date: '2025-03-01',
  purchased_date: '2025-01-15',
  price: 2.5,
  location_id: 'loc-1',
  shopping_location_id: null,
  open: false,
  opened_date: null,
  stock_id: 'stock-1',
  note: null,
  created_at: '2025-01-15',
  updated_at: '2025-01-15',
  product: mockProduct(),
  ...overrides,
});

// ============================================
// Tests
// ============================================

describe('shopping-list-utils', () => {
  // ============================================
  // findExistingItem
  // ============================================

  describe('findExistingItem', () => {
    it('returns matching undone item for given productId', () => {
      const items = [
        mockItem({ id: 'a', product_id: 'prod-1', done: false }),
        mockItem({ id: 'b', product_id: 'prod-2', done: false }),
      ];
      const result = findExistingItem(items, 'prod-1');
      expect(result).toBeDefined();
      expect(result!.id).toBe('a');
    });

    it('returns undefined when product not in list', () => {
      const items = [mockItem({ product_id: 'prod-1' })];
      expect(findExistingItem(items, 'prod-99')).toBeUndefined();
    });

    it('ignores done items', () => {
      const items = [mockItem({ product_id: 'prod-1', done: true })];
      expect(findExistingItem(items, 'prod-1')).toBeUndefined();
    });

    it('returns undefined for empty list', () => {
      expect(findExistingItem([], 'prod-1')).toBeUndefined();
    });
  });

  // ============================================
  // computeBelowMinStock
  // ============================================

  describe('computeBelowMinStock', () => {
    it('returns products below min stock', () => {
      const entries = [mockEntry({ product_id: 'prod-1', amount: 2 })];
      const products = [mockProduct({ id: 'prod-1', min_stock_amount: 5 })];

      const result = computeBelowMinStock(entries, products);
      expect(result).toHaveLength(1);
      expect(result[0].productId).toBe('prod-1');
      expect(result[0].missingAmount).toBe(3); // 5 - 2
    });

    it('skips products at or above min stock', () => {
      const entries = [mockEntry({ product_id: 'prod-1', amount: 5 })];
      const products = [mockProduct({ id: 'prod-1', min_stock_amount: 5 })];

      expect(computeBelowMinStock(entries, products)).toHaveLength(0);
    });

    it('skips products with min_stock_amount = 0', () => {
      const entries = [mockEntry({ product_id: 'prod-1', amount: 0 })];
      const products = [mockProduct({ id: 'prod-1', min_stock_amount: 0 })];

      expect(computeBelowMinStock(entries, products)).toHaveLength(0);
    });

    it('returns full min_stock_amount when product has no entries', () => {
      const entries: StockEntryWithProduct[] = [];
      const products = [mockProduct({ id: 'prod-1', min_stock_amount: 5, qu_id_purchase: 'qu-1' })];

      const result = computeBelowMinStock(entries, products);
      expect(result).toHaveLength(1);
      expect(result[0].missingAmount).toBe(5);
      expect(result[0].quId).toBe('qu-1');
    });

    it('aggregates multiple entries for same product', () => {
      const entries = [
        mockEntry({ id: 'e1', product_id: 'prod-1', amount: 1 }),
        mockEntry({ id: 'e2', product_id: 'prod-1', amount: 2 }),
      ];
      const products = [mockProduct({ id: 'prod-1', min_stock_amount: 5 })];

      const result = computeBelowMinStock(entries, products);
      expect(result).toHaveLength(1);
      expect(result[0].missingAmount).toBe(2); // 5 - (1 + 2) = 2
    });

    it('handles multiple products', () => {
      const entries = [
        mockEntry({ id: 'e1', product_id: 'prod-1', amount: 1, product: mockProduct({ id: 'prod-1' }) }),
        mockEntry({ id: 'e2', product_id: 'prod-2', amount: 10, product: mockProduct({ id: 'prod-2' }) }),
      ];
      const products = [
        mockProduct({ id: 'prod-1', min_stock_amount: 5 }),
        mockProduct({ id: 'prod-2', min_stock_amount: 3 }),
      ];

      const result = computeBelowMinStock(entries, products);
      // Only prod-1 is below min (1 < 5), prod-2 is above (10 >= 3)
      expect(result).toHaveLength(1);
      expect(result[0].productId).toBe('prod-1');
    });
  });

  // ============================================
  // computeExpiredProducts
  // ============================================

  describe('computeExpiredProducts', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(MOCK_TODAY);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns products with expired entries that are below min stock', () => {
      const entries = [
        mockEntry({
          product_id: 'prod-1',
          amount: 2,
          best_before_date: '2025-01-15', // expired (before Feb 1)
          product: mockProduct({ id: 'prod-1', due_type: 2 }), // due_type 2 = expiration
        }),
      ];
      const products = [mockProduct({ id: 'prod-1', min_stock_amount: 5 })];

      const result = computeExpiredProducts(entries, products);
      expect(result).toHaveLength(1);
      expect(result[0].productId).toBe('prod-1');
      expect(result[0].missingAmount).toBe(3); // 5 - 2
    });

    it('skips products with no expired entries', () => {
      const entries = [
        mockEntry({
          product_id: 'prod-1',
          amount: 2,
          best_before_date: '2025-06-01', // far in future
          product: mockProduct({ id: 'prod-1', due_type: 2 }),
        }),
      ];
      const products = [mockProduct({ id: 'prod-1', min_stock_amount: 5 })];

      expect(computeExpiredProducts(entries, products)).toHaveLength(0);
    });

    it('skips products with min_stock_amount = 0 even if expired', () => {
      const entries = [
        mockEntry({
          product_id: 'prod-1',
          amount: 2,
          best_before_date: '2025-01-15',
          product: mockProduct({ id: 'prod-1', due_type: 2, min_stock_amount: 0 }),
        }),
      ];
      const products = [mockProduct({ id: 'prod-1', min_stock_amount: 0 })];

      expect(computeExpiredProducts(entries, products)).toHaveLength(0);
    });

    it('uses "expired" status (due_type=2), not "overdue" (due_type=1)', () => {
      // due_type=1 past dates are "overdue", not "expired"
      const entries = [
        mockEntry({
          product_id: 'prod-1',
          amount: 2,
          best_before_date: '2025-01-15',
          product: mockProduct({ id: 'prod-1', due_type: 1 }),
        }),
      ];
      const products = [mockProduct({ id: 'prod-1', min_stock_amount: 5 })];

      // due_type=1 + past date = "overdue", NOT "expired"
      expect(computeExpiredProducts(entries, products)).toHaveLength(0);
    });
  });

  // ============================================
  // computeOverdueProducts
  // ============================================

  describe('computeOverdueProducts', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(MOCK_TODAY);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns products with overdue entries that are below min stock', () => {
      const entries = [
        mockEntry({
          product_id: 'prod-1',
          amount: 2,
          best_before_date: '2025-01-15', // past date
          product: mockProduct({ id: 'prod-1', due_type: 1 }), // due_type 1 = best before → overdue
        }),
      ];
      const products = [mockProduct({ id: 'prod-1', min_stock_amount: 5 })];

      const result = computeOverdueProducts(entries, products);
      expect(result).toHaveLength(1);
      expect(result[0].productId).toBe('prod-1');
      expect(result[0].missingAmount).toBe(3); // 5 - 2
    });

    it('skips products with no overdue entries', () => {
      const entries = [
        mockEntry({
          product_id: 'prod-1',
          amount: 2,
          best_before_date: '2025-06-01', // future
          product: mockProduct({ id: 'prod-1', due_type: 1 }),
        }),
      ];
      const products = [mockProduct({ id: 'prod-1', min_stock_amount: 5 })];

      expect(computeOverdueProducts(entries, products)).toHaveLength(0);
    });

    it('uses "overdue" status (due_type=1), not "expired" (due_type=2)', () => {
      // due_type=2 past dates are "expired", not "overdue"
      const entries = [
        mockEntry({
          product_id: 'prod-1',
          amount: 2,
          best_before_date: '2025-01-15',
          product: mockProduct({ id: 'prod-1', due_type: 2 }),
        }),
      ];
      const products = [mockProduct({ id: 'prod-1', min_stock_amount: 5 })];

      // due_type=2 + past date = "expired", NOT "overdue"
      expect(computeOverdueProducts(entries, products)).toHaveLength(0);
    });
  });
});
