-- Adds the 'on_hold' state to the EventStatus enum (custom-order quote/approval flow).
-- Safe to run multiple times.
ALTER TYPE "EventStatus" ADD VALUE IF NOT EXISTS 'on_hold';
