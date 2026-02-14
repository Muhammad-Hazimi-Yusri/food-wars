-- ============================================
-- v0.9.2: Product nutrition table
-- Per-100g nutrition facts with Nutri-Score
-- ============================================

CREATE TABLE product_nutrition (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,

  -- Per 100g values (EU Big 8)
  energy_kj    DECIMAL,
  energy_kcal  DECIMAL,
  fat          DECIMAL,
  saturated_fat DECIMAL,
  carbohydrates DECIMAL,
  sugars       DECIMAL,
  fibre        DECIMAL,
  protein      DECIMAL,
  salt         DECIMAL,

  -- Nutri-Score grade from OFF (a-e) or null
  nutrition_grade TEXT CHECK (nutrition_grade IN ('a','b','c','d','e')),

  -- Where did this data come from?
  data_source TEXT NOT NULL DEFAULT 'manual' CHECK (data_source IN ('off','manual','cv')),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(product_id)
);

CREATE INDEX idx_product_nutrition_product ON product_nutrition(product_id);
CREATE INDEX idx_product_nutrition_household ON product_nutrition(household_id);

-- RLS (dual-mode pattern matching 003_guest_mode.sql)
ALTER TABLE product_nutrition ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own household product_nutrition"
  ON product_nutrition FOR SELECT
  USING (
    household_id IN (SELECT id FROM households WHERE owner_id = auth.uid())
    OR (household_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' AND (auth.jwt() ->> 'is_anonymous')::boolean = TRUE)
  );

CREATE POLICY "Users can insert into own household product_nutrition"
  ON product_nutrition FOR INSERT
  WITH CHECK (
    household_id IN (SELECT id FROM households WHERE owner_id = auth.uid())
    OR (household_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' AND (auth.jwt() ->> 'is_anonymous')::boolean = TRUE)
  );

CREATE POLICY "Users can update own household product_nutrition"
  ON product_nutrition FOR UPDATE
  USING (
    household_id IN (SELECT id FROM households WHERE owner_id = auth.uid())
    OR (household_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' AND (auth.jwt() ->> 'is_anonymous')::boolean = TRUE)
  );

CREATE POLICY "Users can delete own household product_nutrition"
  ON product_nutrition FOR DELETE
  USING (
    household_id IN (SELECT id FROM households WHERE owner_id = auth.uid())
    OR (household_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' AND (auth.jwt() ->> 'is_anonymous')::boolean = TRUE)
  );
