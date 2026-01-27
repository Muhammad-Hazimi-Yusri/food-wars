-- ============================================
-- CLEANUP: Delete orphan households
-- ============================================
-- Run manually when needed to clean up households
-- created by anonymous users before trigger fix
-- ============================================

-- Preview what will be deleted
SELECT h.id, h.name, h.owner_id, h.created_at,
       (SELECT COUNT(*) FROM locations WHERE household_id = h.id) as locations,
       (SELECT COUNT(*) FROM products WHERE household_id = h.id) as products
FROM households h
WHERE h.id != 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'  -- not guest household
ORDER BY h.created_at;

-- Uncomment to delete orphan households (those with 0 products)
-- DELETE FROM households
-- WHERE id != 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
--   AND id NOT IN (
--     SELECT DISTINCT household_id FROM products WHERE household_id IS NOT NULL
--   );