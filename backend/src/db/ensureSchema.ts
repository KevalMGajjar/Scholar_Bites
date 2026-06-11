import pool from '../config/db';
import { createTablesQuery } from '../scripts/initDb';

/**
 * Runs the canonical idempotent schema (CREATE TABLE IF NOT EXISTS …) on startup.
 *
 * Why this exists: several tables (notifications, global_notifications,
 * audit_logs, refund_requests, user_favorites, …) are NOT managed by Prisma —
 * they live only in initDb.ts. If a server's DB was provisioned via Prisma
 * alone, those tables are silently absent and features that use them fail with
 * `relation "<table>" does not exist` (this is exactly what broke order-ready
 * notifications). Running the same IF-NOT-EXISTS schema at boot self-heals any
 * missing table on the next restart.
 *
 * Safe to run every boot: every statement is IF NOT EXISTS / ADD COLUMN IF NOT
 * EXISTS, so it's a no-op when the schema is already present. Never throws —
 * a failure here logs and lets the server start (don't take the app down over it).
 */
export const ensureSchema = async (): Promise<void> => {
    try {
        await pool.query(createTablesQuery);
        console.log('[Schema] ✅ Verified all tables exist (ensureSchema)');
    } catch (err: any) {
        console.error('[Schema] ⚠️ ensureSchema failed (continuing to start anyway):', err.message);
    }
};
