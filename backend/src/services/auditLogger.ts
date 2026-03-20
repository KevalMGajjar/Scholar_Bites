import pool from '../config/db';

export type AuditAction =
    | 'LOGIN_SUCCESS' | 'LOGIN_FAILED' | 'LOGIN_LOCKED'
    | 'LOGOUT'
    | 'PASSWORD_CHANGE' | 'OTP_REQUESTED'
    | 'STAFF_CREATED' | 'STAFF_DELETED'
    | 'MENU_CREATED' | 'MENU_UPDATED' | 'MENU_DELETED'
    | 'RESTAURANT_CREATED' | 'RESTAURANT_UPDATED' | 'RESTAURANT_DELETED'
    | 'ORDER_STATUS_CHANGED' | 'ORDER_REFUNDED'
    | 'PAYMENT_VERIFIED' | 'WALLET_TOPUP' | 'WALLET_PAYMENT'
    | 'UNIVERSITY_UPDATED';

interface AuditEntry {
    userId?: string;
    action: AuditAction;
    resource?: string;       // e.g. 'staff:uuid', 'order:uuid'
    details?: string;        // additional context
    ip?: string;
}

/**
 * Log a security-relevant action to the audit_logs table.
 * Fire-and-forget — never blocks the request.
 */
export async function auditLog(entry: AuditEntry): Promise<void> {
    try {
        await pool.query(
            `INSERT INTO audit_logs (user_id, action, resource, details, ip_address)
             VALUES ($1, $2, $3, $4, $5)`,
            [entry.userId || null, entry.action, entry.resource || null, entry.details || null, entry.ip || null]
        );
    } catch (err) {
        // Never let audit logging crash the app
        console.error('[AUDIT] Failed to write audit log:', err);
    }
}

/**
 * Extract IP from request (supports proxies)
 */
export function getRequestIp(req: any): string {
    return (req.headers?.['x-forwarded-for'] as string)?.split(',')[0]?.trim()
        || req.ip
        || req.connection?.remoteAddress
        || 'unknown';
}
