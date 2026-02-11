import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ShoppingListItem } from '@/types/database';

// ============================================
// Supabase mock setup
// ============================================

type Operation =
  | { type: 'delete'; table: string; id: string }
  | { type: 'update'; table: string; id: string; data: Record<string, unknown> }
  | { type: 'insert'; table: string; data: Record<string, unknown> }
  | { type: 'select'; table: string };

let operations: Operation[] = [];
let mockUser: { id: string; is_anonymous: boolean } | null = null;
let mockHousehold: { id: string } | null = null;
let mockInsertedId: string = 'new-item-1';
let mockDeletedIds: { id: string }[] = [];

function createMockChain(table: string) {
  const chain: Record<string, unknown> = {};

  chain.delete = vi.fn(() => {
    const deleteChain: Record<string, unknown> = {};
    deleteChain.eq = vi.fn((_col: string, val: string) => {
      operations.push({ type: 'delete', table, id: val });
      // Support chaining .eq().eq() for clearDoneItems
      const innerChain: Record<string, unknown> = {};
      innerChain.eq = vi.fn(() => {
        const selectChain: Record<string, unknown> = {};
        selectChain.select = vi.fn(() => {
          return { data: mockDeletedIds, error: null };
        });
        return { ...selectChain, error: null, data: mockDeletedIds };
      });
      innerChain.select = vi.fn(() => {
        return { data: mockDeletedIds, error: null };
      });
      return { ...innerChain, error: null };
    });
    return deleteChain;
  });

  chain.update = vi.fn((data: Record<string, unknown>) => {
    const updateChain: Record<string, unknown> = {};
    updateChain.eq = vi.fn((_col: string, val: string) => {
      operations.push({ type: 'update', table, id: val, data });
      return { error: null };
    });
    return updateChain;
  });

  chain.insert = vi.fn((data: Record<string, unknown>) => {
    operations.push({ type: 'insert', table, data });
    const insertChain: Record<string, unknown> = {};
    insertChain.select = vi.fn(() => {
      const selectChain: Record<string, unknown> = {};
      selectChain.single = vi.fn(() => ({
        data: { id: mockInsertedId },
        error: null,
      }));
      return selectChain;
    });
    return { ...insertChain, error: null };
  });

  chain.select = vi.fn(() => {
    const selectChain: Record<string, unknown> = {};
    selectChain.eq = vi.fn(() => {
      const innerChain: Record<string, unknown> = {};
      innerChain.single = vi.fn(() => {
        if (table === 'households') {
          return { data: mockHousehold, error: null };
        }
        return { data: null, error: null };
      });
      innerChain.eq = vi.fn(() => {
        return { data: null, error: null };
      });
      return innerChain;
    });
    return selectChain;
  });

  return chain;
}

const mockSupabase = {
  auth: {
    getUser: vi.fn(() => Promise.resolve({ data: { user: mockUser } })),
  },
  from: vi.fn((table: string) => createMockChain(table)),
};

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => mockSupabase,
}));

// Must import after mock setup
const {
  addItemToList,
  removeItemFromList,
  toggleItemDone,
  clearDoneItems,
  reorderItems,
  updateItemAmount,
} = await import('../shopping-list-actions');

// ============================================
// Test helpers
// ============================================

const mockItem = (overrides: Partial<ShoppingListItem> = {}): ShoppingListItem => ({
  id: 'item-1',
  household_id: 'hh-1',
  shopping_list_id: 'list-1',
  product_id: 'prod-1',
  note: null,
  amount: 2,
  qu_id: null,
  done: false,
  sort_order: 0,
  created_at: '2025-01-01',
  ...overrides,
});

// ============================================
// Tests
// ============================================

