-- ============================================
-- v0.15.0: Extend household_ai_settings
--   - api_token for external JSON export access
--   - notification preferences for food-waste alerts
-- ============================================

ALTER TABLE household_ai_settings
  ADD COLUMN api_token TEXT UNIQUE,
  ADD COLUMN notify_days_before INT NOT NULL DEFAULT 3,
  ADD COLUMN notify_browser BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN notify_bell BOOLEAN NOT NULL DEFAULT TRUE;

-- Partial index so token lookups are fast; tokens are sparse
CREATE INDEX idx_ai_settings_api_token
  ON household_ai_settings(api_token)
  WHERE api_token IS NOT NULL;

-- Sanity: notify_days_before must be a non-negative, reasonable number
ALTER TABLE household_ai_settings
  ADD CONSTRAINT household_ai_settings_notify_days_before_range
  CHECK (notify_days_before >= 0 AND notify_days_before <= 30);
