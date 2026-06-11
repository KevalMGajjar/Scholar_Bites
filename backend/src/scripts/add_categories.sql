-- ═══════════════════════════════════════════════════════════════
-- Migration: Add categories table & link menu_items to categories
-- ═══════════════════════════════════════════════════════════════

-- 1. Create the categories table
CREATE TABLE IF NOT EXISTS categories (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    name        VARCHAR(100) NOT NULL,
    cutoff_time TIME,                -- Deadline time for ordering (e.g. 14:00)
    lead_time   INT DEFAULT 0,       -- Lead time in minutes
    created_at  TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(restaurant_id, name)
);

-- 2. Add category_id FK to menu_items (nullable for backward compat during migration)
ALTER TABLE menu_items
    ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id) ON DELETE SET NULL;

-- 3. Create index on menu_items.category_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_menu_items_category_id ON menu_items(category_id);

-- 4. Create index on categories.restaurant_id
CREATE INDEX IF NOT EXISTS idx_categories_restaurant_id ON categories(restaurant_id);
