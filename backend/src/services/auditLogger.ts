import pool from '../config/db';

export type AuditAction =
    | 'LOGIN_SUCCESS' | 'LOGIN_FAILED' | 'LOGIN_LOCKED' | 'LOGIN_PANEL_DENIED'
    | 'LOGIN_OTP_SENT' | 'LOGIN_OTP_VERIFIED' | 'LOGIN_OTP_FAILED' | 'LOGIN_OTP_BURNED'
    | 'LOGIN_GOOGLE_SUCCESS' | 'LOGIN_GOOGLE_FAILED'
    | 'ACCOUNT_UNLOCKED'
    | 'LOGOUT'
    | 'PASSWORD_CHANGE' | 'OTP_REQUESTED'
    | 'STAFF_CREATED' | 'STAFF_DELETED' | 'STAFF_UPDATED'
    | 'MENU_CREATED' | 'MENU_UPDATED' | 'MENU_DELETED'
    | 'RESTAURANT_CREATED' | 'RESTAURANT_UPDATED' | 'RESTAURANT_DELETED'
    | 'ORDER_STATUS_CHANGED' | 'ORDER_REFUNDED' | 'ORDER_QR_SCANNED'
    | 'REFUND_REQUESTED' | 'REFUND_APPROVED' | 'REFUND_REJECTED'
    | 'PAYMENT_VERIFIED' | 'WALLET_TOPUP' | 'WALLET_PAYMENT'
    | 'UNIVERSITY_UPDATED'
    | 'STAFF_PRE_ORDER' | 'EVENT_PRE_ORDER' | 'COUPON_REDEEMED'
    | 'DEAN_CREATED' | 'DEAN_DELETED' | 'DEAN_BUDGET_UPDATED' | 'DEAN_UPDATED'
    | 'DEAN_LOGIN_SUCCESS' | 'DEAN_LOGIN_FAILED'
    | 'COUPON_GENERATED' | 'COUPON_REVOKED'
    | 'UNIVERSITY_STAFF_CREATED' | 'UNIVERSITY_STAFF_DELETED' | 'UNIVERSITY_STAFF_UPDATED'
    | 'EVENT_STATUS_UPDATED' | 'EVENT_PRE_ORDER_CANCELLED' | 'EVENT_PRE_ORDER_PAID'
    | 'BROADCAST_SENT' | 'ORDER_FORCE_RESOLVED';

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
