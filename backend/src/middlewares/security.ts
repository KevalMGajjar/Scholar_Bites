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
    message: { message: 'Too many requests, please try again later.' }
    // Removed custom keyGenerator so express-rate-limit uses its default secure IP handling
});

/** Auth endpoint rate limiter: 10 requests per 15 minutes per IP */
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many authentication attempts. Please try again in 15 minutes.' },
    keyGenerator: (req) => {
        // Rate limit by IP + email (if provided) to prevent distributed attacks
        // Using req.socket.remoteAddress to avoid ERR_ERL_KEY_GEN_IPV6 validation error
        const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
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
    message: { message: 'Too many OTP requests. Please try again in 15 minutes.' },
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
// Brute-Force Protection — Failed Login Tracking
// ═══════════════════════════════════════════════════════
const loginAttempts = new Map<string, { count: number; lockedUntil: number }>();

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

/** Check if an account is locked. Returns seconds remaining if locked, 0 if not. */
export function checkBruteForce(identifier: string): number {
    const record = loginAttempts.get(identifier);
    if (!record) return 0;
    if (record.lockedUntil > Date.now()) {
        return Math.ceil((record.lockedUntil - Date.now()) / 1000);
    }
    // Lock expired — reset
    if (record.lockedUntil > 0 && record.lockedUntil <= Date.now()) {
        loginAttempts.delete(identifier);
    }
    return 0;
}

/** Record a failed login attempt. Returns true if account is now locked. */
export function recordFailedLogin(identifier: string): boolean {
    const record = loginAttempts.get(identifier) || { count: 0, lockedUntil: 0 };
    record.count += 1;
    if (record.count >= MAX_ATTEMPTS) {
        record.lockedUntil = Date.now() + LOCKOUT_MS;
        loginAttempts.set(identifier, record);
        return true;
    }
    loginAttempts.set(identifier, record);
    return false;
}

/** Clear failed login attempts on successful login */
export function clearFailedLogins(identifier: string): void {
    loginAttempts.delete(identifier);
}

// Clean up expired entries every 30 minutes
setInterval(() => {
    const now = Date.now();
    for (const [key, val] of loginAttempts.entries()) {
        if (val.lockedUntil > 0 && val.lockedUntil <= now) {
            loginAttempts.delete(key);
        }
    }
}, 30 * 60 * 1000);
