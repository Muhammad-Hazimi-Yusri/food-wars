-- ============================================
-- v0.12.0: Meal Plan Sections + Meal Plan Entries
-- Calendar-based meal planning with section support
-- ============================================

-- ============================================
-- MEAL PLAN SECTIONS (Breakfast, Lunch, Dinner)
-- ============================================

CREATE TABLE meal_plan_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,

  -- Display
  name TEXT NOT NULL,
  time TIME, -- Optional time for calendar export (e.g. 08:00, 12:30, 18:00)

  -- Ordering
  sort_order INTEGER NOT NULL DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_meal_plan_sections_household ON meal_plan_sections(household_id);

ALTER TABLE meal_plan_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own household meal_plan_sections"
  ON meal_plan_sections FOR SELECT USING (
    household_id IN (SELECT id FROM households WHERE owner_id = auth.uid())
    OR (household_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
        AND (auth.jwt() ->> 'is_anonymous')::boolean = TRUE)
  );

CREATE POLICY "Users can insert own household meal_plan_sections"
  ON meal_plan_sections FOR INSERT WITH CHECK (
    household_id IN (SELECT id FROM households WHERE owner_id = auth.uid())
    OR (household_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
        AND (auth.jwt() ->> 'is_anonymous')::boolean = TRUE)
  );

CREATE POLICY "Users can update own household meal_plan_sections"
  ON meal_plan_sections FOR UPDATE USING (
    household_id IN (SELECT id FROM households WHERE owner_id = auth.uid())
    OR (household_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
        AND (auth.jwt() ->> 'is_anonymous')::boolean = TRUE)
  );

CREATE POLICY "Users can delete own household meal_plan_sections"
  ON meal_plan_sections FOR DELETE USING (
    household_id IN (SELECT id FROM households WHERE owner_id = auth.uid())
    OR (household_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
        AND (auth.jwt() ->> 'is_anonymous')::boolean = TRUE)
  );

-- ============================================
-- MEAL PLAN ENTRIES
-- ============================================

CREATE TABLE meal_plan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,

  -- When
  day DATE NOT NULL,

  -- What kind of entry
  type TEXT NOT NULL CHECK (type IN ('recipe', 'product', 'note')),

  -- Recipe entry
  recipe_id UUID REFERENCES recipes(id) ON DELETE CASCADE,
  recipe_servings DECIMAL,

  -- Product entry
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  product_amount DECIMAL,
  product_qu_id UUID REFERENCES quantity_units(id) ON DELETE SET NULL,

  -- Note entry
  note TEXT,

  -- Section (Breakfast / Lunch / Dinner)
  section_id UUID REFERENCES meal_plan_sections(id) ON DELETE SET NULL,

  -- Ordering within a day+section slot (for drag-and-drop reorder)
  sort_order INTEGER NOT NULL DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_meal_plan_household ON meal_plan(household_id);
CREATE INDEX idx_meal_plan_day ON meal_plan(household_id, day);
CREATE INDEX idx_meal_plan_section ON meal_plan(section_id);

ALTER TABLE meal_plan ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own household meal_plan"
  ON meal_plan FOR SELECT USING (
    household_id IN (SELECT id FROM households WHERE owner_id = auth.uid())
    OR (household_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
        AND (auth.jwt() ->> 'is_anonymous')::boolean = TRUE)
  );

CREATE POLICY "Users can insert own household meal_plan"
  ON meal_plan FOR INSERT WITH CHECK (
    household_id IN (SELECT id FROM households WHERE owner_id = auth.uid())
    OR (household_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
        AND (auth.jwt() ->> 'is_anonymous')::boolean = TRUE)
  );

CREATE POLICY "Users can update own household meal_plan"
  ON meal_plan FOR UPDATE USING (
    household_id IN (SELECT id FROM households WHERE owner_id = auth.uid())
    OR (household_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
        AND (auth.jwt() ->> 'is_anonymous')::boolean = TRUE)
  );

CREATE POLICY "Users can delete own household meal_plan"
  ON meal_plan FOR DELETE USING (
    household_id IN (SELECT id FROM households WHERE owner_id = auth.uid())
    OR (household_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
        AND (auth.jwt() ->> 'is_anonymous')::boolean = TRUE)
  );

