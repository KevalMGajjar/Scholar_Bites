-- Adds the staff cancellation reason field to event pre-orders.
-- Safe to run multiple times.
ALTER TABLE event_pre_orders ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
