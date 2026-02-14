-- ============================================
-- v0.9.1: Add brand and store-brand fields to products
-- ============================================

ALTER TABLE products ADD COLUMN brand TEXT;
ALTER TABLE products ADD COLUMN is_store_brand BOOLEAN NOT NULL DEFAULT FALSE;
