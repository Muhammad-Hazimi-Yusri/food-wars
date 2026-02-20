import { createClient } from '@/lib/supabase/client';
import { getHouseholdId } from '@/lib/supabase/get-household';
import type { ProductBarcode } from '@/types/database';

type ActionResult = {
  success: boolean;
  error?: string;
};

type AddBarcodeParams = {
  productId: string;
  barcode: string;
  quId?: string | null;
  amount?: number | null;
  shoppingLocationId?: string | null;
  lastPrice?: number | null;
  note?: string | null;
};

/**
 * Add a barcode to a product.
 */
export async function addBarcode(
  params: AddBarcodeParams
): Promise<ActionResult & { barcodeId?: string }> {
  try {
    const supabase = createClient();
    const household = await getHouseholdId(supabase);
    if (!household.success) return { success: false, error: household.error };

    const { data, error } = await supabase
      .from('product_barcodes')
      .insert({
        household_id: household.householdId,
        product_id: params.productId,
        barcode: params.barcode,
        qu_id: params.quId ?? null,
        amount: params.amount ?? null,
        shopping_location_id: params.shoppingLocationId ?? null,
        last_price: params.lastPrice ?? null,
        note: params.note ?? null,
      })
      .select('id')
      .single();
    if (error) throw error;

    return { success: true, barcodeId: data?.id };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to add barcode',
    };
  }
}

/**
 * Update an existing barcode entry.
 */
export async function updateBarcode(
  barcodeId: string,
  updates: Partial<
    Pick<
      ProductBarcode,
      'barcode' | 'qu_id' | 'amount' | 'shopping_location_id' | 'last_price' | 'note'
    >
  >
): Promise<ActionResult> {
  try {
    const supabase = createClient();
    const { error } = await supabase
      .from('product_barcodes')
      .update(updates)
      .eq('id', barcodeId);
    if (error) throw error;
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update barcode',
    };
  }
}

/**
 * Delete a barcode entry.
 */
export async function deleteBarcode(
  barcodeId: string
): Promise<ActionResult> {
  try {
    const supabase = createClient();
    const { error } = await supabase
      .from('product_barcodes')
      .delete()
      .eq('id', barcodeId);
    if (error) throw error;
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to delete barcode',
    };
  }
}

export type BarcodeMatch = {
  barcode: ProductBarcode;
  product: {
    id: string;
    name: string;
  };
};

/**
 * Look up a barcode in the local product_barcodes table.
 * Returns the matched barcode entry and its product, or null if not found.
 */
export async function lookupBarcodeLocal(
  barcodeValue: string
): Promise<BarcodeMatch | null> {
  try {
    const supabase = createClient();
    const household = await getHouseholdId(supabase);
    if (!household.success) return null;

    const { data, error } = await supabase
      .from('product_barcodes')
      .select('*, product:products!product_barcodes_product_id_fkey(id, name)')
      .eq('household_id', household.householdId)
      .eq('barcode', barcodeValue.trim())
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;

    const product = Array.isArray(data.product)
      ? data.product[0]
      : data.product;
    if (!product) return null;

    return {
      barcode: {
        id: data.id,
        household_id: data.household_id,
        product_id: data.product_id,
        barcode: data.barcode,
        qu_id: data.qu_id,
        amount: data.amount,
        shopping_location_id: data.shopping_location_id,
        last_price: data.last_price,
        note: data.note,
        created_at: data.created_at,
      },
      product: { id: product.id, name: product.name },
    };
  } catch {
    return null;
  }
}
