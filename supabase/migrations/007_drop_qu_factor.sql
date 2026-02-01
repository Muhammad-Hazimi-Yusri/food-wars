-- Migration: Drop deprecated qu_factor_purchase_to_stock column
-- Date: 2025-01-31
-- Reason: Grocy 4.0 removed this field. Conversions are now stored in quantity_unit_conversions table.

ALTER TABLE products DROP COLUMN IF EXISTS qu_factor_purchase_to_stock;

-- Note: Existing conversion factors should be migrated to quantity_unit_conversions table
-- before running this migration. This app uses quantity_unit_conversions exclusively.