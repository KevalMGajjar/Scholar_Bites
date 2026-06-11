-- Adds the custom-order / special-requirements field to event pre-orders.
-- Safe to run multiple times.
ALTER TABLE event_pre_orders ADD COLUMN IF NOT EXISTS special_requirements TEXT;
