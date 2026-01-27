-- ============================================
-- FIX: Skip anonymous users in new user trigger
-- ============================================
-- Anonymous users use the shared guest household
-- instead of creating their own
-- ============================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  new_household_id UUID;
BEGIN
  -- Skip anonymous users - they use the shared guest household
  IF NEW.is_anonymous = TRUE THEN
    RETURN NEW;
  END IF;

  -- Create household for regular users
  INSERT INTO households (owner_id, name)
  VALUES (NEW.id, 'My Household')
  RETURNING id INTO new_household_id;
  
  -- Seed default locations
  INSERT INTO locations (household_id, name, is_freezer, sort_order) VALUES
    (new_household_id, 'Fridge', FALSE, 1),
    (new_household_id, 'Freezer', TRUE, 2),
    (new_household_id, 'Pantry', FALSE, 3),
    (new_household_id, 'Cupboard', FALSE, 4);
  
  -- Seed default product groups
  INSERT INTO product_groups (household_id, name, sort_order) VALUES
    (new_household_id, 'Dairy', 1),
    (new_household_id, 'Produce', 2),
    (new_household_id, 'Meat & Seafood', 3),
    (new_household_id, 'Bakery', 4),
    (new_household_id, 'Frozen', 5),
    (new_household_id, 'Pantry Staples', 6),
    (new_household_id, 'Snacks', 7),
    (new_household_id, 'Beverages', 8),
    (new_household_id, 'Condiments', 9),
    (new_household_id, 'Spices', 10);
  
  -- Seed default quantity units
  INSERT INTO quantity_units (household_id, name, name_plural, sort_order) VALUES
    (new_household_id, 'piece', 'pieces', 1),
    (new_household_id, 'pack', 'packs', 2),
    (new_household_id, 'bottle', 'bottles', 3),
    (new_household_id, 'can', 'cans', 4),
    (new_household_id, 'bag', 'bags', 5),
    (new_household_id, 'box', 'boxes', 6),
    (new_household_id, 'kg', 'kg', 7),
    (new_household_id, 'g', 'g', 8),
    (new_household_id, 'L', 'L', 9),
    (new_household_id, 'mL', 'mL', 10);
  
  RETURN NEW;
END;
$$;