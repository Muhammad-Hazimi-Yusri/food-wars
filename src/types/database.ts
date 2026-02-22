// ============================================
// FOOD WARS DATABASE TYPES v0.11.0
// Complete types matching Grocy schema
// ============================================

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
  active: boolean;
  sort_order: number;
  created_at: string;
};

export type ShoppingLocation = {
  id: string;
  household_id: string;
  name: string;
  description: string | null;
  active: boolean;
  sort_order: number;
  created_at: string;
};

export type ProductGroup = {
  id: string;
  household_id: string;
  name: string;
  description: string | null;
  active: boolean;
  sort_order: number;
  created_at: string;
};

export type QuantityUnit = {
  id: string;
  household_id: string;
  name: string;
  name_plural: string | null;
  description: string | null;
  active: boolean;
  sort_order: number;
  created_at: string;
};

export type QuantityUnitConversion = {
  id: string;
  household_id: string;
  from_qu_id: string;
  to_qu_id: string;
  factor: number;
  product_id: string | null; // NULL = global, set = product-specific
  created_at: string;
};

// ============================================
// PRODUCTS
// ============================================

export type DueType = 1 | 2; // 1=best_before, 2=expiration

export type StockLabelType = 0 | 1 | 2; // 0=per purchase, 1=per stock entry, 2=none

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
  default_consume_location_id: string | null;
  shopping_location_id: string | null;
  move_on_open: boolean;
  
  // Categorization
  product_group_id: string | null;
  
  // Quantity units (conversions are in quantity_unit_conversions table)
  qu_id_stock: string | null;
  qu_id_purchase: string | null;
  
  // Stock management
  min_stock_amount: number;
  quick_consume_amount: number;
  quick_open_amount: number;
  treat_opened_as_out_of_stock: boolean;
  
  // Due dates / Expiry
  due_type: DueType;
  default_due_days: number;
  default_due_days_after_open: number;
  default_due_days_after_freezing: number;
  default_due_days_after_thawing: number;
  
  // Freezing
  should_not_be_frozen: boolean;
  
  // Brand
  brand: string | null;
  is_store_brand: boolean;

  // Nutrition
  calories: number | null;
  
  // Tare weight handling (for containers)
  enable_tare_weight_handling: boolean;
  tare_weight: number;
  
  // Product hierarchy (parent/child products)
  parent_product_id: string | null;
  no_own_stock: boolean;
  cumulate_min_stock_amount_of_sub_products: boolean;
  
  // Recipe integration
  not_check_stock_fulfillment_for_recipes: boolean;
  
  // Label printing
  default_stock_label_type: StockLabelType;
  auto_reprint_stock_label: boolean;
  
  // Display
  hide_on_stock_overview: boolean;
  
  // Timestamps
  created_at: string;
  updated_at: string;
};

// ============================================
// PRODUCT NUTRITION
// ============================================

export type NutritionDataSource = 'off' | 'manual' | 'cv';

export type ProductNutrition = {
  id: string;
  household_id: string;
  product_id: string;
  energy_kj: number | null;
  energy_kcal: number | null;
  fat: number | null;
  saturated_fat: number | null;
  carbohydrates: number | null;
  sugars: number | null;
  fibre: number | null;
  protein: number | null;
  salt: number | null;
  nutrition_grade: string | null;
  data_source: NutritionDataSource;
  created_at: string;
  updated_at: string;
};

// ============================================
// PRODUCT BARCODES
// ============================================

export type ProductBarcode = {
  id: string;
  household_id: string;
  product_id: string;
  barcode: string;
  qu_id: string | null;
  amount: number | null;
  shopping_location_id: string | null;
  last_price: number | null;
  note: string | null;
  created_at: string;
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
  
  // Location tracking
  location_id: string | null;
  shopping_location_id: string | null;
  
  // Opened tracking
  open: boolean;
  opened_date: string | null;
  
  // Unique identifier for Grocycode
  stock_id: string;
  
  // Additional
  note: string | null;
  
  // Timestamps
  created_at: string;
  updated_at: string;
};

// ============================================
// STOCK LOG (transaction history)
// ============================================

export type StockTransactionType =
  | 'purchase'
  | 'consume'
  | 'spoiled'
  | 'inventory-correction'
  | 'product-opened'
  | 'transfer-from'
  | 'transfer-to'
  | 'stock-edit-old'
  | 'stock-edit-new';

export type StockLog = {
  id: string;
  household_id: string;
  product_id: string;
  
  // Transaction details
  amount: number;
  transaction_type: StockTransactionType;
  
  // Dates
  best_before_date: string | null;
  purchased_date: string | null;
  used_date: string | null;
  
  // Opened tracking
  opened_date: string | null;
  
  // Price
  price: number | null;
  
  // Location tracking
  location_id: string | null;
  shopping_location_id: string | null;
  
  // Spoilage tracking
  spoiled: boolean;
  
  // References
  stock_id: string | null;
  stock_entry_id: string | null;
  recipe_id: string | null;
  
  // Undo functionality
  undone: boolean;
  undone_timestamp: string | null;
  
  // Transaction grouping
  correlation_id: string | null;
  transaction_id: string;
  
  // User tracking
  user_id: string | null;
  
  // Note
  note: string | null;
  
  // Timestamp
  created_at: string;
};

// ============================================
// SHOPPING LISTS
// ============================================

export type ShoppingList = {
  id: string;
  household_id: string;
  name: string;
  description: string | null;
  is_auto_target: boolean;
  created_at: string;
};

