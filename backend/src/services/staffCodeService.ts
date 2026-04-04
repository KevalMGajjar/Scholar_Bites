import crypto from 'crypto';
import cron from 'node-cron';
import pool from '../config/db';

/**
 * ─── Staff Access Code Scheduler ──────────────────────────────
 * Generates a cryptographically secure 8-character alphanumeric code
 * and rotates it every 24 hours for each university.
 * The code is used by university staff to verify their identity
 * in the mobile app during sign-up.
 */

/** Generate a secure 8-character alphanumeric code */
function generateStaffCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusable chars (0, O, I, 1)
    let code = '';
    const bytes = crypto.randomBytes(8);
    for (let i = 0; i < 8; i++) {
        code += chars[bytes[i] % chars.length];
    }
    return code;
}

/** Rotate staff codes for all universities */
async function rotateStaffCodes(): Promise<void> {
    try {
        console.log('[StaffCode] Rotating staff access codes...');

        // Get all universities
        const uniResult = await pool.query('SELECT id FROM universities');

        for (const uni of uniResult.rows) {
            const newCode = generateStaffCode();

            // Upsert: create settings row if it doesn't exist, otherwise update the code
            await pool.query(
                `INSERT INTO university_settings (university_id, staff_access_code, staff_code_rotated_at)
                 VALUES ($1, $2, NOW())
                 ON CONFLICT (university_id)
                 DO UPDATE SET staff_access_code = $2, staff_code_rotated_at = NOW(), updated_at = NOW()`,
                [uni.id, newCode]
            );
        }

        console.log(`[StaffCode] Rotated codes for ${uniResult.rows.length} universities`);
    } catch (err: any) {
        console.error('[StaffCode] Rotation failed:', err.message);
    }
}

/**
 * Ensure all universities have a settings row with a valid staff code.
 * Called on server startup.
 */
export async function ensureStaffCodes(): Promise<void> {
    try {
        // Find universities without a settings row
        const result = await pool.query(
            `SELECT u.id FROM universities u
             LEFT JOIN university_settings s ON u.id = s.university_id
             WHERE s.id IS NULL`
        );

        for (const uni of result.rows) {
            const code = generateStaffCode();
            await pool.query(
                `INSERT INTO university_settings (university_id, staff_access_code, staff_code_rotated_at)
                 VALUES ($1, $2, NOW())
                 ON CONFLICT (university_id) DO NOTHING`,
                [uni.id, code]
            );
            console.log(`[StaffCode] Initialized code for university ${uni.id}`);
        }
    } catch (err: any) {
        console.error('[StaffCode] Initialization failed:', err.message);
    }
}

/**
 * Start the staff code rotation cron job.
 * Runs every 24 hours at midnight IST (18:30 UTC previous day).
 */
export function startStaffCodeRotation(): void {
    // Run at midnight IST every day = 00:00 IST = 18:30 UTC
    cron.schedule('30 18 * * *', rotateStaffCodes, {
        timezone: 'Asia/Kolkata',
    });
    console.log('[StaffCode] 24-hour rotation scheduler started (midnight IST)');

    // Also ensure all universities have codes on startup
    ensureStaffCodes();
}

export { generateStaffCode };
