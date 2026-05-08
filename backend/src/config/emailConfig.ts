import pool from './db';
import { AHMEDABAD_UNIVERSITY_ID } from './constants';

/**
 * ─── Global Email Configuration ──────────────────────────────
 * Cached email addresses loaded from university_settings.
 * - systemEmail:     The FROM address for all outgoing mails (falls back to SMTP_USER)
 * - adminEmail:      Recipient for admin-level notifications (catering, orders)
 * - superAdminEmail: Recipient for super-admin alerts (refunds, critical)
 */

interface EmailConfig {
    systemEmail: string;
    adminEmail: string;
    superAdminEmail: string;
}

let cachedConfig: EmailConfig | null = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export const getEmailConfig = async (): Promise<EmailConfig> => {
    const now = Date.now();
    if (cachedConfig && (now - lastFetchTime) < CACHE_TTL_MS) {
        return cachedConfig;
    }

    try {
        const result = await pool.query(
            'SELECT system_email, admin_email, super_admin_email FROM university_settings WHERE university_id = $1',
            [AHMEDABAD_UNIVERSITY_ID]
        );

        const row = result.rows[0];
        const fallback = process.env.SMTP_USER || '';

        cachedConfig = {
            systemEmail: row?.system_email || fallback,
            adminEmail: row?.admin_email || fallback,
            superAdminEmail: row?.super_admin_email || fallback,
        };
        lastFetchTime = now;
    } catch (err) {
        console.error('[EmailConfig] Failed to load from DB, using env fallback:', err);
        const fallback = process.env.SMTP_USER || '';
        cachedConfig = {
            systemEmail: fallback,
            adminEmail: fallback,
            superAdminEmail: fallback,
        };
        lastFetchTime = now;
    }

    return cachedConfig;
};

/** Force refresh config (call after settings update) */
export const invalidateEmailConfig = () => {
    cachedConfig = null;
    lastFetchTime = 0;
};
