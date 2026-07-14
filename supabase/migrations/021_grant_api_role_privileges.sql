-- ============================================
-- EXPLICIT TABLE PRIVILEGES FOR API ROLES
-- ============================================
-- Newer Supabase stacks no longer auto-grant table-level privileges on
-- migration-created objects in the public schema, so API requests fail
-- with 42501 "permission denied" before RLS is even evaluated (first seen
-- in CI when supabase/setup-cli@latest pulled the July 2026 local stack;
-- the May 2026 stack still auto-granted). Hosted projects created earlier
-- already have these grants, so re-granting there is a no-op.
--
-- Row access control is unchanged: every table below has RLS enabled and
-- policies from earlier migrations. Table grants + RLS together reproduce
-- the effective access the app has always had.
--
-- NOTE for future migrations: any new table must both ENABLE ROW LEVEL
-- SECURITY and rely on these default privileges (or grant explicitly).
-- ============================================

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- RLS-protected application tables
GRANT ALL ON TABLE
  households,
  locations,
  shopping_locations,
  product_groups,
  quantity_units,
  quantity_unit_conversions,
  products,
  product_barcodes,
  product_nutrition,
  stock_entries,
  stock_log,
  shopping_lists,
  shopping_list_items,
  household_ai_settings,
  recipes,
  recipe_ingredients,
  recipe_nestings,
  meal_plan,
  meal_plan_sections,
  mcp_oauth_tokens
TO anon, authenticated, service_role;

-- OAuth client registry and auth codes are only ever touched through the
-- service-role client (src/lib/mcp/oauth/store.ts) and have no RLS, so
-- they must not be reachable with the anon/authenticated API roles.
GRANT ALL ON TABLE mcp_oauth_clients, mcp_oauth_codes TO service_role;
REVOKE ALL ON TABLE mcp_oauth_clients, mcp_oauth_codes FROM anon, authenticated;

-- Sequences and functions (matches the historical platform defaults;
-- functions include seed_guest_data used by the guest-reset admin route)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

-- Future objects created by the migration role inherit the same grants
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;
