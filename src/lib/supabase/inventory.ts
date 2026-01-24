import { createClient } from '@/lib/supabase/client';
import {
  Product,
  StockEntry,
  StockEntryWithProduct,
  Location,
  ProductGroup,
  QuantityUnit,
  ShoppingLocation,
} from '@/types/database';

// ============================================
// MASTER DATA QUERIES
// ============================================

export async function getLocations(): Promise<Location[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .order('sort_order');

  if (error) throw error;
  return data ?? [];
}

export async function getShoppingLocations(): Promise<ShoppingLocation[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('shopping_locations')
    .select('*')
    .order('sort_order');

  if (error) throw error;
  return data ?? [];
}

export async function getProductGroups(): Promise<ProductGroup[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('product_groups')
    .select('*')
    .order('sort_order');

  if (error) throw error;
  return data ?? [];
}

export async function getQuantityUnits(): Promise<QuantityUnit[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('quantity_units')
    .select('*')
    .order('sort_order');

  if (error) throw error;
  return data ?? [];
}

// ============================================
// PRODUCT QUERIES
// ============================================

export async function getProducts(): Promise<Product[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('active', true)
    .order('name');

  if (error) throw error;
  return data ?? [];
}

export async function getProduct(id: string): Promise<Product | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function createProduct(
  product: Omit<Product, 'id' | 'created_at' | 'updated_at'>
): Promise<Product> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('products')
    .insert(product)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateProduct(
  id: string,
  updates: Partial<Product>
): Promise<Product> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('products')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteProduct(id: string): Promise<void> {
  const supabase = createClient();
  // Soft delete
  const { error } = await supabase
    .from('products')
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
}

// ============================================
// STOCK ENTRY QUERIES
// ============================================

export async function getStockEntries(): Promise<StockEntryWithProduct[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('stock_entries')
    .select(`
      *,
      product:products(
        *,
        product_group:product_groups(*)
      ),
      location:locations(*)
    `)
    .gt('amount', 0)
    .order('best_before_date', { ascending: true, nullsFirst: false });

  if (error) throw error;
  return data ?? [];
}

export async function getStockEntriesForProduct(
  productId: string
): Promise<StockEntry[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('stock_entries')
    .select('*')
    .eq('product_id', productId)
    .gt('amount', 0)
    .order('best_before_date', { ascending: true, nullsFirst: false });

  if (error) throw error;
  return data ?? [];
}

export async function createStockEntry(
  entry: Omit<StockEntry, 'id' | 'stock_id' | 'created_at' | 'updated_at'>
): Promise<StockEntry> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('stock_entries')
    .insert(entry)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateStockEntry(
  id: string,
  updates: Partial<StockEntry>
): Promise<StockEntry> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('stock_entries')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteStockEntry(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('stock_entries')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ============================================
// HOUSEHOLD QUERY
// ============================================

export async function getHousehold() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('households')
    .select('*')
    .single();

  if (error) throw error;
  return data;
}