-- ============================================
-- UPDATE handle_new_user() TRIGGER
-- Seed default meal plan sections on signup
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
  -- Skip anonymous users - they use the shared guest household
  IF NEW.is_anonymous = TRUE THEN
    RETURN NEW;
  END IF;

  -- Create household for regular users
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

  -- Seed default meal plan sections
  INSERT INTO meal_plan_sections (household_id, name, time, sort_order) VALUES
    (new_household_id, 'Breakfast', '08:00', 0),
    (new_household_id, 'Lunch',     '12:00', 1),
    (new_household_id, 'Dinner',    '18:00', 2);

  RETURN NEW;
END;
$$;

-- ============================================
-- UPDATE seed_guest_data() FUNCTION
-- Include meal plan sections in guest reset
-- ============================================

CREATE OR REPLACE FUNCTION seed_guest_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  guest_hh_id UUID := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
BEGIN
  -- Clear existing data (order matters for foreign keys)
  DELETE FROM meal_plan WHERE household_id = guest_hh_id;
  DELETE FROM meal_plan_sections WHERE household_id = guest_hh_id;
  DELETE FROM stock_entries WHERE household_id = guest_hh_id;
  DELETE FROM product_barcodes WHERE household_id = guest_hh_id;
  DELETE FROM quantity_unit_conversions WHERE household_id = guest_hh_id;
  DELETE FROM products WHERE household_id = guest_hh_id;
  DELETE FROM quantity_units WHERE household_id = guest_hh_id;
  DELETE FROM product_groups WHERE household_id = guest_hh_id;
  DELETE FROM shopping_locations WHERE household_id = guest_hh_id;
  DELETE FROM locations WHERE household_id = guest_hh_id;

  -- LOCATIONS
  INSERT INTO locations (id, household_id, name, is_freezer, sort_order) VALUES
    ('10000000-0000-0000-0000-000000000001', guest_hh_id, 'Fridge', FALSE, 1),
    ('10000000-0000-0000-0000-000000000002', guest_hh_id, 'Freezer', TRUE, 2),
    ('10000000-0000-0000-0000-000000000003', guest_hh_id, 'Pantry', FALSE, 3),
    ('10000000-0000-0000-0000-000000000004', guest_hh_id, 'Cupboard', FALSE, 4),
    ('10000000-0000-0000-0000-000000000005', guest_hh_id, 'Spice Rack', FALSE, 5);

  -- SHOPPING LOCATIONS
  INSERT INTO shopping_locations (id, household_id, name, sort_order) VALUES
    ('20000000-0000-0000-0000-000000000001', guest_hh_id, 'Tesco', 1),
    ('20000000-0000-0000-0000-000000000002', guest_hh_id, 'Sainsburys', 2),
    ('20000000-0000-0000-0000-000000000003', guest_hh_id, 'Aldi', 3),
    ('20000000-0000-0000-0000-000000000004', guest_hh_id, 'Local Market', 4);

  -- PRODUCT GROUPS (numbered like Grocy)
  INSERT INTO product_groups (id, household_id, name, sort_order) VALUES
    ('30000000-0000-0000-0000-000000000001', guest_hh_id, '01 Dairy', 1),
    ('30000000-0000-0000-0000-000000000002', guest_hh_id, '02 Produce', 2),
    ('30000000-0000-0000-0000-000000000003', guest_hh_id, '03 Meat & Seafood', 3),
    ('30000000-0000-0000-0000-000000000004', guest_hh_id, '04 Bakery', 4),
    ('30000000-0000-0000-0000-000000000005', guest_hh_id, '05 Frozen', 5),
    ('30000000-0000-0000-0000-000000000006', guest_hh_id, '06 Pantry Staples', 6),
    ('30000000-0000-0000-0000-000000000007', guest_hh_id, '07 Snacks', 7),
    ('30000000-0000-0000-0000-000000000008', guest_hh_id, '08 Beverages', 8),
    ('30000000-0000-0000-0000-000000000009', guest_hh_id, '09 Condiments', 9),
    ('30000000-0000-0000-0000-000000000010', guest_hh_id, '10 Spices', 10);

  -- QUANTITY UNITS
  INSERT INTO quantity_units (id, household_id, name, name_plural, sort_order) VALUES
    ('40000000-0000-0000-0000-000000000001', guest_hh_id, 'piece', 'pieces', 1),
    ('40000000-0000-0000-0000-000000000002', guest_hh_id, 'pack', 'packs', 2),
    ('40000000-0000-0000-0000-000000000003', guest_hh_id, 'bottle', 'bottles', 3),
    ('40000000-0000-0000-0000-000000000004', guest_hh_id, 'can', 'cans', 4),
    ('40000000-0000-0000-0000-000000000005', guest_hh_id, 'bag', 'bags', 5),
    ('40000000-0000-0000-0000-000000000006', guest_hh_id, 'box', 'boxes', 6),
    ('40000000-0000-0000-0000-000000000007', guest_hh_id, 'kg', 'kg', 7),
    ('40000000-0000-0000-0000-000000000008', guest_hh_id, 'g', 'g', 8),
    ('40000000-0000-0000-0000-000000000009', guest_hh_id, 'L', 'L', 9),
    ('40000000-0000-0000-0000-000000000010', guest_hh_id, 'mL', 'mL', 10),
    ('40000000-0000-0000-0000-000000000011', guest_hh_id, 'dozen', 'dozens', 11),
    ('40000000-0000-0000-0000-000000000012', guest_hh_id, 'loaf', 'loaves', 12);

  -- PRODUCTS
  INSERT INTO products (id, household_id, name, description, location_id, product_group_id, qu_id_stock, qu_id_purchase, min_stock_amount, default_due_days, default_due_days_after_open, default_due_days_after_freezing, due_type) VALUES
    ('50000000-0000-0000-0000-000000000001', guest_hh_id, 'Whole Milk', '2L semi-skimmed', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000003', 1, 7, 3, 0, 2),
    ('50000000-0000-0000-0000-000000000002', guest_hh_id, 'Cheddar Cheese', 'Block, mature', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', 1, 21, 7, 90, 1),
    ('50000000-0000-0000-0000-000000000003', guest_hh_id, 'Greek Yogurt', '500g tub', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 2, 14, 5, 0, 2),
    ('50000000-0000-0000-0000-000000000004', guest_hh_id, 'Butter', 'Salted, 250g block', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', 1, 30, 14, 180, 1),
    ('50000000-0000-0000-0000-000000000005', guest_hh_id, 'Eggs', 'Free range, large', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000011', '40000000-0000-0000-0000-000000000011', 1, 21, 0, 0, 1),
    ('50000000-0000-0000-0000-000000000006', guest_hh_id, 'Carrots', '1kg bag', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000005', '40000000-0000-0000-0000-000000000005', 0, 14, 0, 365, 1),
    ('50000000-0000-0000-0000-000000000007', guest_hh_id, 'Spinach', 'Baby spinach, 200g', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000005', '40000000-0000-0000-0000-000000000005', 0, 5, 2, 0, 1),
    ('50000000-0000-0000-0000-000000000008', guest_hh_id, 'Bananas', 'Bunch of 5-6', '10000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 0, 5, 0, 0, 1),
    ('50000000-0000-0000-0000-000000000009', guest_hh_id, 'Tomatoes', 'Vine ripened, 6 pack', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', 0, 7, 0, 0, 1),
    ('50000000-0000-0000-0000-000000000010', guest_hh_id, 'Chicken Breast', 'Skinless, 500g', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', 0, 3, 1, 180, 2),
    ('50000000-0000-0000-0000-000000000011', guest_hh_id, 'Minced Beef', '500g, 10% fat', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', 0, 2, 1, 120, 2),
    ('50000000-0000-0000-0000-000000000012', guest_hh_id, 'Salmon Fillets', 'Fresh Atlantic, 2 pack', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', 0, 2, 0, 90, 2),
    ('50000000-0000-0000-0000-000000000013', guest_hh_id, 'Sliced Bread', 'Wholemeal, 800g', '10000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000004', '40000000-0000-0000-0000-000000000012', '40000000-0000-0000-0000-000000000012', 1, 5, 3, 90, 1),
    ('50000000-0000-0000-0000-000000000014', guest_hh_id, 'Croissants', 'Pack of 4', '10000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000004', '40000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', 0, 3, 1, 30, 1),
    ('50000000-0000-0000-0000-000000000015', guest_hh_id, 'Frozen Peas', '1kg bag', '10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000005', '40000000-0000-0000-0000-000000000005', '40000000-0000-0000-0000-000000000005', 1, 365, 3, 0, 1),
    ('50000000-0000-0000-0000-000000000016', guest_hh_id, 'Ice Cream', 'Vanilla, 1L tub', '10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000005', '40000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 0, 180, 14, 0, 1),
    ('50000000-0000-0000-0000-000000000017', guest_hh_id, 'Fish Fingers', 'Box of 10', '10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000005', '40000000-0000-0000-0000-000000000006', '40000000-0000-0000-0000-000000000006', 1, 180, 0, 0, 1),
    ('50000000-0000-0000-0000-000000000018', guest_hh_id, 'Pasta', 'Penne, 500g', '10000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000006', '40000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', 2, 730, 0, 0, 1),
    ('50000000-0000-0000-0000-000000000019', guest_hh_id, 'Rice', 'Basmati, 1kg', '10000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000006', '40000000-0000-0000-0000-000000000005', '40000000-0000-0000-0000-000000000005', 1, 730, 0, 0, 1),
    ('50000000-0000-0000-0000-000000000020', guest_hh_id, 'Tinned Tomatoes', 'Chopped, 400g', '10000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000006', '40000000-0000-0000-0000-000000000004', '40000000-0000-0000-0000-000000000004', 3, 730, 3, 0, 1),
    ('50000000-0000-0000-0000-000000000021', guest_hh_id, 'Olive Oil', 'Extra virgin, 500mL', '10000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000006', '40000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000003', 1, 365, 90, 0, 1),
    ('50000000-0000-0000-0000-000000000022', guest_hh_id, 'Orange Juice', 'Fresh, 1L', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000008', '40000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000003', 1, 10, 4, 0, 2),
    ('50000000-0000-0000-0000-000000000023', guest_hh_id, 'Coffee', 'Ground, 250g', '10000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000008', '40000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', 1, 180, 30, 0, 1),
    ('50000000-0000-0000-0000-000000000024', guest_hh_id, 'Ketchup', '500mL squeeze bottle', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000009', '40000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000003', 1, 365, 90, 0, 1),
    ('50000000-0000-0000-0000-000000000025', guest_hh_id, 'Soy Sauce', '250mL bottle', '10000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000009', '40000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000003', 1, 730, 180, 0, 1);

  -- STOCK ENTRIES
  INSERT INTO stock_entries (id, household_id, product_id, amount, best_before_date, purchased_date, price, location_id, shopping_location_id, open, opened_date, note) VALUES
    ('60000000-0000-0000-0000-000000000001', guest_hh_id, '50000000-0000-0000-0000-000000000001', 1, CURRENT_DATE - INTERVAL '3 days', CURRENT_DATE - INTERVAL '10 days', 1.50, '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', FALSE, NULL, 'Forgot about this one'),
    ('60000000-0000-0000-0000-000000000002', guest_hh_id, '50000000-0000-0000-0000-000000000007', 1, CURRENT_DATE - INTERVAL '1 day', CURRENT_DATE - INTERVAL '6 days', 2.00, '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', TRUE, CURRENT_DATE - INTERVAL '4 days', 'Opened but went bad'),
    ('60000000-0000-0000-0000-000000000003', guest_hh_id, '50000000-0000-0000-0000-000000000010', 1, CURRENT_DATE - INTERVAL '2 days', CURRENT_DATE - INTERVAL '5 days', 5.50, '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', FALSE, NULL, NULL),
    ('60000000-0000-0000-0000-000000000004', guest_hh_id, '50000000-0000-0000-0000-000000000003', 1, CURRENT_DATE + INTERVAL '2 days', CURRENT_DATE - INTERVAL '12 days', 1.80, '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003', FALSE, NULL, NULL),
    ('60000000-0000-0000-0000-000000000005', guest_hh_id, '50000000-0000-0000-0000-000000000013', 1, CURRENT_DATE + INTERVAL '3 days', CURRENT_DATE - INTERVAL '2 days', 1.40, '10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', TRUE, CURRENT_DATE - INTERVAL '1 day', 'Opened yesterday'),
    ('60000000-0000-0000-0000-000000000006', guest_hh_id, '50000000-0000-0000-0000-000000000008', 1, CURRENT_DATE + INTERVAL '1 day', CURRENT_DATE - INTERVAL '4 days', 0.80, '10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000004', FALSE, NULL, 'Getting spotty'),
    ('60000000-0000-0000-0000-000000000007', guest_hh_id, '50000000-0000-0000-0000-000000000012', 1, CURRENT_DATE + INTERVAL '1 day', CURRENT_DATE - INTERVAL '1 day', 6.00, '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', FALSE, NULL, 'Cook tonight!'),
    ('60000000-0000-0000-0000-000000000008', guest_hh_id, '50000000-0000-0000-0000-000000000014', 1, CURRENT_DATE + INTERVAL '2 days', CURRENT_DATE, 2.50, '10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002', FALSE, NULL, 'Fresh from bakery'),
    ('60000000-0000-0000-0000-000000000009', guest_hh_id, '50000000-0000-0000-0000-000000000001', 1, CURRENT_DATE + INTERVAL '6 days', CURRENT_DATE - INTERVAL '1 day', 1.55, '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', FALSE, NULL, NULL),
    ('60000000-0000-0000-0000-000000000010', guest_hh_id, '50000000-0000-0000-0000-000000000002', 1, CURRENT_DATE + INTERVAL '14 days', CURRENT_DATE - INTERVAL '7 days', 4.50, '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', FALSE, NULL, NULL),
    ('60000000-0000-0000-0000-000000000011', guest_hh_id, '50000000-0000-0000-0000-000000000005', 1, CURRENT_DATE + INTERVAL '14 days', CURRENT_DATE - INTERVAL '7 days', 3.20, '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003', FALSE, NULL, NULL),
    ('60000000-0000-0000-0000-000000000012', guest_hh_id, '50000000-0000-0000-0000-000000000004', 2, CURRENT_DATE + INTERVAL '21 days', CURRENT_DATE - INTERVAL '9 days', 2.80, '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', FALSE, NULL, NULL),
    ('60000000-0000-0000-0000-000000000013', guest_hh_id, '50000000-0000-0000-0000-000000000006', 1, CURRENT_DATE + INTERVAL '10 days', CURRENT_DATE - INTERVAL '4 days', 0.90, '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003', FALSE, NULL, NULL),
    ('60000000-0000-0000-0000-000000000014', guest_hh_id, '50000000-0000-0000-0000-000000000009', 1, CURRENT_DATE + INTERVAL '5 days', CURRENT_DATE - INTERVAL '2 days', 1.50, '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004', FALSE, NULL, NULL),
    ('60000000-0000-0000-0000-000000000015', guest_hh_id, '50000000-0000-0000-0000-000000000011', 1, CURRENT_DATE + INTERVAL '2 days', CURRENT_DATE, 4.50, '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', FALSE, NULL, 'For spaghetti bolognese'),
    ('60000000-0000-0000-0000-000000000016', guest_hh_id, '50000000-0000-0000-0000-000000000015', 1, CURRENT_DATE + INTERVAL '300 days', CURRENT_DATE - INTERVAL '65 days', 1.20, '10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000003', TRUE, CURRENT_DATE - INTERVAL '30 days', NULL),
    ('60000000-0000-0000-0000-000000000017', guest_hh_id, '50000000-0000-0000-0000-000000000016', 1, CURRENT_DATE + INTERVAL '150 days', CURRENT_DATE - INTERVAL '30 days', 3.50, '10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', FALSE, NULL, NULL),
    ('60000000-0000-0000-0000-000000000018', guest_hh_id, '50000000-0000-0000-0000-000000000017', 0.5, CURRENT_DATE + INTERVAL '120 days', CURRENT_DATE - INTERVAL '60 days', 2.50, '10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000003', TRUE, CURRENT_DATE - INTERVAL '14 days', 'Half box left'),
    ('60000000-0000-0000-0000-000000000019', guest_hh_id, '50000000-0000-0000-0000-000000000018', 3, NULL, CURRENT_DATE - INTERVAL '30 days', 1.20, '10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', FALSE, NULL, NULL),
    ('60000000-0000-0000-0000-000000000020', guest_hh_id, '50000000-0000-0000-0000-000000000019', 2, NULL, CURRENT_DATE - INTERVAL '60 days', 2.50, '10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', FALSE, NULL, NULL),
    ('60000000-0000-0000-0000-000000000021', guest_hh_id, '50000000-0000-0000-0000-000000000020', 2, CURRENT_DATE + INTERVAL '365 days', CURRENT_DATE - INTERVAL '14 days', 0.80, '10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', FALSE, NULL, NULL),
    ('60000000-0000-0000-0000-000000000022', guest_hh_id, '50000000-0000-0000-0000-000000000021', 1, CURRENT_DATE + INTERVAL '180 days', CURRENT_DATE - INTERVAL '45 days', 6.00, '10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002', TRUE, CURRENT_DATE - INTERVAL '30 days', NULL),
    ('60000000-0000-0000-0000-000000000023', guest_hh_id, '50000000-0000-0000-0000-000000000022', 1, CURRENT_DATE + INTERVAL '4 days', CURRENT_DATE - INTERVAL '6 days', 2.20, '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', TRUE, CURRENT_DATE - INTERVAL '3 days', NULL),
    ('60000000-0000-0000-0000-000000000024', guest_hh_id, '50000000-0000-0000-0000-000000000023', 0.5, CURRENT_DATE + INTERVAL '90 days', CURRENT_DATE - INTERVAL '60 days', 5.00, '10000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', TRUE, CURRENT_DATE - INTERVAL '45 days', 'Running low!'),
    ('60000000-0000-0000-0000-000000000025', guest_hh_id, '50000000-0000-0000-0000-000000000024', 1, CURRENT_DATE + INTERVAL '200 days', CURRENT_DATE - INTERVAL '30 days', 2.00, '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', TRUE, CURRENT_DATE - INTERVAL '25 days', NULL),
    ('60000000-0000-0000-0000-000000000026', guest_hh_id, '50000000-0000-0000-0000-000000000025', 1, NULL, CURRENT_DATE - INTERVAL '90 days', 3.50, '10000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000004', FALSE, NULL, NULL),
    ('60000000-0000-0000-0000-000000000027', guest_hh_id, '50000000-0000-0000-0000-000000000003', 2, CURRENT_DATE + INTERVAL '12 days', CURRENT_DATE - INTERVAL '2 days', 1.75, '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', FALSE, NULL, 'New batch'),
    ('60000000-0000-0000-0000-000000000028', guest_hh_id, '50000000-0000-0000-0000-000000000002', 1, CURRENT_DATE + INTERVAL '21 days', CURRENT_DATE - INTERVAL '3 days', 5.00, '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', FALSE, NULL, 'Premium brand'),
    ('60000000-0000-0000-0000-000000000029', guest_hh_id, '50000000-0000-0000-0000-000000000001', 1, CURRENT_DATE + INTERVAL '8 days', CURRENT_DATE, 1.45, '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003', FALSE, NULL, 'Aldi bargain');

  -- MEAL PLAN SECTIONS (fixed IDs for guest reset stability)
  INSERT INTO meal_plan_sections (id, household_id, name, time, sort_order) VALUES
    ('b0000000-0000-0000-0000-000000000001', guest_hh_id, 'Breakfast', '08:00', 0),
    ('b0000000-0000-0000-0000-000000000002', guest_hh_id, 'Lunch',     '12:00', 1),
    ('b0000000-0000-0000-0000-000000000003', guest_hh_id, 'Dinner',    '18:00', 2);

END;
$$;

-- ============================================
-- SEED GUEST HOUSEHOLD SECTIONS
-- (one-time insert for existing guest household)
-- ============================================

INSERT INTO meal_plan_sections (id, household_id, name, time, sort_order) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Breakfast', '08:00', 0),
  ('b0000000-0000-0000-0000-000000000002', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Lunch',     '12:00', 1),
  ('b0000000-0000-0000-0000-000000000003', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Dinner',    '18:00', 2)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- BACKFILL EXISTING AUTHENTICATED HOUSEHOLDS
-- Seeds default sections for users who signed up before v0.12
-- ============================================

INSERT INTO meal_plan_sections (household_id, name, time, sort_order)
SELECT h.id, s.name, s.time, s.sort_order
FROM households h
CROSS JOIN (VALUES
  ('Breakfast', '08:00'::TIME, 0),
  ('Lunch',     '12:00'::TIME, 1),
  ('Dinner',    '18:00'::TIME, 2)
) AS s(name, time, sort_order)
WHERE h.id != 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
  AND NOT EXISTS (
    SELECT 1 FROM meal_plan_sections mps WHERE mps.household_id = h.id
  );
