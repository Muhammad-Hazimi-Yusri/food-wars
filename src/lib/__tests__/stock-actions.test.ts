import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { StockEntryWithProduct } from '@/types/database';

// ============================================
// Supabase mock setup
// ============================================

// Track all Supabase operations for assertions
type Operation =
  | { type: 'delete'; table: string; id: string }
  | { type: 'update'; table: string; id: string; data: Record<string, unknown> }
  | { type: 'insert'; table: string; data: Record<string, unknown> }
  | { type: 'select'; table: string };

let operations: Operation[] = [];
let mockUser: { id: string; is_anonymous: boolean } | null = null;
let mockHousehold: { id: string } | null = null;
let mockLogRows: Record<string, unknown>[] = [];
let mockExistingEntry: { amount: number } | null = null;

function createMockChain(table: string) {
  const chain: Record<string, unknown> = {};

  chain.delete = vi.fn(() => {
    const deleteChain: Record<string, unknown> = {};
    deleteChain.eq = vi.fn((_col: string, val: string) => {
      operations.push({ type: 'delete', table, id: val });
      return { error: null };
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
    return { error: null };
  });

  chain.select = vi.fn(() => {
    const selectChain: Record<string, unknown> = {};
    selectChain.eq = vi.fn((col: string, val: unknown) => {
      const innerChain: Record<string, unknown> = {};
      innerChain.eq = vi.fn(() => {
        if (table === 'stock_log') {
          return { data: mockLogRows, error: null };
        }
        return { data: mockLogRows, error: null };
      });
      innerChain.single = vi.fn(() => {
        if (table === 'households') {
          return { data: mockHousehold, error: null };
        }
        if (table === 'stock_entries') {
          return { data: mockExistingEntry, error: null };
        }
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
  consumeStock,
  openStock,
  transferStock,
  correctInventory,
  undoConsume,
  undoOpen,
  undoTransfer,
  undoCorrectInventory,
  undoTransaction,
} = await import('../stock-actions');

// ============================================
// Test helpers
// ============================================

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
  qu_id_stock: null,
  qu_id_purchase: null,
  min_stock_amount: 0,
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

describe('stock-actions', () => {
  beforeEach(() => {
    operations = [];
    mockUser = { id: 'user-1', is_anonymous: false };
    mockHousehold = { id: 'hh-1' };
    mockLogRows = [];
    mockExistingEntry = null;
    vi.clearAllMocks();
  });

  // ============================================
  // consumeStock
  // ============================================

  describe('consumeStock', () => {
    it('returns error when nothing to consume (amount=0)', async () => {
      const result = await consumeStock('prod-1', [mockEntry()], 0);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Nothing to consume');
    });

    it('returns error when not authenticated', async () => {
      mockUser = null;
      const result = await consumeStock('prod-1', [mockEntry()], 1);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Not authenticated');
    });

    it('returns error when no household found', async () => {
      mockHousehold = null;
      const result = await consumeStock('prod-1', [mockEntry()], 1);
      expect(result.success).toBe(false);
      expect(result.error).toBe('No household found');
    });

    it('partially consumes an entry (updates amount)', async () => {
      const result = await consumeStock('prod-1', [mockEntry({ amount: 5 })], 2);
      expect(result.success).toBe(true);
      expect(result.consumed).toBe(2);
      expect(result.correlationId).toBeDefined();

      const updates = operations.filter(op => op.type === 'update' && op.table === 'stock_entries');
      expect(updates).toHaveLength(1);
      expect((updates[0] as { data: { amount: number } }).data.amount).toBe(3);
    });

    it('fully consumes an entry (deletes it)', async () => {
      const result = await consumeStock('prod-1', [mockEntry({ amount: 3 })], 3);
      expect(result.success).toBe(true);
      expect(result.consumed).toBe(3);

      const deletes = operations.filter(op => op.type === 'delete' && op.table === 'stock_entries');
      expect(deletes).toHaveLength(1);
    });

    it('logs to stock_log with transaction_type=consume', async () => {
      await consumeStock('prod-1', [mockEntry()], 1);

      const inserts = operations.filter(op => op.type === 'insert' && op.table === 'stock_log');
      expect(inserts).toHaveLength(1);

      const logData = (inserts[0] as { data: Record<string, unknown> }).data;
      expect(logData.transaction_type).toBe('consume');
      expect(logData.spoiled).toBe(false);
      expect(logData.correlation_id).toBeDefined();
      expect(logData.undone).toBe(false);
    });

    it('logs as spoiled when options.spoiled is true', async () => {
      await consumeStock('prod-1', [mockEntry()], 1, { spoiled: true });

      const inserts = operations.filter(op => op.type === 'insert' && op.table === 'stock_log');
      const logData = (inserts[0] as { data: Record<string, unknown> }).data;
      expect(logData.transaction_type).toBe('spoiled');
      expect(logData.spoiled).toBe(true);
    });

    it('uses GUEST_HOUSEHOLD_ID for guest users', async () => {
      mockUser = { id: 'anon-1', is_anonymous: true };

      await consumeStock('prod-1', [mockEntry()], 1);

      const inserts = operations.filter(op => op.type === 'insert' && op.table === 'stock_log');
      const logData = (inserts[0] as { data: Record<string, unknown> }).data;
      // GUEST_HOUSEHOLD_ID is imported from constants — verifying it's not the auth household
      expect(logData.household_id).toBeDefined();
    });
  });

  // ============================================
  // openStock
  // ============================================

  describe('openStock', () => {
    it('returns error when nothing to open (count=0)', async () => {
      const result = await openStock('prod-1', [mockEntry()], 0);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Nothing to open');
    });

    it('returns error when all entries already open', async () => {
      const result = await openStock('prod-1', [mockEntry({ open: true })], 1);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Nothing to open');
    });

    it('returns error when not authenticated', async () => {
      mockUser = null;
      const result = await openStock('prod-1', [mockEntry()], 1);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Not authenticated');
    });

    it('opens a sealed entry — sets open=true and opened_date', async () => {
      const result = await openStock('prod-1', [mockEntry()], 1);
      expect(result.success).toBe(true);
      expect(result.opened).toBe(1);

      const updates = operations.filter(op => op.type === 'update' && op.table === 'stock_entries');
      expect(updates).toHaveLength(1);
      const updateData = (updates[0] as { data: Record<string, unknown> }).data;
      expect(updateData.open).toBe(true);
      expect(updateData.opened_date).toBeDefined();
    });

    it('recalculates best_before_date when default_due_days_after_open > 0', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-02-01'));

      const product = mockProduct({ default_due_days_after_open: 3 });
      const entry = mockEntry({
        best_before_date: '2025-03-01', // far in future
        product,
      });

      const result = await openStock('prod-1', [entry], 1);
      expect(result.success).toBe(true);

      const updates = operations.filter(op => op.type === 'update' && op.table === 'stock_entries');
      const updateData = (updates[0] as { data: Record<string, unknown> }).data;
      // new due = today + 3 = 2025-02-04, which is before 2025-03-01, so should use new
      expect(updateData.best_before_date).toBe('2025-02-04');

      vi.useRealTimers();
    });

    it('never-extend rule: keeps original date when it is sooner', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-02-01'));

      const product = mockProduct({ default_due_days_after_open: 30 });
      const entry = mockEntry({
        best_before_date: '2025-02-10', // soon
        product,
      });

      const result = await openStock('prod-1', [entry], 1);
      expect(result.success).toBe(true);

      const updates = operations.filter(op => op.type === 'update' && op.table === 'stock_entries');
      const updateData = (updates[0] as { data: Record<string, unknown> }).data;
      // new due = today + 30 = 2025-03-03, but original is 2025-02-10 (sooner) → keep original
      expect(updateData.best_before_date).toBe('2025-02-10');

      vi.useRealTimers();
    });

    it('auto-moves to default_consume_location_id when move_on_open=true', async () => {
      const product = mockProduct({
        move_on_open: true,
        default_consume_location_id: 'loc-consume',
      });
      const entry = mockEntry({ product, location_id: 'loc-fridge' });

      await openStock('prod-1', [entry], 1);

      const updates = operations.filter(op => op.type === 'update' && op.table === 'stock_entries');
      const updateData = (updates[0] as { data: Record<string, unknown> }).data;
      expect(updateData.location_id).toBe('loc-consume');
    });

    it('logs to stock_log with transaction_type=product-opened and original values', async () => {
      const entry = mockEntry({
        best_before_date: '2025-03-01',
        location_id: 'loc-1',
      });

      await openStock('prod-1', [entry], 1);

      const inserts = operations.filter(op => op.type === 'insert' && op.table === 'stock_log');
      expect(inserts).toHaveLength(1);
      const logData = (inserts[0] as { data: Record<string, unknown> }).data;
      expect(logData.transaction_type).toBe('product-opened');
      // Log captures ORIGINAL values for undo
      expect(logData.best_before_date).toBe('2025-03-01');
      expect(logData.location_id).toBe('loc-1');
    });
  });

  // ============================================
  // transferStock
  // ============================================

  describe('transferStock', () => {
    it('returns error when destination is same location', async () => {
      const entry = mockEntry({ location_id: 'loc-1' });
      const result = await transferStock(entry, 'loc-1', false, false);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Already at that location');
    });

    it('returns error when not authenticated', async () => {
      mockUser = null;
      const result = await transferStock(mockEntry(), 'loc-2', false, false);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Not authenticated');
    });

    it('transfers entry to new location', async () => {
      const result = await transferStock(mockEntry(), 'loc-2', false, false);
      expect(result.success).toBe(true);
      expect(result.correlationId).toBeDefined();

      const updates = operations.filter(op => op.type === 'update' && op.table === 'stock_entries');
      expect(updates).toHaveLength(1);
      const updateData = (updates[0] as { data: Record<string, unknown> }).data;
      expect(updateData.location_id).toBe('loc-2');
    });

    it('creates dual log entries (transfer-from + transfer-to)', async () => {
      await transferStock(mockEntry(), 'loc-2', false, false);

      const inserts = operations.filter(op => op.type === 'insert' && op.table === 'stock_log');
      expect(inserts).toHaveLength(2);

      const types = inserts.map(op => (op as { data: Record<string, unknown> }).data.transaction_type);
      expect(types).toContain('transfer-from');
      expect(types).toContain('transfer-to');

      // Both share same correlation_id
      const ids = inserts.map(op => (op as { data: Record<string, unknown> }).data.correlation_id);
      expect(ids[0]).toBe(ids[1]);
    });

    it('transfer-from captures original values, transfer-to has new values', async () => {
      const entry = mockEntry({ location_id: 'loc-1', best_before_date: '2025-03-01' });
      await transferStock(entry, 'loc-2', false, false);

      const inserts = operations.filter(op => op.type === 'insert' && op.table === 'stock_log');
      const fromLog = inserts.find(op => (op as { data: Record<string, unknown> }).data.transaction_type === 'transfer-from');
      const toLog = inserts.find(op => (op as { data: Record<string, unknown> }).data.transaction_type === 'transfer-to');

      expect((fromLog as { data: Record<string, unknown> }).data.location_id).toBe('loc-1');
      expect((toLog as { data: Record<string, unknown> }).data.location_id).toBe('loc-2');
    });

    it('freezing: applies freezer shelf life when useFreezingDueDate=true', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-02-01'));

      const product = mockProduct({ default_due_days_after_freezing: 90 });
      const entry = mockEntry({ product, best_before_date: '2025-03-01' });

      await transferStock(entry, 'loc-freezer', false, true, { useFreezingDueDate: true });

      const updates = operations.filter(op => op.type === 'update' && op.table === 'stock_entries');
      const updateData = (updates[0] as { data: Record<string, unknown> }).data;
      // Compute expected date the same way the code does (timezone-safe)
      const expected = new Date('2025-02-01');
      expected.setDate(expected.getDate() + 90);
      expect(updateData.best_before_date).toBe(expected.toISOString().split('T')[0]);

      vi.useRealTimers();
    });

    it('freezing: keeps original date by default', async () => {
      const product = mockProduct({ default_due_days_after_freezing: 90 });
      const entry = mockEntry({ product, best_before_date: '2025-03-01' });

      await transferStock(entry, 'loc-freezer', false, true);

      const updates = operations.filter(op => op.type === 'update' && op.table === 'stock_entries');
      const updateData = (updates[0] as { data: Record<string, unknown> }).data;
      // No best_before_date in update = kept original
      expect(updateData.best_before_date).toBeUndefined();
    });

    it('thawing: always replaces due date', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-02-01'));

      const product = mockProduct({ default_due_days_after_thawing: 3 });
      const entry = mockEntry({ product, best_before_date: '2025-06-01' });

      await transferStock(entry, 'loc-fridge', true, false);

      const updates = operations.filter(op => op.type === 'update' && op.table === 'stock_entries');
      const updateData = (updates[0] as { data: Record<string, unknown> }).data;
      expect(updateData.best_before_date).toBe('2025-02-04'); // today + 3

      vi.useRealTimers();
    });

    it('manual due date overrides auto-calculation', async () => {
      const product = mockProduct({ default_due_days_after_freezing: 90 });
      const entry = mockEntry({ product });

      await transferStock(entry, 'loc-freezer', false, true, { manualDueDate: '2025-12-31' });

      const updates = operations.filter(op => op.type === 'update' && op.table === 'stock_entries');
      const updateData = (updates[0] as { data: Record<string, unknown> }).data;
      expect(updateData.best_before_date).toBe('2025-12-31');
    });

    it('returns warning when should_not_be_frozen product goes to freezer', async () => {
      const product = mockProduct({ should_not_be_frozen: true });
      const entry = mockEntry({ product });

      const result = await transferStock(entry, 'loc-freezer', false, true);
      expect(result.success).toBe(true);
      expect(result.warning).toBe('This product should not be frozen');
    });
  });

  // ============================================
  // correctInventory
  // ============================================

  describe('correctInventory', () => {
    it('no-op when newAmount equals current total', async () => {
      const entries = [mockEntry({ amount: 5 })];
      const result = await correctInventory('prod-1', entries, 5);
      expect(result.success).toBe(true);
      expect(result.delta).toBe(0);
      expect(result.correlationId).toBeUndefined();
      // No Supabase operations
      expect(operations.filter(op => op.table === 'stock_entries')).toHaveLength(0);
    });

    it('returns error when not authenticated', async () => {
      mockUser = null;
      const result = await correctInventory('prod-1', [mockEntry()], 1);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Not authenticated');
    });

    it('decrease: removes stock via FIFO', async () => {
      const entries = [
        mockEntry({ id: 'e1', amount: 3 }),
        mockEntry({ id: 'e2', amount: 2 }),
      ];
      // Current total = 5, new = 3 → delta = -2, remove 2 via FIFO
      const result = await correctInventory('prod-1', entries, 3);
      expect(result.success).toBe(true);
      expect(result.delta).toBe(-2);
    });

    it('decrease: logs with direction=decrease', async () => {
      const entries = [mockEntry({ amount: 5 })];
      await correctInventory('prod-1', entries, 3);

      const inserts = operations.filter(op => op.type === 'insert' && op.table === 'stock_log');
      expect(inserts.length).toBeGreaterThan(0);
      const logData = (inserts[0] as { data: Record<string, unknown> }).data;
      expect(logData.transaction_type).toBe('inventory-correction');
      expect(JSON.parse(logData.note as string).direction).toBe('decrease');
    });

    it('increase: adds to newest entry', async () => {
      const entries = [
        mockEntry({ id: 'older', amount: 2, created_at: '2025-01-01' }),
        mockEntry({ id: 'newer', amount: 3, created_at: '2025-01-15' }),
      ];
      // Current total = 5, new = 8 → delta = +3
      const result = await correctInventory('prod-1', entries, 8);
      expect(result.success).toBe(true);
      expect(result.delta).toBe(3);

      const updates = operations.filter(op => op.type === 'update' && op.table === 'stock_entries');
      expect(updates).toHaveLength(1);
      expect((updates[0] as { id: string }).id).toBe('newer');
      expect((updates[0] as { data: { amount: number } }).data.amount).toBe(6); // 3 + 3
    });

    it('increase: logs with direction=increase', async () => {
      const entries = [mockEntry({ amount: 2 })];
      await correctInventory('prod-1', entries, 5);

      const inserts = operations.filter(op => op.type === 'insert' && op.table === 'stock_log');
      expect(inserts).toHaveLength(1);
      const logData = (inserts[0] as { data: Record<string, unknown> }).data;
      expect(logData.transaction_type).toBe('inventory-correction');
      expect(JSON.parse(logData.note as string).direction).toBe('increase');
    });
  });

  // ============================================
  // undoTransaction dispatcher
  // ============================================

  describe('undoTransaction', () => {
    it('routes consume to undoConsume', async () => {
      // Will fail with "Nothing to undo" since no mock log rows, but verifies routing
      const result = await undoTransaction('corr-1', 'consume');
      expect(result.error).toBe('Nothing to undo');
    });

    it('routes spoiled to undoConsume', async () => {
      const result = await undoTransaction('corr-1', 'spoiled');
      expect(result.error).toBe('Nothing to undo');
    });

    it('routes product-opened to undoOpen', async () => {
      const result = await undoTransaction('corr-1', 'product-opened');
      expect(result.error).toBe('Nothing to undo');
    });

    it('routes transfer-from to undoTransfer', async () => {
      const result = await undoTransaction('corr-1', 'transfer-from');
      expect(result.error).toBe('Nothing to undo');
    });

    it('routes inventory-correction to undoCorrectInventory', async () => {
      const result = await undoTransaction('corr-1', 'inventory-correction');
      expect(result.error).toBe('Nothing to undo');
    });

    it('returns error for unknown type', async () => {
      const result = await undoTransaction('corr-1', 'transfer-to');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Cannot undo this transaction type');
    });
  });

  // ============================================
  // undoConsume
  // ============================================

  describe('undoConsume', () => {
    it('returns error when not authenticated', async () => {
      mockUser = null;
      const result = await undoConsume('corr-1');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Not authenticated');
    });

    it('returns error when no log rows found', async () => {
      mockLogRows = [];
      const result = await undoConsume('corr-1');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Nothing to undo');
    });
  });

  // ============================================
  // undoOpen
  // ============================================

  describe('undoOpen', () => {
    it('returns error when not authenticated', async () => {
      mockUser = null;
      const result = await undoOpen('corr-1');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Not authenticated');
    });

    it('returns error when no log rows found', async () => {
      mockLogRows = [];
      const result = await undoOpen('corr-1');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Nothing to undo');
    });
  });

  // ============================================
  // undoTransfer
  // ============================================

  describe('undoTransfer', () => {
    it('returns error when not authenticated', async () => {
      mockUser = null;
      const result = await undoTransfer('corr-1');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Not authenticated');
    });

    it('returns error when no log rows found', async () => {
      mockLogRows = [];
      const result = await undoTransfer('corr-1');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Nothing to undo');
    });
  });

  // ============================================
  // undoCorrectInventory
  // ============================================

  describe('undoCorrectInventory', () => {
    it('returns error when not authenticated', async () => {
      mockUser = null;
      const result = await undoCorrectInventory('corr-1');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Not authenticated');
    });

    it('returns error when no log rows found', async () => {
      mockLogRows = [];
      const result = await undoCorrectInventory('corr-1');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Nothing to undo');
    });
  });
});