describe('shopping-list-actions', () => {
  beforeEach(() => {
    operations = [];
    mockUser = { id: 'user-1', is_anonymous: false };
    mockHousehold = { id: 'hh-1' };
    mockInsertedId = 'new-item-1';
    mockDeletedIds = [];
    vi.clearAllMocks();
  });

  // ============================================
  // addItemToList
  // ============================================

  describe('addItemToList', () => {
    it('returns error when not authenticated', async () => {
      mockUser = null;
      const result = await addItemToList('list-1', { amount: 1 });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Not authenticated');
    });

    it('returns error when no household found', async () => {
      mockHousehold = null;
      const result = await addItemToList('list-1', { amount: 1 });
      expect(result.success).toBe(false);
      expect(result.error).toBe('No household found');
    });

    it('inserts a new product-linked item', async () => {
      const result = await addItemToList('list-1', {
        productId: 'prod-1',
        amount: 3,
        quId: 'qu-1',
      });
      expect(result.success).toBe(true);
      expect(result.itemId).toBe('new-item-1');

      const inserts = operations.filter(
        (op) => op.type === 'insert' && op.table === 'shopping_list_items'
      );
      expect(inserts).toHaveLength(1);
      const data = (inserts[0] as { data: Record<string, unknown> }).data;
      expect(data.product_id).toBe('prod-1');
      expect(data.amount).toBe(3);
      expect(data.qu_id).toBe('qu-1');
      expect(data.sort_order).toBe(0); // first item
    });

    it('inserts a freeform item (no product_id)', async () => {
      const result = await addItemToList('list-1', {
        note: 'Buy bread',
        amount: 1,
      });
      expect(result.success).toBe(true);

      const inserts = operations.filter(
        (op) => op.type === 'insert' && op.table === 'shopping_list_items'
      );
      const data = (inserts[0] as { data: Record<string, unknown> }).data;
      expect(data.product_id).toBeNull();
      expect(data.note).toBe('Buy bread');
    });

    it('increments amount when duplicate product is found', async () => {
      const existingItems = [
        mockItem({ id: 'existing-1', product_id: 'prod-1', amount: 2 }),
      ];

      const result = await addItemToList(
        'list-1',
        { productId: 'prod-1', amount: 3 },
        existingItems
      );
      expect(result.success).toBe(true);
      expect(result.itemId).toBe('existing-1');

      const updates = operations.filter(
        (op) => op.type === 'update' && op.table === 'shopping_list_items'
      );
      expect(updates).toHaveLength(1);
      expect((updates[0] as { data: { amount: number } }).data.amount).toBe(5); // 2 + 3
    });

    it('does not deduplicate done items', async () => {
      const existingItems = [
        mockItem({ id: 'done-1', product_id: 'prod-1', amount: 2, done: true }),
      ];

      const result = await addItemToList(
        'list-1',
        { productId: 'prod-1', amount: 1 },
        existingItems
      );
      expect(result.success).toBe(true);

      // Should insert new, not update existing
      const inserts = operations.filter(
        (op) => op.type === 'insert' && op.table === 'shopping_list_items'
      );
      expect(inserts).toHaveLength(1);
    });

    it('computes sort_order from existing items', async () => {
      const existingItems = [
        mockItem({ sort_order: 0 }),
        mockItem({ id: 'item-2', sort_order: 3 }),
      ];

      await addItemToList('list-1', { amount: 1 }, existingItems);

      const inserts = operations.filter(
        (op) => op.type === 'insert' && op.table === 'shopping_list_items'
      );
      const data = (inserts[0] as { data: Record<string, unknown> }).data;
      expect(data.sort_order).toBe(4); // max(0, 3) + 1
    });

    it('uses GUEST_HOUSEHOLD_ID for guest users', async () => {
      mockUser = { id: 'anon-1', is_anonymous: true };

      await addItemToList('list-1', { amount: 1 });

      const inserts = operations.filter(
        (op) => op.type === 'insert' && op.table === 'shopping_list_items'
      );
      const data = (inserts[0] as { data: Record<string, unknown> }).data;
      expect(data.household_id).toBeDefined();
    });
  });

  // ============================================
  // removeItemFromList
  // ============================================

  describe('removeItemFromList', () => {
    it('deletes the item', async () => {
      const result = await removeItemFromList('item-1');
      expect(result.success).toBe(true);

      const deletes = operations.filter(
        (op) => op.type === 'delete' && op.table === 'shopping_list_items'
      );
      expect(deletes).toHaveLength(1);
      expect((deletes[0] as { id: string }).id).toBe('item-1');
    });
  });

  // ============================================
  // toggleItemDone
  // ============================================

  describe('toggleItemDone', () => {
    it('updates done to true', async () => {
      const result = await toggleItemDone('item-1', true);
      expect(result.success).toBe(true);

      const updates = operations.filter(
        (op) => op.type === 'update' && op.table === 'shopping_list_items'
      );
      expect(updates).toHaveLength(1);
      expect((updates[0] as { data: { done: boolean } }).data.done).toBe(true);
    });

    it('updates done to false', async () => {
      const result = await toggleItemDone('item-1', false);
      expect(result.success).toBe(true);

      const updates = operations.filter(
        (op) => op.type === 'update' && op.table === 'shopping_list_items'
      );
      expect((updates[0] as { data: { done: boolean } }).data.done).toBe(false);
    });
  });

  // ============================================
  // updateItemAmount
  // ============================================

  describe('updateItemAmount', () => {
    it('updates the amount', async () => {
      const result = await updateItemAmount('item-1', 5);
      expect(result.success).toBe(true);

      const updates = operations.filter(
        (op) => op.type === 'update' && op.table === 'shopping_list_items'
      );
      expect(updates).toHaveLength(1);
      expect((updates[0] as { data: { amount: number } }).data.amount).toBe(5);
    });
  });

  // ============================================
  // clearDoneItems
  // ============================================

  describe('clearDoneItems', () => {
    it('deletes done items and returns count', async () => {
      mockDeletedIds = [{ id: 'done-1' }, { id: 'done-2' }];
      const result = await clearDoneItems('list-1');
      expect(result.success).toBe(true);

      const deletes = operations.filter(
        (op) => op.type === 'delete' && op.table === 'shopping_list_items'
      );
      expect(deletes).toHaveLength(1);
      expect((deletes[0] as { id: string }).id).toBe('list-1');
    });
  });

  // ============================================
  // reorderItems
  // ============================================

  describe('reorderItems', () => {
    it('updates sort_order for each item', async () => {
      const result = await reorderItems(['id-c', 'id-a', 'id-b']);
      expect(result.success).toBe(true);

      const updates = operations.filter(
        (op) => op.type === 'update' && op.table === 'shopping_list_items'
      );
      expect(updates).toHaveLength(3);
      expect((updates[0] as { id: string; data: { sort_order: number } }).id).toBe('id-c');
      expect((updates[0] as { data: { sort_order: number } }).data.sort_order).toBe(0);
      expect((updates[1] as { id: string }).id).toBe('id-a');
      expect((updates[1] as { data: { sort_order: number } }).data.sort_order).toBe(1);
      expect((updates[2] as { id: string }).id).toBe('id-b');
      expect((updates[2] as { data: { sort_order: number } }).data.sort_order).toBe(2);
    });

    it('handles empty array', async () => {
      const result = await reorderItems([]);
      expect(result.success).toBe(true);
      expect(operations.filter((op) => op.table === 'shopping_list_items')).toHaveLength(0);
    });
  });
});
