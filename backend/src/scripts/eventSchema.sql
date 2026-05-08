-- Add rejection_reason column
ALTER TABLE event_pre_orders ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Add new enum values to EventStatus
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'approved' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'EventStatus')) THEN
    ALTER TYPE "EventStatus" ADD VALUE 'approved';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'rejected' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'EventStatus')) THEN
    ALTER TYPE "EventStatus" ADD VALUE 'rejected';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'pending' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'EventStatus')) THEN
    ALTER TYPE "EventStatus" ADD VALUE 'pending';
  END IF;
END $$;
