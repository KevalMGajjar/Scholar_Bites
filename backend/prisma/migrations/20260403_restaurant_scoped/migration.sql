-- Restaurant-Scoped Admin + Multi-QR + Invoice System Migration

-- 1. Add restaurant_id to staff for per-restaurant access control
ALTER TABLE staff ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES restaurants(id);

-- 2. Add QR rotation fields to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS qr_secret VARCHAR(64);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS qr_rotated_at TIMESTAMPTZ;

-- 3. Add batch_id for multi-restaurant checkout grouping
ALTER TABLE orders ADD COLUMN IF NOT EXISTS batch_id VARCHAR(64);

-- 4. Create index on batch_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_orders_batch_id ON orders(batch_id) WHERE batch_id IS NOT NULL;

-- 5. Create index on staff restaurant_id
CREATE INDEX IF NOT EXISTS idx_staff_restaurant_id ON staff(restaurant_id) WHERE restaurant_id IS NOT NULL;
