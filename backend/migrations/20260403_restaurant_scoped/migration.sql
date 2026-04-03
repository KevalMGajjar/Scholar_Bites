-- ═══════════════════════════════════════════════════════════
-- Migration: Restaurant-Scoped Access & Multi-Restaurant Orders
-- Date: 2026-04-03
-- ═══════════════════════════════════════════════════════════

-- 1. Add restaurant_id to Staff for restaurant-scoped access
ALTER TABLE staff ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES restaurants(id) ON DELETE SET NULL;

-- 2. Add QR rotation & batch fields to Orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS qr_secret TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS qr_rotated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE orders ADD COLUMN IF NOT EXISTS batch_id TEXT;

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_staff_restaurant_id ON staff(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_orders_batch_id ON orders(batch_id);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_id ON orders(restaurant_id);

-- 4. Verify migration
DO $$
BEGIN
  RAISE NOTICE '✅ Migration complete: restaurant_id on staff, qr_secret/qr_rotated_at/batch_id on orders';
END $$;
