-- v0.13.1: Composite index for per-product analytics queries
-- Dramatically speeds up queries filtering stock_log by household + product + type

CREATE INDEX IF NOT EXISTS idx_stock_log_product_type
  ON stock_log (household_id, product_id, transaction_type, created_at DESC);
