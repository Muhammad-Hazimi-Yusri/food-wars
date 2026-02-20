import { describe, it, expect, beforeEach, vi } from 'vitest';

// ============================================
// Supabase mock setup
// ============================================

type Operation =
  | { type: 'delete'; table: string; id: string }
  | { type: 'update'; table: string; id: string; data: Record<string, unknown> }
  | { type: 'insert'; table: string; data: Record<string, unknown> }
  | { type: 'select'; table: string };

let operations: Operation[] = [];
let mockInsertResult: { id: string } | null = { id: 'barcode-1' };
let mockSelectResult: Record<string, unknown> | null = null;

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
    const insertChain: Record<string, unknown> = {};
    insertChain.select = vi.fn(() => {
      const selectChain: Record<string, unknown> = {};
      selectChain.single = vi.fn(() => ({
        data: mockInsertResult,
        error: null,
      }));
      return selectChain;
    });
    return insertChain;
  });

  chain.select = vi.fn(() => {
    const selectChain: Record<string, unknown> = {};
    selectChain.eq = vi.fn(() => {
      const eqChain: Record<string, unknown> = {};
      eqChain.eq = vi.fn(() => {
        const innerChain: Record<string, unknown> = {};
        innerChain.limit = vi.fn(() => {
          const limitChain: Record<string, unknown> = {};
          limitChain.maybeSingle = vi.fn(() => ({
            data: mockSelectResult,
            error: null,
          }));
          return limitChain;
        });
        return innerChain;
      });
      return eqChain;
    });
    return selectChain;
  });

  return chain;
}

const mockSupabase = {
  auth: {
    getUser: vi.fn(() =>
      Promise.resolve({ data: { user: { id: 'user-1', is_anonymous: false } } })
    ),
  },
  from: vi.fn((table: string) => createMockChain(table)),
};

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => mockSupabase,
}));

vi.mock('@/lib/supabase/get-household', () => ({
  getHouseholdId: vi.fn(() =>
    Promise.resolve({ success: true, householdId: 'hh-1', userId: 'user-1' })
  ),
}));

const { addBarcode, updateBarcode, deleteBarcode, lookupBarcodeLocal } =
  await import('../barcode-actions');
const { getHouseholdId } = await import('@/lib/supabase/get-household');

// ============================================
// Tests
// ============================================

describe('barcode-actions', () => {
  beforeEach(() => {
    operations = [];
    mockInsertResult = { id: 'barcode-1' };
    mockSelectResult = null;
    vi.clearAllMocks();
    vi.mocked(getHouseholdId).mockResolvedValue({
      success: true,
      householdId: 'hh-1',
      userId: 'user-1',
    });
  });

  // ============================================
  // addBarcode
  // ============================================

  describe('addBarcode', () => {
    it('inserts a barcode with required fields', async () => {
      const result = await addBarcode({
        productId: 'prod-1',
        barcode: '5000159484695',
      });

      expect(result.success).toBe(true);
      expect(result.barcodeId).toBe('barcode-1');

      const inserts = operations.filter(
        (op) => op.type === 'insert' && op.table === 'product_barcodes'
      );
      expect(inserts).toHaveLength(1);

      const data = (inserts[0] as { data: Record<string, unknown> }).data;
      expect(data.household_id).toBe('hh-1');
      expect(data.product_id).toBe('prod-1');
      expect(data.barcode).toBe('5000159484695');
      expect(data.qu_id).toBeNull();
      expect(data.amount).toBeNull();
    });

    it('inserts a barcode with all optional fields', async () => {
      const result = await addBarcode({
        productId: 'prod-1',
        barcode: '5000159484695',
        quId: 'qu-1',
        amount: 6,
        shoppingLocationId: 'store-1',
        lastPrice: 3.5,
        note: '6-pack',
      });

      expect(result.success).toBe(true);

      const inserts = operations.filter(
        (op) => op.type === 'insert' && op.table === 'product_barcodes'
      );
      const data = (inserts[0] as { data: Record<string, unknown> }).data;
      expect(data.qu_id).toBe('qu-1');
      expect(data.amount).toBe(6);
      expect(data.shopping_location_id).toBe('store-1');
      expect(data.last_price).toBe(3.5);
      expect(data.note).toBe('6-pack');
    });

    it('returns error when not authenticated', async () => {
      vi.mocked(getHouseholdId).mockResolvedValue({
        success: false,
        error: 'Not authenticated',
      });

      const result = await addBarcode({
        productId: 'prod-1',
        barcode: '1234567890',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Not authenticated');
    });
  });

  // ============================================
  // updateBarcode
  // ============================================

  describe('updateBarcode', () => {
    it('updates barcode fields', async () => {
      const result = await updateBarcode('barcode-1', {
        barcode: '9999999999999',
        amount: 12,
      });

      expect(result.success).toBe(true);

      const updates = operations.filter(
        (op) => op.type === 'update' && op.table === 'product_barcodes'
      );
      expect(updates).toHaveLength(1);
      expect((updates[0] as { id: string }).id).toBe('barcode-1');
      expect(
        (updates[0] as { data: Record<string, unknown> }).data.barcode
      ).toBe('9999999999999');
      expect(
        (updates[0] as { data: Record<string, unknown> }).data.amount
      ).toBe(12);
    });
  });

  // ============================================
  // deleteBarcode
  // ============================================

  describe('deleteBarcode', () => {
    it('deletes a barcode by ID', async () => {
      const result = await deleteBarcode('barcode-1');

      expect(result.success).toBe(true);

      const deletes = operations.filter(
        (op) => op.type === 'delete' && op.table === 'product_barcodes'
      );
      expect(deletes).toHaveLength(1);
      expect((deletes[0] as { id: string }).id).toBe('barcode-1');
    });
  });

  // ============================================
  // lookupBarcodeLocal
  // ============================================

  describe('lookupBarcodeLocal', () => {
    it('returns null when barcode not found', async () => {
      mockSelectResult = null;
      const result = await lookupBarcodeLocal('0000000000000');
      expect(result).toBeNull();
    });

    it('returns null when not authenticated', async () => {
      vi.mocked(getHouseholdId).mockResolvedValue({
        success: false,
        error: 'Not authenticated',
      });

      const result = await lookupBarcodeLocal('5000159484695');
      expect(result).toBeNull();
    });

    it('returns match with product when barcode found', async () => {
      mockSelectResult = {
        id: 'barcode-1',
        household_id: 'hh-1',
        product_id: 'prod-1',
        barcode: '5000159484695',
        qu_id: 'qu-1',
        amount: 6,
        shopping_location_id: null,
        last_price: null,
        note: null,
        created_at: '2025-01-01',
        product: { id: 'prod-1', name: 'Baked Beans' },
      };

      const result = await lookupBarcodeLocal('5000159484695');

      expect(result).not.toBeNull();
      expect(result!.barcode.barcode).toBe('5000159484695');
      expect(result!.product.name).toBe('Baked Beans');
      expect(result!.barcode.amount).toBe(6);
    });
  });
});
