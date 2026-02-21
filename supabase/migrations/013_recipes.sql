-- ============================================
-- v0.11.0: Recipes, Recipe Ingredients, Recipe Nestings
-- Recipe database with ingredient tracking and nesting support
-- ============================================

-- ============================================
-- RECIPES
-- ============================================

CREATE TABLE recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,

  -- Basic info
  name TEXT NOT NULL,
  description TEXT,
  picture_file_name TEXT,

  -- Servings
  base_servings DECIMAL NOT NULL DEFAULT 1,
  desired_servings DECIMAL NOT NULL DEFAULT 1,

  -- Settings
  not_check_shoppinglist BOOLEAN NOT NULL DEFAULT FALSE,

  -- Produces product (recipe outputs a product on consume)
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_recipes_household ON recipes(household_id);

ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own household recipes"
  ON recipes FOR SELECT USING (
    household_id IN (SELECT id FROM households WHERE owner_id = auth.uid())
    OR (household_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
        AND (auth.jwt() ->> 'is_anonymous')::boolean = TRUE)
  );

CREATE POLICY "Users can insert own household recipes"
  ON recipes FOR INSERT WITH CHECK (
    household_id IN (SELECT id FROM households WHERE owner_id = auth.uid())
    OR (household_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
        AND (auth.jwt() ->> 'is_anonymous')::boolean = TRUE)
  );

CREATE POLICY "Users can update own household recipes"
  ON recipes FOR UPDATE USING (
    household_id IN (SELECT id FROM households WHERE owner_id = auth.uid())
    OR (household_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
        AND (auth.jwt() ->> 'is_anonymous')::boolean = TRUE)
  );

CREATE POLICY "Users can delete own household recipes"
  ON recipes FOR DELETE USING (
    household_id IN (SELECT id FROM households WHERE owner_id = auth.uid())
    OR (household_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
        AND (auth.jwt() ->> 'is_anonymous')::boolean = TRUE)
  );

-- ============================================
-- RECIPE INGREDIENTS
-- ============================================

CREATE TABLE recipe_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,

  -- Product link (NULL for freeform ingredients)
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,

  -- Quantity
  amount DECIMAL NOT NULL DEFAULT 1,
  qu_id UUID REFERENCES quantity_units(id) ON DELETE SET NULL,

  -- Metadata
  note TEXT,                    -- Prep notes (e.g., "diced", "room temp")
  ingredient_group TEXT,        -- Section header (e.g., "For the sauce")
  variable_amount TEXT,         -- Text instead of number (e.g., "to taste")

  -- Stock fulfillment settings
  only_check_single_unit_in_stock BOOLEAN NOT NULL DEFAULT FALSE,
  not_check_stock_fulfillment BOOLEAN NOT NULL DEFAULT FALSE,

  -- Pricing
  price_factor DECIMAL NOT NULL DEFAULT 1,

  -- Ordering
  sort_order INTEGER NOT NULL DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_recipe_ingredients_household ON recipe_ingredients(household_id);
CREATE INDEX idx_recipe_ingredients_recipe ON recipe_ingredients(recipe_id);
CREATE INDEX idx_recipe_ingredients_product ON recipe_ingredients(product_id);

ALTER TABLE recipe_ingredients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own household recipe_ingredients"
  ON recipe_ingredients FOR SELECT USING (
    household_id IN (SELECT id FROM households WHERE owner_id = auth.uid())
    OR (household_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
        AND (auth.jwt() ->> 'is_anonymous')::boolean = TRUE)
  );

CREATE POLICY "Users can insert own household recipe_ingredients"
  ON recipe_ingredients FOR INSERT WITH CHECK (
    household_id IN (SELECT id FROM households WHERE owner_id = auth.uid())
    OR (household_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
        AND (auth.jwt() ->> 'is_anonymous')::boolean = TRUE)
  );

CREATE POLICY "Users can update own household recipe_ingredients"
  ON recipe_ingredients FOR UPDATE USING (
    household_id IN (SELECT id FROM households WHERE owner_id = auth.uid())
    OR (household_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
        AND (auth.jwt() ->> 'is_anonymous')::boolean = TRUE)
  );

CREATE POLICY "Users can delete own household recipe_ingredients"
  ON recipe_ingredients FOR DELETE USING (
    household_id IN (SELECT id FROM households WHERE owner_id = auth.uid())
    OR (household_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
        AND (auth.jwt() ->> 'is_anonymous')::boolean = TRUE)
  );

-- ============================================
-- RECIPE NESTINGS (recipe as ingredient)
-- ============================================

CREATE TABLE recipe_nestings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  includes_recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,

  -- How many servings of the nested recipe to include
  servings DECIMAL NOT NULL DEFAULT 1,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent self-nesting
  CHECK (recipe_id != includes_recipe_id)
);

CREATE INDEX idx_recipe_nestings_household ON recipe_nestings(household_id);
CREATE INDEX idx_recipe_nestings_recipe ON recipe_nestings(recipe_id);

ALTER TABLE recipe_nestings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own household recipe_nestings"
  ON recipe_nestings FOR SELECT USING (
    household_id IN (SELECT id FROM households WHERE owner_id = auth.uid())
    OR (household_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
        AND (auth.jwt() ->> 'is_anonymous')::boolean = TRUE)
  );

CREATE POLICY "Users can insert own household recipe_nestings"
  ON recipe_nestings FOR INSERT WITH CHECK (
    household_id IN (SELECT id FROM households WHERE owner_id = auth.uid())
    OR (household_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
        AND (auth.jwt() ->> 'is_anonymous')::boolean = TRUE)
  );

CREATE POLICY "Users can update own household recipe_nestings"
  ON recipe_nestings FOR UPDATE USING (
    household_id IN (SELECT id FROM households WHERE owner_id = auth.uid())
    OR (household_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
        AND (auth.jwt() ->> 'is_anonymous')::boolean = TRUE)
  );

CREATE POLICY "Users can delete own household recipe_nestings"
  ON recipe_nestings FOR DELETE USING (
    household_id IN (SELECT id FROM households WHERE owner_id = auth.uid())
    OR (household_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
        AND (auth.jwt() ->> 'is_anonymous')::boolean = TRUE)
  );
