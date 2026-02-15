-- ============================================
-- v1.0.0: Household AI settings
-- Ollama connection config per household
-- ============================================

CREATE TABLE household_ai_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,

  ollama_url TEXT,            -- e.g. "http://192.168.1.100:11434"
  text_model TEXT,            -- e.g. "llama3.2"
  vision_model TEXT,          -- e.g. "llava" (reserved for future)

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(household_id)
);

CREATE INDEX idx_ai_settings_household ON household_ai_settings(household_id);

-- RLS (dual-mode pattern matching 011_product_nutrition.sql)
ALTER TABLE household_ai_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own household AI settings"
  ON household_ai_settings FOR SELECT USING (
    household_id IN (SELECT id FROM households WHERE owner_id = auth.uid())
    OR (household_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
        AND (auth.jwt() ->> 'is_anonymous')::boolean = TRUE)
  );

CREATE POLICY "Users can insert own household AI settings"
  ON household_ai_settings FOR INSERT WITH CHECK (
    household_id IN (SELECT id FROM households WHERE owner_id = auth.uid())
    OR (household_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
        AND (auth.jwt() ->> 'is_anonymous')::boolean = TRUE)
  );

CREATE POLICY "Users can update own household AI settings"
  ON household_ai_settings FOR UPDATE USING (
    household_id IN (SELECT id FROM households WHERE owner_id = auth.uid())
    OR (household_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
        AND (auth.jwt() ->> 'is_anonymous')::boolean = TRUE)
  );

CREATE POLICY "Users can delete own household AI settings"
  ON household_ai_settings FOR DELETE USING (
    household_id IN (SELECT id FROM households WHERE owner_id = auth.uid())
    OR (household_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
        AND (auth.jwt() ->> 'is_anonymous')::boolean = TRUE)
  );
