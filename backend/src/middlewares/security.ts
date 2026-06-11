import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';

// ═══════════════════════════════════════════════════════
// Helmet — Secure HTTP Headers
// ═══════════════════════════════════════════════════════
export const securityHeaders = helmet({
    contentSecurityPolicy: false, // Admin panels use inline styles + external CDN fonts
    crossOriginOpenerPolicy: false, // Conflicts on non-HTTPS origins
    crossOriginResourcePolicy: false, // Allows loading S3 images cross-origin
    crossOriginEmbedderPolicy: false, // Allow loading images from S3
    hsts: false, // MUST be false until HTTPS is configured — otherwise browsers force HTTPS
});

// ═══════════════════════════════════════════════════════
// Rate Limiters
// ═══════════════════════════════════════════════════════

/** General API rate limiter: 500 requests per 15 minutes per IP */
export const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
    standardHeaders: true,
    legacyHeaders: false,
    validate: false,
    message: { message: 'Too many requests, please try again later.' },
    keyGenerator: (req) => {
        const forwarded = req.headers['x-forwarded-for'];
        const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : '') || req.socket?.remoteAddress || 'unknown';
        return ip;
    },
});

/** Auth endpoint rate limiter: 10 requests per 15 minutes per IP */
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    validate: false,
    message: { message: 'Too many authentication attempts. Please try again in 15 minutes.' },
    keyGenerator: (req) => {
        const forwarded = req.headers['x-forwarded-for'];
        const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : '') || req.socket?.remoteAddress || 'unknown';
        const email = req.body?.email || '';
        return `${ip}:${email}`;
    },
});

/** OTP rate limiter: 5 requests per 15 minutes per IP */
export const otpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    validate: false,
    message: { message: 'Too many OTP requests. Please try again in 15 minutes.' },
    keyGenerator: (req) => {
        const forwarded = req.headers['x-forwarded-for'];
        const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : '') || req.socket?.remoteAddress || 'unknown';
        return ip;
    },
});

// ═══════════════════════════════════════════════════════
// UUID Parameter Validator
// ═══════════════════════════════════════════════════════
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Middleware to validate that specified route params are valid UUIDs.
 * Prevents SQL errors and potential injection via malformed IDs.
 */
export const validateUuidParams = (...paramNames: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        for (const param of paramNames) {
            const raw = req.params[param];
            const value = Array.isArray(raw) ? raw[0] : raw;
            if (value && !UUID_REGEX.test(value)) {
                return res.status(400).json({ message: `Invalid ${param} format` });
            }
        }
        next();
    };
};

// ═══════════════════════════════════════════════════════
// Brute-Force Protection — Database-Backed Lockout
// ═══════════════════════════════════════════════════════
import pool from '../config/db';

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

// ─── Self-healing table guard ───
// The locked_accounts table is created by initDb, but on servers where the
// migration hasn't run the lockout queries would silently fail-open and the
// whole feature appears broken. We lazily ensure the table exists on first use.
const LOCKED_ACCOUNTS_DDL = `
  CREATE TABLE IF NOT EXISTS locked_accounts (
    identifier VARCHAR(255) PRIMARY KEY,
    attempt_count INT DEFAULT 0,
    locked_until TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
`;

let lockedTableEnsured = false;
async function ensureLockedAccountsTable(): Promise<void> {
    if (lockedTableEnsured) return;
    await pool.query(LOCKED_ACCOUNTS_DDL);
    lockedTableEnsured = true;
}

/** Check if an account is locked. Returns seconds remaining if locked, 0 if not. */
export async function checkBruteForce(identifier: string): Promise<number> {
    const key = identifier.toLowerCase();
    try {
        await ensureLockedAccountsTable();
        const result = await pool.query(
            `SELECT locked_until FROM locked_accounts WHERE identifier = $1 AND locked_until > NOW()`,
            [key]
        );
        if (result.rows.length > 0) {
            const lockedUntil = new Date(result.rows[0].locked_until).getTime();
            return Math.ceil((lockedUntil - Date.now()) / 1000);
        }
        return 0;
    } catch (err) {
        console.error('[Security] checkBruteForce DB error:', err);
        return 0; // Fail open — don't lock users out on DB error
    }
}

/** Record a failed login attempt. Returns true if account is now locked. */
export async function recordFailedLogin(identifier: string): Promise<boolean> {
    const key = identifier.toLowerCase();
    try {
        await ensureLockedAccountsTable();
        // If a previous lock has already expired, restart the counter at 1 so a
        // single post-expiry mistake doesn't immediately re-lock the account.
        const result = await pool.query(
            `INSERT INTO locked_accounts (identifier, attempt_count, locked_until)
             VALUES ($1, 1, NULL)
             ON CONFLICT (identifier) DO UPDATE
             SET attempt_count = CASE
                     WHEN locked_accounts.locked_until IS NOT NULL AND locked_accounts.locked_until < NOW()
                     THEN 1
                     ELSE locked_accounts.attempt_count + 1
                 END,
                 locked_until = CASE
                     WHEN locked_accounts.locked_until IS NOT NULL AND locked_accounts.locked_until < NOW()
                     THEN NULL
                     ELSE locked_accounts.locked_until
                 END,
                 updated_at = NOW()
             RETURNING attempt_count`,
            [key]
        );
        const count = result.rows[0].attempt_count;
        if (count >= MAX_ATTEMPTS) {
            const lockedUntil = new Date(Date.now() + LOCKOUT_MS);
            await pool.query(
                `UPDATE locked_accounts SET locked_until = $1 WHERE identifier = $2`,
                [lockedUntil, key]
            );
            return true;
        }
        return false;
    } catch (err) {
        console.error('[Security] recordFailedLogin DB error:', err);
        return false;
    }
}

/** Clear failed login attempts on successful login */
export async function clearFailedLogins(identifier: string): Promise<void> {
    const key = identifier.toLowerCase();
    try {
        await ensureLockedAccountsTable();
        await pool.query(`DELETE FROM locked_accounts WHERE identifier = $1`, [key]);
    } catch (err) {
        console.error('[Security] clearFailedLogins DB error:', err);
    }
}

/** Unlock a specific locked account. Returns true if an account was unlocked. */
export async function unlockAccount(identifier: string): Promise<boolean> {
    const key = identifier.toLowerCase();
    try {
        await ensureLockedAccountsTable();
        const result = await pool.query(
            `DELETE FROM locked_accounts WHERE identifier = $1 RETURNING identifier`,
            [key]
        );
        return (result.rowCount ?? 0) > 0;
    } catch (err) {
        console.error('[Security] unlockAccount DB error:', err);
        return false;
    }
}

/** Get all currently locked accounts with their lock expiry times. */
export async function getLockedAccounts(): Promise<{ email: string; lockedUntil: Date; remainingSeconds: number }[]> {
    try {
        await ensureLockedAccountsTable();
        const result = await pool.query(
            `SELECT identifier, locked_until FROM locked_accounts WHERE locked_until > NOW() ORDER BY locked_until DESC`
        );
        const now = Date.now();
        return result.rows.map((row: any) => ({
            email: row.identifier,
            lockedUntil: new Date(row.locked_until),
            remainingSeconds: Math.ceil((new Date(row.locked_until).getTime() - now) / 1000),
        }));
    } catch (err) {
        console.error('[Security] getLockedAccounts DB error:', err);
        return [];
    }
}
