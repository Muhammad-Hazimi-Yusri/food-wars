-- ============================================
-- GUEST MODE SETUP
-- ============================================
-- Creates shared guest household for anonymous users
-- Updates all RLS policies to allow anonymous access
-- Guest household ID: a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
-- ============================================

-- ============================================
-- 1. CREATE GUEST HOUSEHOLD
-- ============================================

INSERT INTO households (id, name, owner_id, created_at)
VALUES (
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'Guest Household',
  '00000000-0000-0000-0000-000000000000',
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 2. UPDATE RLS POLICIES
-- ============================================

-- HOUSEHOLDS
DROP POLICY IF EXISTS "Users can view own households" ON households;
CREATE POLICY "Users can view own households"
  ON households FOR SELECT
  USING (
    owner_id = auth.uid()
    OR (id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' AND (auth.jwt() ->> 'is_anonymous')::boolean = TRUE)
  );

-- LOCATIONS
DROP POLICY IF EXISTS "Users can view own household locations" ON locations;
CREATE POLICY "Users can view own household locations"
  ON locations FOR SELECT
  USING (
    household_id IN (SELECT id FROM households WHERE owner_id = auth.uid())
    OR (household_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' AND (auth.jwt() ->> 'is_anonymous')::boolean = TRUE)
  );

DROP POLICY IF EXISTS "Users can insert into own household locations" ON locations;
CREATE POLICY "Users can insert into own household locations"
  ON locations FOR INSERT
  WITH CHECK (
    household_id IN (SELECT id FROM households WHERE owner_id = auth.uid())
    OR (household_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' AND (auth.jwt() ->> 'is_anonymous')::boolean = TRUE)
  );

DROP POLICY IF EXISTS "Users can update own household locations" ON locations;
CREATE POLICY "Users can update own household locations"
  ON locations FOR UPDATE
  USING (
    household_id IN (SELECT id FROM households WHERE owner_id = auth.uid())
    OR (household_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' AND (auth.jwt() ->> 'is_anonymous')::boolean = TRUE)
  );

DROP POLICY IF EXISTS "Users can delete own household locations" ON locations;
CREATE POLICY "Users can delete own household locations"
  ON locations FOR DELETE
  USING (
    household_id IN (SELECT id FROM households WHERE owner_id = auth.uid())
    OR (household_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' AND (auth.jwt() ->> 'is_anonymous')::boolean = TRUE)
  );

-- SHOPPING_LOCATIONS
DROP POLICY IF EXISTS "Users can view own household shopping_locations" ON shopping_locations;
CREATE POLICY "Users can view own household shopping_locations"
  ON shopping_locations FOR SELECT
  USING (
    household_id IN (SELECT id FROM households WHERE owner_id = auth.uid())
    OR (household_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' AND (auth.jwt() ->> 'is_anonymous')::boolean = TRUE)
  );

DROP POLICY IF EXISTS "Users can insert into own household shopping_locations" ON shopping_locations;
CREATE POLICY "Users can insert into own household shopping_locations"
  ON shopping_locations FOR INSERT
  WITH CHECK (
    household_id IN (SELECT id FROM households WHERE owner_id = auth.uid())
    OR (household_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' AND (auth.jwt() ->> 'is_anonymous')::boolean = TRUE)
  );

DROP POLICY IF EXISTS "Users can update own household shopping_locations" ON shopping_locations;
CREATE POLICY "Users can update own household shopping_locations"
  ON shopping_locations FOR UPDATE
  USING (
    household_id IN (SELECT id FROM households WHERE owner_id = auth.uid())
    OR (household_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' AND (auth.jwt() ->> 'is_anonymous')::boolean = TRUE)
  );

DROP POLICY IF EXISTS "Users can delete own household shopping_locations" ON shopping_locations;
CREATE POLICY "Users can delete own household shopping_locations"
  ON shopping_locations FOR DELETE
  USING (
    household_id IN (SELECT id FROM households WHERE owner_id = auth.uid())
    OR (household_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' AND (auth.jwt() ->> 'is_anonymous')::boolean = TRUE)
  );

-- PRODUCT_GROUPS
DROP POLICY IF EXISTS "Users can view own household product_groups" ON product_groups;
CREATE POLICY "Users can view own household product_groups"
  ON product_groups FOR SELECT
  USING (
    household_id IN (SELECT id FROM households WHERE owner_id = auth.uid())
    OR (household_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' AND (auth.jwt() ->> 'is_anonymous')::boolean = TRUE)
  );

DROP POLICY IF EXISTS "Users can insert into own household product_groups" ON product_groups;
CREATE POLICY "Users can insert into own household product_groups"
  ON product_groups FOR INSERT
  WITH CHECK (
    household_id IN (SELECT id FROM households WHERE owner_id = auth.uid())
    OR (household_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' AND (auth.jwt() ->> 'is_anonymous')::boolean = TRUE)
  );

DROP POLICY IF EXISTS "Users can update own household product_groups" ON product_groups;
CREATE POLICY "Users can update own household product_groups"
  ON product_groups FOR UPDATE
  USING (
    household_id IN (SELECT id FROM households WHERE owner_id = auth.uid())
    OR (household_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' AND (auth.jwt() ->> 'is_anonymous')::boolean = TRUE)
  );

DROP POLICY IF EXISTS "Users can delete own household product_groups" ON product_groups;
CREATE POLICY "Users can delete own household product_groups"
  ON product_groups FOR DELETE
  USING (
    household_id IN (SELECT id FROM households WHERE owner_id = auth.uid())
    OR (household_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' AND (auth.jwt() ->> 'is_anonymous')::boolean = TRUE)
  );

-- QUANTITY_UNITS
DROP POLICY IF EXISTS "Users can view own household quantity_units" ON quantity_units;
CREATE POLICY "Users can view own household quantity_units"
  ON quantity_units FOR SELECT
  USING (
    household_id IN (SELECT id FROM households WHERE owner_id = auth.uid())
    OR (household_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' AND (auth.jwt() ->> 'is_anonymous')::boolean = TRUE)
  );

DROP POLICY IF EXISTS "Users can insert into own household quantity_units" ON quantity_units;
CREATE POLICY "Users can insert into own household quantity_units"
  ON quantity_units FOR INSERT
  WITH CHECK (
    household_id IN (SELECT id FROM households WHERE owner_id = auth.uid())
    OR (household_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' AND (auth.jwt() ->> 'is_anonymous')::boolean = TRUE)
  );

DROP POLICY IF EXISTS "Users can update own household quantity_units" ON quantity_units;
CREATE POLICY "Users can update own household quantity_units"
  ON quantity_units FOR UPDATE
  USING (
    household_id IN (SELECT id FROM households WHERE owner_id = auth.uid())
    OR (household_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' AND (auth.jwt() ->> 'is_anonymous')::boolean = TRUE)
  );

DROP POLICY IF EXISTS "Users can delete own household quantity_units" ON quantity_units;
CREATE POLICY "Users can delete own household quantity_units"
  ON quantity_units FOR DELETE
  USING (
    household_id IN (SELECT id FROM households WHERE owner_id = auth.uid())
    OR (household_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' AND (auth.jwt() ->> 'is_anonymous')::boolean = TRUE)
  );

-- QUANTITY_UNIT_CONVERSIONS
DROP POLICY IF EXISTS "Users can view own household qu_conversions" ON quantity_unit_conversions;
CREATE POLICY "Users can view own household qu_conversions"
  ON quantity_unit_conversions FOR SELECT
  USING (
    household_id IN (SELECT id FROM households WHERE owner_id = auth.uid())
    OR (household_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' AND (auth.jwt() ->> 'is_anonymous')::boolean = TRUE)
  );

DROP POLICY IF EXISTS "Users can insert into own household qu_conversions" ON quantity_unit_conversions;
CREATE POLICY "Users can insert into own household qu_conversions"
  ON quantity_unit_conversions FOR INSERT
  WITH CHECK (
    household_id IN (SELECT id FROM households WHERE owner_id = auth.uid())
    OR (household_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' AND (auth.jwt() ->> 'is_anonymous')::boolean = TRUE)
  );

DROP POLICY IF EXISTS "Users can update own household qu_conversions" ON quantity_unit_conversions;
CREATE POLICY "Users can update own household qu_conversions"
  ON quantity_unit_conversions FOR UPDATE
  USING (
    household_id IN (SELECT id FROM households WHERE owner_id = auth.uid())
    OR (household_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' AND (auth.jwt() ->> 'is_anonymous')::boolean = TRUE)
  );

DROP POLICY IF EXISTS "Users can delete own household qu_conversions" ON quantity_unit_conversions;
CREATE POLICY "Users can delete own household qu_conversions"
  ON quantity_unit_conversions FOR DELETE
  USING (
    household_id IN (SELECT id FROM households WHERE owner_id = auth.uid())
    OR (household_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' AND (auth.jwt() ->> 'is_anonymous')::boolean = TRUE)
  );

-- PRODUCTS
DROP POLICY IF EXISTS "Users can view own household products" ON products;
CREATE POLICY "Users can view own household products"
  ON products FOR SELECT
  USING (
    household_id IN (SELECT id FROM households WHERE owner_id = auth.uid())
    OR (household_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' AND (auth.jwt() ->> 'is_anonymous')::boolean = TRUE)
  );

DROP POLICY IF EXISTS "Users can insert into own household products" ON products;
CREATE POLICY "Users can insert into own household products"
  ON products FOR INSERT
  WITH CHECK (
    household_id IN (SELECT id FROM households WHERE owner_id = auth.uid())
    OR (household_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' AND (auth.jwt() ->> 'is_anonymous')::boolean = TRUE)
  );

DROP POLICY IF EXISTS "Users can update own household products" ON products;
CREATE POLICY "Users can update own household products"
  ON products FOR UPDATE
  USING (
    household_id IN (SELECT id FROM households WHERE owner_id = auth.uid())
    OR (household_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' AND (auth.jwt() ->> 'is_anonymous')::boolean = TRUE)
  );

DROP POLICY IF EXISTS "Users can delete own household products" ON products;
CREATE POLICY "Users can delete own household products"
  ON products FOR DELETE
  USING (
    household_id IN (SELECT id FROM households WHERE owner_id = auth.uid())
    OR (household_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' AND (auth.jwt() ->> 'is_anonymous')::boolean = TRUE)
  );

-- PRODUCT_BARCODES
DROP POLICY IF EXISTS "Users can view own household product_barcodes" ON product_barcodes;
CREATE POLICY "Users can view own household product_barcodes"
  ON product_barcodes FOR SELECT
  USING (
    household_id IN (SELECT id FROM households WHERE owner_id = auth.uid())
    OR (household_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' AND (auth.jwt() ->> 'is_anonymous')::boolean = TRUE)
  );

DROP POLICY IF EXISTS "Users can insert into own household product_barcodes" ON product_barcodes;
CREATE POLICY "Users can insert into own household product_barcodes"
  ON product_barcodes FOR INSERT
  WITH CHECK (
    household_id IN (SELECT id FROM households WHERE owner_id = auth.uid())
    OR (household_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' AND (auth.jwt() ->> 'is_anonymous')::boolean = TRUE)
  );

DROP POLICY IF EXISTS "Users can update own household product_barcodes" ON product_barcodes;
CREATE POLICY "Users can update own household product_barcodes"
  ON product_barcodes FOR UPDATE
  USING (
    household_id IN (SELECT id FROM households WHERE owner_id = auth.uid())
    OR (household_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' AND (auth.jwt() ->> 'is_anonymous')::boolean = TRUE)
  );

DROP POLICY IF EXISTS "Users can delete own household product_barcodes" ON product_barcodes;
CREATE POLICY "Users can delete own household product_barcodes"
  ON product_barcodes FOR DELETE
  USING (
    household_id IN (SELECT id FROM households WHERE owner_id = auth.uid())
    OR (household_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' AND (auth.jwt() ->> 'is_anonymous')::boolean = TRUE)
  );

-- STOCK_ENTRIES
DROP POLICY IF EXISTS "Users can view own household stock_entries" ON stock_entries;
CREATE POLICY "Users can view own household stock_entries"
  ON stock_entries FOR SELECT
  USING (
    household_id IN (SELECT id FROM households WHERE owner_id = auth.uid())
    OR (household_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' AND (auth.jwt() ->> 'is_anonymous')::boolean = TRUE)
  );

DROP POLICY IF EXISTS "Users can insert into own household stock_entries" ON stock_entries;
CREATE POLICY "Users can insert into own household stock_entries"
  ON stock_entries FOR INSERT
  WITH CHECK (
    household_id IN (SELECT id FROM households WHERE owner_id = auth.uid())
    OR (household_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' AND (auth.jwt() ->> 'is_anonymous')::boolean = TRUE)
  );

DROP POLICY IF EXISTS "Users can update own household stock_entries" ON stock_entries;
CREATE POLICY "Users can update own household stock_entries"
  ON stock_entries FOR UPDATE
  USING (
    household_id IN (SELECT id FROM households WHERE owner_id = auth.uid())
    OR (household_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' AND (auth.jwt() ->> 'is_anonymous')::boolean = TRUE)
  );

DROP POLICY IF EXISTS "Users can delete own household stock_entries" ON stock_entries;
CREATE POLICY "Users can delete own household stock_entries"
  ON stock_entries FOR DELETE
  USING (
    household_id IN (SELECT id FROM households WHERE owner_id = auth.uid())
    OR (household_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' AND (auth.jwt() ->> 'is_anonymous')::boolean = TRUE)
  );

-- STOCK_LOG
DROP POLICY IF EXISTS "Users can view own household stock_log" ON stock_log;
CREATE POLICY "Users can view own household stock_log"
  ON stock_log FOR SELECT
  USING (
    household_id IN (SELECT id FROM households WHERE owner_id = auth.uid())
    OR (household_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' AND (auth.jwt() ->> 'is_anonymous')::boolean = TRUE)
  );

DROP POLICY IF EXISTS "Users can insert into own household stock_log" ON stock_log;
CREATE POLICY "Users can insert into own household stock_log"
  ON stock_log FOR INSERT
  WITH CHECK (
    household_id IN (SELECT id FROM households WHERE owner_id = auth.uid())
    OR (household_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' AND (auth.jwt() ->> 'is_anonymous')::boolean = TRUE)
  );

DROP POLICY IF EXISTS "Users can update own household stock_log" ON stock_log;
CREATE POLICY "Users can update own household stock_log"
  ON stock_log FOR UPDATE
  USING (
    household_id IN (SELECT id FROM households WHERE owner_id = auth.uid())
    OR (household_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' AND (auth.jwt() ->> 'is_anonymous')::boolean = TRUE)
  );