export type ShoppingListItem = {
  id: string;
  household_id: string;
  shopping_list_id: string;
  product_id: string | null;
  note: string | null;
  amount: number;
  qu_id: string | null;
  done: boolean;
  sort_order: number;
  created_at: string;
};

// ============================================
// HOUSEHOLD AI SETTINGS
// ============================================

export type HouseholdAiSettings = {
  id: string;
  household_id: string;
  ollama_url: string | null;
  text_model: string | null;
  vision_model: string | null;
  created_at: string;
  updated_at: string;
};

// ============================================
// RECIPES
// ============================================

export type Recipe = {
  id: string;
  household_id: string;
  name: string;
  description: string | null;
  instructions: string | null;
  picture_file_name: string | null;
  base_servings: number;
  desired_servings: number;
  not_check_shoppinglist: boolean;
  product_id: string | null;
  created_at: string;
};

export type RecipeIngredient = {
  id: string;
  household_id: string;
  recipe_id: string;
  product_id: string | null;
  amount: number;
  qu_id: string | null;
  note: string | null;
  ingredient_group: string | null;
  variable_amount: string | null;
  only_check_single_unit_in_stock: boolean;
  not_check_stock_fulfillment: boolean;
  price_factor: number;
  sort_order: number;
  created_at: string;
};

export type RecipeNesting = {
  id: string;
  household_id: string;
  recipe_id: string;
  includes_recipe_id: string;
  servings: number;
  created_at: string;
};

// ============================================
// MEAL PLAN
// ============================================

export type MealPlanSection = {
  id: string;
  household_id: string;
  name: string;
  time: string | null; // TIME stored as "HH:MM:SS" string from Postgres
  sort_order: number;
  created_at: string;
};

export type MealPlanEntry = {
  id: string;
  household_id: string;
  day: string; // DATE stored as "YYYY-MM-DD" string
  type: 'recipe' | 'product' | 'note';
  // Recipe entry
  recipe_id: string | null;
  recipe_servings: number | null;
  // Product entry
  product_id: string | null;
  product_amount: number | null;
  product_qu_id: string | null;
  // Note entry
  note: string | null;
  // Section assignment
  section_id: string | null;
  sort_order: number;
  created_at: string;
};

export type MealPlanEntryWithRelations = MealPlanEntry & {
  section?: Pick<MealPlanSection, 'id' | 'name' | 'sort_order'> | null;
  recipe?: Pick<Recipe, 'id' | 'name' | 'base_servings' | 'picture_file_name'> | null;
  product?: Pick<Product, 'id' | 'name'> & {
    qu_stock?: Pick<QuantityUnit, 'id' | 'name' | 'name_plural'> | null;
  } | null;
  product_qu?: Pick<QuantityUnit, 'id' | 'name' | 'name_plural'> | null;
};

// ============================================
// NLP PARSED STOCK ITEM (for AI stock entry)
// ============================================

export type ParsedStockItem = {
  raw: string;
  product_id: string | null;
  product_name: string;
  amount: number;
  qu_id: string | null;
  unit_name: string;
  best_before_date: string | null;
  shopping_location_id: string | null;
  store_name: string;
  price: number | null;
  location_id: string | null;
  location_name: string;
  note: string;
};

// ============================================
// JOINED TYPES (for UI display)
// ============================================

export type ProductWithRelations = Product & {
  location?: Location | null;
  default_consume_location?: Location | null;
  shopping_location?: ShoppingLocation | null;
  product_group?: ProductGroup | null;
  qu_stock?: QuantityUnit | null;
  qu_purchase?: QuantityUnit | null;
  parent_product?: Product | null;
};

export type StockEntryWithProduct = StockEntry & {
  product: ProductWithRelations;
  location?: Location | null;
};

export type ShoppingListItemWithRelations = ShoppingListItem & {
  product?: (Pick<Product, 'id' | 'name' | 'product_group_id' | 'shopping_location_id' | 'qu_id_purchase' | 'qu_id_stock' | 'min_stock_amount' | 'location_id' | 'default_due_days'> & {
    product_group?: Pick<ProductGroup, 'id' | 'name'> | null;
    shopping_location?: Pick<ShoppingLocation, 'id' | 'name'> | null;
    qu_purchase?: Pick<QuantityUnit, 'id' | 'name' | 'name_plural'> | null;
  }) | null;
  qu?: Pick<QuantityUnit, 'id' | 'name' | 'name_plural'> | null;
};

export type StockLogWithRelations = StockLog & {
  product: Pick<Product, 'id' | 'name'> & {
    qu_stock?: Pick<QuantityUnit, 'name' | 'name_plural'> | null;
  };
  location?: Pick<Location, 'id' | 'name'> | null;
};

export type RecipeWithRelations = Recipe & {
  product?: Pick<Product, 'id' | 'name'> | null;
};

export type RecipeIngredientWithRelations = RecipeIngredient & {
  product?: Pick<Product, 'id' | 'name' | 'qu_id_stock' | 'not_check_stock_fulfillment_for_recipes'> | null;
  qu?: Pick<QuantityUnit, 'id' | 'name' | 'name_plural'> | null;
};

export type RecipeNestingWithRelations = RecipeNesting & {
  included_recipe?: Pick<Recipe, 'id' | 'name' | 'base_servings'> | null;
};

// ============================================
// INVENTORY STATS (computed)
// ============================================

export type InventoryStats = {
  total: number;
  fresh: number;
  expiringSoon: number;
  expired: number;
  opened: number;
  belowMinStock: number;
  byLocation: Record<string, number>;
  byProductGroup: Record<string, number>;
  totalValue: number;
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