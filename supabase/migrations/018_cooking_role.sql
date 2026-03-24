-- ============================================
-- COOKING ROLE COLUMN (v0.14 — Cook Now)
-- ============================================
-- Adds a cooking_role tag to products for the
-- Cook Now feature (Chlebowski framework).
-- ============================================

ALTER TABLE products
  ADD COLUMN cooking_role TEXT DEFAULT NULL
  CHECK (cooking_role IN (
    'protein', 'vegetable', 'starch', 'seasoning_system',
    'sauce', 'produce', 'form_factor_base', 'other'
  ));
