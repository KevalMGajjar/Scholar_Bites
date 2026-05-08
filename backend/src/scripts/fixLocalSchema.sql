-- ═══════════════════════════════════════════════════════════════
-- Fix Local Schema: Adds all tables/columns missing from Prisma
-- Run AFTER "npx prisma db push"
-- ═══════════════════════════════════════════════════════════════

-- 1. Enable UUID extension (may already exist)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Add staff_email to dean_coupons (for voucher notification emails)
ALTER TABLE dean_coupons ADD COLUMN IF NOT EXISTS staff_email VARCHAR(255);

-- 2.5 Add is_event_restaurant to restaurants (for catering-only restaurants)
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS is_event_restaurant BOOLEAN DEFAULT false;

-- 3. Add opening_time / closing_time to restaurants (used by scheduler)
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS opening_time TIME;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS closing_time TIME;

-- 3. Staff Login OTPs (2FA for admin panel)
CREATE TABLE IF NOT EXISTS staff_login_otps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    otp_hash VARCHAR(64) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    attempts INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_staff_otp_staff ON staff_login_otps(staff_id, used);

-- 4. Audit Logs (may already exist from Prisma, safe to skip)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    action VARCHAR(50) NOT NULL,
    resource VARCHAR(255),
    details TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);

-- 5. Locked Accounts (brute-force protection)
CREATE TABLE IF NOT EXISTS locked_accounts (
    identifier VARCHAR(255) PRIMARY KEY,
    attempt_count INT DEFAULT 0,
    locked_until TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Global Notifications (mass broadcasts)
CREATE TABLE IF NOT EXISTS global_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    university_id UUID REFERENCES universities(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_global_notif_uni ON global_notifications(university_id, created_at DESC);

-- 6. Global Notification Reads
CREATE TABLE IF NOT EXISTS global_notification_reads (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    global_notification_id UUID REFERENCES global_notifications(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, global_notification_id)
);

-- 7. Refund Requests
CREATE TABLE IF NOT EXISTS refund_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id),
    requested_by UUID NOT NULL REFERENCES staff(id),
    approved_by UUID REFERENCES staff(id),
    reason TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    admin_note TEXT,
    amount NUMERIC(10,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_refund_status ON refund_requests(status);
CREATE INDEX IF NOT EXISTS idx_refund_order ON refund_requests(order_id);

-- 8. User Favorites
CREATE TABLE IF NOT EXISTS user_favorites (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, menu_item_id)
);
CREATE INDEX IF NOT EXISTS idx_user_fav_item ON user_favorites(menu_item_id);

-- 9. Missing columns on existing tables (safe idempotent ALTERs)
ALTER TABLE users ADD COLUMN IF NOT EXISTS fcm_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS active_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(100);
ALTER TABLE staff ADD COLUMN IF NOT EXISTS active_token TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS qr_secret VARCHAR(64);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS qr_rotated_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS batch_id VARCHAR(64);
ALTER TABLE group_orders ADD COLUMN IF NOT EXISTS university_id UUID REFERENCES universities(id) ON DELETE SET NULL;
ALTER TABLE group_order_members ADD COLUMN IF NOT EXISTS nickname VARCHAR(100);

-- 10. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_batch_id ON orders(batch_id) WHERE batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_staff_restaurant_id ON staff(restaurant_id) WHERE restaurant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_created ON notifications(created_at);

-- Done!
