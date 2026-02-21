-- Migration 014: Add instructions column to recipes
-- Stores markdown-formatted step-by-step cooking instructions.

ALTER TABLE recipes ADD COLUMN IF NOT EXISTS instructions TEXT;
