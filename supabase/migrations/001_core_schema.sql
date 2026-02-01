-- ============================================
-- FOOD WARS SCHEMA v0.4.1
-- Complete schema adapted from Grocy (https://grocy.info)
-- All fields included for future compatibility
-- ============================================

-- ============================================
-- HOUSEHOLDS (Food Wars custom for multi-tenant)
-- ============================================

CREATE TABLE households (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'My Household',
  owner_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE households ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own households"
  ON households FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "Users can insert own households"
  ON households FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update own households"
  ON households FOR UPDATE
  USING (owner_id = auth.uid());

-- ============================================
-- LOCATIONS (storage: Fridge, Freezer, Pantry)
-- ============================================

CREATE TABLE locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_freezer BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own household locations"
  ON locations FOR SELECT
  USING (household_id IN (SELECT id FROM households WHERE owner_id = auth.uid()));

CREATE POLICY "Users can insert into own household locations"
  ON locations FOR INSERT
  WITH CHECK (household_id IN (SELECT id FROM households WHERE owner_id = auth.uid()));

CREATE POLICY "Users can update own household locations"
  ON locations FOR UPDATE
  USING (household_id IN (SELECT id FROM households WHERE owner_id = auth.uid()));

CREATE POLICY "Users can delete own household locations"
  ON locations FOR DELETE
  USING (household_id IN (SELECT id FROM households WHERE owner_id = auth.uid()));

CREATE INDEX idx_locations_household ON locations(household_id);
CREATE INDEX idx_locations_active ON locations(household_id, active);

-- ============================================
-- SHOPPING LOCATIONS (stores: Tesco, Costco)
-- ============================================

CREATE TABLE shopping_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE shopping_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own household shopping_locations"
  ON shopping_locations FOR SELECT
  USING (household_id IN (SELECT id FROM households WHERE owner_id = auth.uid()));

CREATE POLICY "Users can insert into own household shopping_locations"
  ON shopping_locations FOR INSERT
  WITH CHECK (household_id IN (SELECT id FROM households WHERE owner_id = auth.uid()));

CREATE POLICY "Users can update own household shopping_locations"
  ON shopping_locations FOR UPDATE
  USING (household_id IN (SELECT id FROM households WHERE owner_id = auth.uid()));

CREATE POLICY "Users can delete own household shopping_locations"
  ON shopping_locations FOR DELETE
  USING (household_id IN (SELECT id FROM households WHERE owner_id = auth.uid()));

CREATE INDEX idx_shopping_locations_household ON shopping_locations(household_id);
CREATE INDEX idx_shopping_locations_active ON shopping_locations(household_id, active);

-- ============================================
-- PRODUCT GROUPS (categories: Dairy, Produce)
-- ============================================

CREATE TABLE product_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE product_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own household product_groups"
  ON product_groups FOR SELECT
  USING (household_id IN (SELECT id FROM households WHERE owner_id = auth.uid()));

CREATE POLICY "Users can insert into own household product_groups"
  ON product_groups FOR INSERT
  WITH CHECK (household_id IN (SELECT id FROM households WHERE owner_id = auth.uid()));

CREATE POLICY "Users can update own household product_groups"
  ON product_groups FOR UPDATE
  USING (household_id IN (SELECT id FROM households WHERE owner_id = auth.uid()));

CREATE POLICY "Users can delete own household product_groups"
  ON product_groups FOR DELETE
  USING (household_id IN (SELECT id FROM households WHERE owner_id = auth.uid()));

CREATE INDEX idx_product_groups_household ON product_groups(household_id);
CREATE INDEX idx_product_groups_active ON product_groups(household_id, active);

-- ============================================
-- QUANTITY UNITS (pc, kg, g, L, mL, pack)
-- ============================================

CREATE TABLE quantity_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_plural TEXT,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE quantity_units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own household quantity_units"
  ON quantity_units FOR SELECT
  USING (household_id IN (SELECT id FROM households WHERE owner_id = auth.uid()));

CREATE POLICY "Users can insert into own household quantity_units"
  ON quantity_units FOR INSERT
  WITH CHECK (household_id IN (SELECT id FROM households WHERE owner_id = auth.uid()));

CREATE POLICY "Users can update own household quantity_units"
  ON quantity_units FOR UPDATE
  USING (household_id IN (SELECT id FROM households WHERE owner_id = auth.uid()));

CREATE POLICY "Users can delete own household quantity_units"
  ON quantity_units FOR DELETE
  USING (household_id IN (SELECT id FROM households WHERE owner_id = auth.uid()));

CREATE INDEX idx_quantity_units_household ON quantity_units(household_id);
CREATE INDEX idx_quantity_units_active ON quantity_units(household_id, active);

-- ============================================
-- PRODUCTS TABLE (complete Grocy fields)
-- ============================================

CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  
  -- Basic info
  name TEXT NOT NULL,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  picture_file_name TEXT,
  
  -- Locations
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  default_consume_location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  shopping_location_id UUID REFERENCES shopping_locations(id) ON DELETE SET NULL,
  move_on_open BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Categorization
  product_group_id UUID REFERENCES product_groups(id) ON DELETE SET NULL,
  
  -- Quantity units
  qu_id_stock UUID REFERENCES quantity_units(id) ON DELETE SET NULL,
  qu_id_purchase UUID REFERENCES quantity_units(id) ON DELETE SET NULL,
  -- qu_factor_purchase_to_stock DECIMAL NOT NULL DEFAULT 1.0, -- Deprecated, see migration 007_drop_qu_factor.sql
  
  -- Stock management
  min_stock_amount DECIMAL NOT NULL DEFAULT 0,
  quick_consume_amount DECIMAL NOT NULL DEFAULT 1,
  quick_open_amount DECIMAL NOT NULL DEFAULT 1,
  treat_opened_as_out_of_stock BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Due dates / Expiry
  due_type INTEGER NOT NULL DEFAULT 1 CHECK (due_type IN (1, 2)), -- 1=best_before, 2=expiration
  default_due_days INTEGER NOT NULL DEFAULT 0, -- -1 = never expires
  default_due_days_after_open INTEGER NOT NULL DEFAULT 0,
  default_due_days_after_freezing INTEGER NOT NULL DEFAULT 0,
  default_due_days_after_thawing INTEGER NOT NULL DEFAULT 0,
  
  -- Freezing
  should_not_be_frozen BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Nutrition
  calories INTEGER,
  
  -- Tare weight handling (for containers)
  enable_tare_weight_handling BOOLEAN NOT NULL DEFAULT FALSE,
  tare_weight DECIMAL NOT NULL DEFAULT 0,
  
  -- Product hierarchy (parent/child products)
  parent_product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  no_own_stock BOOLEAN NOT NULL DEFAULT FALSE,
  cumulate_min_stock_amount_of_sub_products BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Recipe integration
  not_check_stock_fulfillment_for_recipes BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Label printing
  default_stock_label_type INTEGER NOT NULL DEFAULT 0, -- 0=per purchase, 1=per stock entry, 2=none
  auto_reprint_stock_label BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Display
  hide_on_stock_overview BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own household products"
  ON products FOR SELECT
  USING (household_id IN (SELECT id FROM households WHERE owner_id = auth.uid()));

CREATE POLICY "Users can insert into own household products"
  ON products FOR INSERT
  WITH CHECK (household_id IN (SELECT id FROM households WHERE owner_id = auth.uid()));

CREATE POLICY "Users can update own household products"
  ON products FOR UPDATE
  USING (household_id IN (SELECT id FROM households WHERE owner_id = auth.uid()));

CREATE POLICY "Users can delete own household products"
  ON products FOR DELETE
  USING (household_id IN (SELECT id FROM households WHERE owner_id = auth.uid()));

CREATE INDEX idx_products_household ON products(household_id);
CREATE INDEX idx_products_location ON products(location_id);
CREATE INDEX idx_products_product_group ON products(product_group_id);
CREATE INDEX idx_products_active ON products(household_id, active);
CREATE INDEX idx_products_parent ON products(parent_product_id);

-- ============================================
-- QUANTITY UNIT CONVERSIONS
-- ============================================

CREATE TABLE quantity_unit_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  from_qu_id UUID NOT NULL REFERENCES quantity_units(id) ON DELETE CASCADE,
  to_qu_id UUID NOT NULL REFERENCES quantity_units(id) ON DELETE CASCADE,
  factor DECIMAL NOT NULL,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE, -- NULL = global, set = product-specific
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE quantity_unit_conversions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own household qu_conversions"
  ON quantity_unit_conversions FOR SELECT
  USING (household_id IN (SELECT id FROM households WHERE owner_id = auth.uid()));

CREATE POLICY "Users can insert into own household qu_conversions"
  ON quantity_unit_conversions FOR INSERT
  WITH CHECK (household_id IN (SELECT id FROM households WHERE owner_id = auth.uid()));

CREATE POLICY "Users can update own household qu_conversions"
  ON quantity_unit_conversions FOR UPDATE
  USING (household_id IN (SELECT id FROM households WHERE owner_id = auth.uid()));

CREATE POLICY "Users can delete own household qu_conversions"
  ON quantity_unit_conversions FOR DELETE
  USING (household_id IN (SELECT id FROM households WHERE owner_id = auth.uid()));

CREATE INDEX idx_qu_conversions_household ON quantity_unit_conversions(household_id);

-- ============================================
-- PRODUCT BARCODES (separate table for multiple barcodes per product)
-- ============================================

CREATE TABLE product_barcodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  barcode TEXT NOT NULL,
  qu_id UUID REFERENCES quantity_units(id) ON DELETE SET NULL,
  amount DECIMAL,
  shopping_location_id UUID REFERENCES shopping_locations(id) ON DELETE SET NULL,
  last_price DECIMAL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE product_barcodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own household product_barcodes"
  ON product_barcodes FOR SELECT
  USING (household_id IN (SELECT id FROM households WHERE owner_id = auth.uid()));

CREATE POLICY "Users can insert into own household product_barcodes"
  ON product_barcodes FOR INSERT
  WITH CHECK (household_id IN (SELECT id FROM households WHERE owner_id = auth.uid()));

CREATE POLICY "Users can update own household product_barcodes"
  ON product_barcodes FOR UPDATE
  USING (household_id IN (SELECT id FROM households WHERE owner_id = auth.uid()));

CREATE POLICY "Users can delete own household product_barcodes"
  ON product_barcodes FOR DELETE
  USING (household_id IN (SELECT id FROM households WHERE owner_id = auth.uid()));

CREATE INDEX idx_product_barcodes_household ON product_barcodes(household_id);
CREATE INDEX idx_product_barcodes_product ON product_barcodes(product_id);
CREATE INDEX idx_product_barcodes_barcode ON product_barcodes(barcode);

-- ============================================
-- STOCK ENTRIES (individual batches in stock)
-- ============================================

CREATE TABLE stock_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  
  -- Quantity
  amount DECIMAL NOT NULL DEFAULT 0,
  
  -- Dates
  best_before_date DATE,
  purchased_date DATE DEFAULT CURRENT_DATE,
  
  -- Price
  price DECIMAL,
  
  -- Location tracking
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  shopping_location_id UUID REFERENCES shopping_locations(id) ON DELETE SET NULL,
  
  -- Opened tracking
  open BOOLEAN NOT NULL DEFAULT FALSE,
  opened_date DATE,
  
  -- Unique identifier for Grocycode
  stock_id UUID NOT NULL DEFAULT gen_random_uuid(),
  
  -- Additional
  note TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE stock_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own household stock_entries"
  ON stock_entries FOR SELECT
  USING (household_id IN (SELECT id FROM households WHERE owner_id = auth.uid()));

CREATE POLICY "Users can insert into own household stock_entries"
  ON stock_entries FOR INSERT
  WITH CHECK (household_id IN (SELECT id FROM households WHERE owner_id = auth.uid()));

CREATE POLICY "Users can update own household stock_entries"
  ON stock_entries FOR UPDATE
  USING (household_id IN (SELECT id FROM households WHERE owner_id = auth.uid()));

CREATE POLICY "Users can delete own household stock_entries"
  ON stock_entries FOR DELETE
  USING (household_id IN (SELECT id FROM households WHERE owner_id = auth.uid()));

CREATE INDEX idx_stock_entries_household ON stock_entries(household_id);
CREATE INDEX idx_stock_entries_product ON stock_entries(product_id);
CREATE INDEX idx_stock_entries_location ON stock_entries(location_id);
CREATE INDEX idx_stock_entries_best_before ON stock_entries(best_before_date);
CREATE INDEX idx_stock_entries_stock_id ON stock_entries(stock_id);

-- ============================================
-- STOCK LOG (transaction history for undo & journal)
-- ============================================

CREATE TYPE stock_transaction_type AS ENUM (
  'purchase',
  'consume',
  'spoiled',
  'inventory-correction',
  'product-opened',
  'transfer-from',
  'transfer-to',
  'stock-edit-old',
  'stock-edit-new'
);

CREATE TABLE stock_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  
  -- Transaction details
  amount DECIMAL NOT NULL,
  transaction_type stock_transaction_type NOT NULL,
  
  -- Dates
  best_before_date DATE,
  purchased_date DATE,
  used_date DATE,
  
  -- Opened tracking
  opened_date DATE,
  
  -- Price
  price DECIMAL,
  
  -- Location tracking
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  shopping_location_id UUID REFERENCES shopping_locations(id) ON DELETE SET NULL,
  
  -- Spoilage tracking
  spoiled BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- References
  stock_id UUID, -- References stock_entries.stock_id
  stock_entry_id UUID REFERENCES stock_entries(id) ON DELETE SET NULL,
  recipe_id UUID, -- Future: references recipes.id
  
  -- Undo functionality
  undone BOOLEAN NOT NULL DEFAULT FALSE,
  undone_timestamp TIMESTAMPTZ,
  
  -- Transaction grouping
  correlation_id UUID, -- Groups related transactions
  transaction_id UUID NOT NULL DEFAULT gen_random_uuid(), -- Unique per transaction
  
  -- User tracking
  user_id UUID, -- Future: for multi-user households
  
  -- Note
  note TEXT,
  
  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE stock_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own household stock_log"
  ON stock_log FOR SELECT
  USING (household_id IN (SELECT id FROM households WHERE owner_id = auth.uid()));

CREATE POLICY "Users can insert into own household stock_log"
  ON stock_log FOR INSERT
  WITH CHECK (household_id IN (SELECT id FROM households WHERE owner_id = auth.uid()));

CREATE POLICY "Users can update own household stock_log"
  ON stock_log FOR UPDATE
  USING (household_id IN (SELECT id FROM households WHERE owner_id = auth.uid()));

CREATE INDEX idx_stock_log_household ON stock_log(household_id);
CREATE INDEX idx_stock_log_product ON stock_log(product_id);
CREATE INDEX idx_stock_log_stock_id ON stock_log(stock_id);
CREATE INDEX idx_stock_log_transaction_type ON stock_log(transaction_type);
CREATE INDEX idx_stock_log_undone ON stock_log(undone);
CREATE INDEX idx_stock_log_correlation ON stock_log(correlation_id);
CREATE INDEX idx_stock_log_created ON stock_log(created_at);

-- ============================================
-- AUTO-CREATE HOUSEHOLD + SEED DATA ON SIGNUP
-- ============================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  new_household_id UUID;
BEGIN
  -- Create household
  INSERT INTO households (owner_id, name)
  VALUES (NEW.id, 'My Household')
  RETURNING id INTO new_household_id;
  
  -- Seed default locations
  INSERT INTO locations (household_id, name, is_freezer, sort_order) VALUES
    (new_household_id, 'Fridge', FALSE, 1),
    (new_household_id, 'Freezer', TRUE, 2),
    (new_household_id, 'Pantry', FALSE, 3),
    (new_household_id, 'Cupboard', FALSE, 4);
  
  -- Seed default product groups
  INSERT INTO product_groups (household_id, name, sort_order) VALUES
    (new_household_id, 'Dairy', 1),
    (new_household_id, 'Produce', 2),
    (new_household_id, 'Meat & Seafood', 3),
    (new_household_id, 'Bakery', 4),
    (new_household_id, 'Frozen', 5),
    (new_household_id, 'Pantry Staples', 6),
    (new_household_id, 'Snacks', 7),
    (new_household_id, 'Beverages', 8),
    (new_household_id, 'Condiments', 9),
    (new_household_id, 'Spices', 10);
  
  -- Seed default quantity units
  INSERT INTO quantity_units (household_id, name, name_plural, sort_order) VALUES
    (new_household_id, 'piece', 'pieces', 1),
    (new_household_id, 'pack', 'packs', 2),
    (new_household_id, 'bottle', 'bottles', 3),
    (new_household_id, 'can', 'cans', 4),
    (new_household_id, 'bag', 'bags', 5),
    (new_household_id, 'box', 'boxes', 6),
    (new_household_id, 'kg', 'kg', 7),
    (new_household_id, 'g', 'g', 8),
    (new_household_id, 'L', 'L', 9),
    (new_household_id, 'mL', 'mL', 10);
  
  RETURN NEW;
END;
$$;

-- Trigger on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();