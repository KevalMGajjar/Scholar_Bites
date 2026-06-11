-- New-orders flow + per-restaurant preparing limit. Safe to run multiple times.
ALTER TYPE order_status_enum ADD VALUE IF NOT EXISTS 'placed';
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS prep_limit INT DEFAULT 0;
