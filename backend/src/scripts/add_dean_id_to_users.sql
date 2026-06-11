-- ═══════════════════════════════════════════════════════════════
-- Migration: Add dean_id FK to users table (for admin representatives)
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE users ADD COLUMN IF NOT EXISTS dean_id UUID REFERENCES deans(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_users_dean_id ON users(dean_id);
