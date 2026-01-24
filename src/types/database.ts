// ============================================
// HOUSEHOLD
// ============================================

export type Household = {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
};

// ============================================
// MASTER DATA
// ============================================

export type Location = {
  id: string;
  household_id: string;
  name: string;
  description: string | null;
  is_freezer: boolean;
  sort_order: number;
  created_at: string;
};

export type ShoppingLocation = {
  id: string;
  household_id: string;
  name: string;
  description: string | null;
  sort_order: number;
  created_at: string;
};

export type ProductGroup = {
  id: string;
  household_id: string;
  name: string;
  description: string | null;
  sort_order: number;
  created_at: string;
};

export type QuantityUnit = {
  id: string;
  household_id: string;
  name: string;
  name_plural: string | null;
  description: string | null;
  sort_order: number;
  created_at: string;
};

export type QuantityUnitConversion = {
  id: string;
  household_id: string;
  from_qu_id: string;
  to_qu_id: string;
  factor: number;
  product_id: string | null;
  created_at: string;
};

// ============================================
// PRODUCTS
// ============================================

export type DueType = 1 | 2; // 1=best_before, 2=expiration

export type Product = {
  id: string;
  household_id: string;
  
  // Basic info
  name: string;
  description: string | null;
  active: boolean;
  picture_file_name: string | null;
  
  // Locations
  location_id: string | null;
  shopping_location_id: string | null;
  
  // Categorization
  product_group_id: string | null;
  
  // Quantity units
  qu_id_stock: string | null;
  qu_id_purchase: string | null;
  qu_factor_purchase_to_stock: number;
  
  // Stock management
  min_stock_amount: number;
  quick_consume_amount: number;
  quick_open_amount: number;
  
  // Due dates
  due_type: DueType;
  default_due_days: number;
  default_due_days_after_open: number;
  default_due_days_after_freezing: number;
  default_due_days_after_thawing: number;
  
  // Additional
  calories: number | null;
  treat_opened_as_out_of_stock: boolean;
  should_not_be_frozen: boolean;
  
  // Timestamps
  created_at: string;
  updated_at: string;
};

// ============================================
// STOCK ENTRIES
// ============================================

export type StockEntry = {
  id: string;
  household_id: string;
  product_id: string;
  
  // Quantity
  amount: number;
  
  // Dates
  best_before_date: string | null;
  purchased_date: string | null;
  
  // Price
  price: number | null;
  
  // Location
  location_id: string | null;
  shopping_location_id: string | null;
  
  // Opened tracking
  open: boolean;
  opened_date: string | null;
  
  // Additional
  stock_id: string;
  note: string | null;
  
  // Timestamps
  created_at: string;
  updated_at: string;
};

// ============================================
// JOINED TYPES (for UI display)
// ============================================

export type ProductWithRelations = Product & {
  location?: Location | null;
  shopping_location?: ShoppingLocation | null;
  product_group?: ProductGroup | null;
  qu_stock?: QuantityUnit | null;
  qu_purchase?: QuantityUnit | null;
};

export type StockEntryWithProduct = StockEntry & {
  product: ProductWithRelations;
  location?: Location | null;
};

// ============================================
// LEGACY (for guest mode compatibility)
// ============================================

/** @deprecated Use Product + StockEntry instead */
export type InventoryItem = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: string;
  expiryDate: string | null;
  createdAt: string;
};