-- ============================================
-- SHOPPING LISTS (v0.7)
-- ============================================
-- Manual and auto-generated shopping lists
-- Follows existing household_id + RLS pattern
-- ============================================

-- ============================================
-- 1. SHOPPING LISTS TABLE
-- ============================================

CREATE TABLE shopping_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_auto_target BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_shopping_lists_household ON shopping_lists(household_id);

ALTER TABLE shopping_lists ENABLE ROW LEVEL SECURITY;

-- RLS policies (dual-condition: auth users + guest mode)
CREATE POLICY "Users can view own household shopping_lists"
  ON shopping_lists FOR SELECT
  USING (
    household_id IN (SELECT id FROM households WHERE owner_id = auth.uid())
    OR (household_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' AND (auth.jwt() ->> 'is_anonymous')::boolean = TRUE)
  );

CREATE POLICY "Users can insert into own household shopping_lists"
  ON shopping_lists FOR INSERT
  WITH CHECK (
    household_id IN (SELECT id FROM households WHERE owner_id = auth.uid())
    OR (household_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' AND (auth.jwt() ->> 'is_anonymous')::boolean = TRUE)
  );

CREATE POLICY "Users can update own household shopping_lists"
  ON shopping_lists FOR UPDATE
  USING (
    household_id IN (SELECT id FROM households WHERE owner_id = auth.uid())
    OR (household_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' AND (auth.jwt() ->> 'is_anonymous')::boolean = TRUE)
  );

CREATE POLICY "Users can delete own household shopping_lists"
  ON shopping_lists FOR DELETE
  USING (
    household_id IN (SELECT id FROM households WHERE owner_id = auth.uid())
    OR (household_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' AND (auth.jwt() ->> 'is_anonymous')::boolean = TRUE)
  );

-- ============================================
-- 2. SHOPPING LIST ITEMS TABLE
-- ============================================

CREATE TABLE shopping_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  shopping_list_id UUID NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  note TEXT,
  amount DECIMAL NOT NULL DEFAULT 1,
  qu_id UUID REFERENCES quantity_units(id) ON DELETE SET NULL,
  done BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_shopping_list_items_household ON shopping_list_items(household_id);
CREATE INDEX idx_shopping_list_items_list ON shopping_list_items(shopping_list_id);
CREATE INDEX idx_shopping_list_items_product ON shopping_list_items(product_id);

ALTER TABLE shopping_list_items ENABLE ROW LEVEL SECURITY;

-- RLS policies (dual-condition: auth users + guest mode)
CREATE POLICY "Users can view own household shopping_list_items"
  ON shopping_list_items FOR SELECT
  USING (
    household_id IN (SELECT id FROM households WHERE owner_id = auth.uid())
    OR (household_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' AND (auth.jwt() ->> 'is_anonymous')::boolean = TRUE)
  );

CREATE POLICY "Users can insert into own household shopping_list_items"
  ON shopping_list_items FOR INSERT
  WITH CHECK (
    household_id IN (SELECT id FROM households WHERE owner_id = auth.uid())
    OR (household_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' AND (auth.jwt() ->> 'is_anonymous')::boolean = TRUE)
  );

CREATE POLICY "Users can update own household shopping_list_items"
  ON shopping_list_items FOR UPDATE
  USING (
    household_id IN (SELECT id FROM households WHERE owner_id = auth.uid())
    OR (household_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' AND (auth.jwt() ->> 'is_anonymous')::boolean = TRUE)
  );

CREATE POLICY "Users can delete own household shopping_list_items"
  ON shopping_list_items FOR DELETE
  USING (
    household_id IN (SELECT id FROM households WHERE owner_id = auth.uid())
    OR (household_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' AND (auth.jwt() ->> 'is_anonymous')::boolean = TRUE)
  );
