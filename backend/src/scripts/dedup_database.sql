-- ============================================================
-- Scholar Bites: Database Deduplication Script
-- Run this against your AWS PostgreSQL database
-- ============================================================
-- ⚠️  ALWAYS run the COUNT queries first to preview before deleting!

-- ═══════════════════════════════════════════════════════════
-- STEP 1: PREVIEW — See how many duplicates exist
-- ═══════════════════════════════════════════════════════════

-- Preview duplicate RESTAURANTS (same name in same university)
SELECT name, university_id, COUNT(*) as copies
FROM restaurants
GROUP BY name, university_id
HAVING COUNT(*) > 1;

-- Preview duplicate MENU ITEMS (same name in same restaurant)
SELECT name, restaurant_id, COUNT(*) as copies
FROM menu_items
GROUP BY name, restaurant_id
HAVING COUNT(*) > 1;

-- ═══════════════════════════════════════════════════════════
-- STEP 2: DELETE DUPLICATES (keeps the oldest entry)
-- ═══════════════════════════════════════════════════════════

-- First, handle menu_items that reference duplicate restaurants
-- (we need to reassign them before deleting restaurant dupes)

-- 2a. Delete duplicate MENU ITEMS (keep oldest per restaurant+name)
DELETE FROM menu_items
WHERE id NOT IN (
    SELECT DISTINCT ON (restaurant_id, name) id
    FROM menu_items
    ORDER BY restaurant_id, name, created_at ASC
);

-- 2b. Delete duplicate RESTAURANTS (keep oldest per university+name)
-- But first, reassign any menu_items from duplicate restaurants to the surviving one
DO $$
DECLARE
    dup RECORD;
    keep_id UUID;
BEGIN
    FOR dup IN
        SELECT name, university_id
        FROM restaurants
        GROUP BY name, university_id
        HAVING COUNT(*) > 1
    LOOP
        -- Find the oldest (keeper) restaurant id
        SELECT id INTO keep_id
        FROM restaurants
        WHERE name = dup.name AND university_id = dup.university_id
        ORDER BY created_at ASC
        LIMIT 1;

        -- Reassign menu_items from duplicate restaurants to the keeper
        UPDATE menu_items
        SET restaurant_id = keep_id
        WHERE restaurant_id IN (
            SELECT id FROM restaurants
            WHERE name = dup.name
            AND university_id = dup.university_id
            AND id != keep_id
        );

        -- Now delete the duplicate restaurants
        DELETE FROM restaurants
        WHERE name = dup.name
        AND university_id = dup.university_id
        AND id != keep_id;
    END LOOP;
END $$;

-- ═══════════════════════════════════════════════════════════
-- STEP 3: VERIFY — Confirm no duplicates remain
-- ═══════════════════════════════════════════════════════════

SELECT 'Duplicate Restaurants:' as check_type, COUNT(*) as count FROM (
    SELECT name, university_id FROM restaurants GROUP BY name, university_id HAVING COUNT(*) > 1
) r
UNION ALL
SELECT 'Duplicate Menu Items:', COUNT(*) FROM (
    SELECT name, restaurant_id FROM menu_items GROUP BY name, restaurant_id HAVING COUNT(*) > 1
) m;

-- ═══════════════════════════════════════════════════════════
-- STEP 4: PREVENT FUTURE DUPLICATES — Add unique constraints
-- ═══════════════════════════════════════════════════════════

ALTER TABLE restaurants
ADD CONSTRAINT unique_restaurant_per_university UNIQUE (university_id, name);

ALTER TABLE menu_items
ADD CONSTRAINT unique_menu_item_per_restaurant UNIQUE (restaurant_id, name);
