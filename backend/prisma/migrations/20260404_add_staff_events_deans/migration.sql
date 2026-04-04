-- ═══════════════════════════════════════════════════════════════
-- Migration: Add Staff Events & Deans System
-- Description: Adds user_type, university_settings, deans, dean_coupons,
--              staff pre-orders, event pre-orders, and all related tables.
-- ═══════════════════════════════════════════════════════════════

-- 1. Add UserType enum and column to users
CREATE TYPE "UserType" AS ENUM ('student', 'university_staff');
ALTER TABLE "users" ADD COLUMN "user_type" "UserType" NOT NULL DEFAULT 'student';

-- 2. Create university_settings table
CREATE TABLE "university_settings" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "university_id" UUID NOT NULL,
    "staff_access_code" VARCHAR(20) NOT NULL,
    "staff_code_rotated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "group_order_visible_students" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "university_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "university_settings_university_id_key" ON "university_settings"("university_id");
ALTER TABLE "university_settings" ADD CONSTRAINT "university_settings_university_id_fkey"
    FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 3. Create deans table
CREATE TABLE "deans" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "university_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "school_name" VARCHAR(255) NOT NULL,
    "total_budget" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "used_budget" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "active_token" VARCHAR(64),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deans_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "deans_email_key" ON "deans"("email");
ALTER TABLE "deans" ADD CONSTRAINT "deans_university_id_fkey"
    FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 4. Create CouponStatus enum and dean_coupons table
CREATE TYPE "CouponStatus" AS ENUM ('active', 'redeemed', 'expired', 'revoked');

CREATE TABLE "dean_coupons" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "dean_id" UUID NOT NULL,
    "code" VARCHAR(12) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" "CouponStatus" NOT NULL DEFAULT 'active',
    "redeemed_by" UUID,
    "redeemed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "dean_coupons_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "dean_coupons_code_key" ON "dean_coupons"("code");
ALTER TABLE "dean_coupons" ADD CONSTRAINT "dean_coupons_dean_id_fkey"
    FOREIGN KEY ("dean_id") REFERENCES "deans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "dean_coupons" ADD CONSTRAINT "dean_coupons_redeemed_by_fkey"
    FOREIGN KEY ("redeemed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 5. Create PreOrderStatus enum and staff_pre_orders tables
CREATE TYPE "PreOrderStatus" AS ENUM ('pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled');

CREATE TABLE "staff_pre_orders" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "university_id" UUID NOT NULL,
    "restaurant_id" UUID NOT NULL,
    "status" "PreOrderStatus" NOT NULL DEFAULT 'pending',
    "order_date" DATE NOT NULL,
    "total_amount" DECIMAL(10,2) NOT NULL,
    "payment_method" VARCHAR(20) NOT NULL DEFAULT 'wallet',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_pre_orders_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "staff_pre_orders" ADD CONSTRAINT "staff_pre_orders_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "staff_pre_orders" ADD CONSTRAINT "staff_pre_orders_university_id_fkey"
    FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "staff_pre_orders" ADD CONSTRAINT "staff_pre_orders_restaurant_id_fkey"
    FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "staff_pre_order_items" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "pre_order_id" UUID NOT NULL,
    "menu_item_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price_at_time" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "staff_pre_order_items_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "staff_pre_order_items" ADD CONSTRAINT "staff_pre_order_items_pre_order_id_fkey"
    FOREIGN KEY ("pre_order_id") REFERENCES "staff_pre_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "staff_pre_order_items" ADD CONSTRAINT "staff_pre_order_items_menu_item_id_fkey"
    FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 6. Create EventStatus enum and event_pre_orders tables
CREATE TYPE "EventStatus" AS ENUM ('upcoming', 'confirmed', 'preparing', 'completed', 'cancelled');

CREATE TABLE "event_pre_orders" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "university_id" UUID NOT NULL,
    "event_name" VARCHAR(255) NOT NULL,
    "event_date" DATE NOT NULL,
    "event_time" VARCHAR(10) NOT NULL,
    "member_count" INTEGER NOT NULL,
    "staff_name" VARCHAR(100) NOT NULL,
    "staff_email" VARCHAR(255) NOT NULL,
    "status" "EventStatus" NOT NULL DEFAULT 'upcoming',
    "total_amount" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_pre_orders_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "event_pre_orders" ADD CONSTRAINT "event_pre_orders_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "event_pre_orders" ADD CONSTRAINT "event_pre_orders_university_id_fkey"
    FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "event_pre_order_items" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "event_order_id" UUID NOT NULL,
    "menu_item_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price_at_time" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "event_pre_order_items_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "event_pre_order_items" ADD CONSTRAINT "event_pre_order_items_event_order_id_fkey"
    FOREIGN KEY ("event_order_id") REFERENCES "event_pre_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "event_pre_order_items" ADD CONSTRAINT "event_pre_order_items_menu_item_id_fkey"
    FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
