import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import pool from '../config/db';
import razorpay from '../config/razorpay';
import admin from '../config/firebaseAdmin';
import { verifySmtp } from '../services/emailService';
import { auditLog, getRequestIp } from '../services/auditLogger';
import { notifyUniversityUsers, triggerRefund } from './notificationController';
import { AHMEDABAD_UNIVERSITY_ID } from '../config/constants';

// ═══════════════════════════════════════════════════════════════
// System Operations — Super Admin "fix-it-fast" tooling
// ═══════════════════════════════════════════════════════════════

type HealthStatus = 'ok' | 'down' | 'not_configured';
interface ServiceResult {
    service: string;
    status: HealthStatus;
    detail: string;
    latencyMs: number;
}

/** Run a check with a hard timeout so a hung dependency can't stall the page. */
async function runCheck(
    service: string,
    notConfigured: boolean,
    fn: () => Promise<string>,
    timeoutMs = 5000
): Promise<ServiceResult> {
    if (notConfigured) {
        return { service, status: 'not_configured', detail: 'Credentials not set on server', latencyMs: 0 };
    }
    const start = Date.now();
    try {
        const detail = await Promise.race([
            fn(),
            new Promise<string>((_, reject) => setTimeout(() => reject(new Error('Timed out')), timeoutMs)),
        ]);
        return { service, status: 'ok', detail: detail || 'OK', latencyMs: Date.now() - start };
    } catch (err: any) {
        return { service, status: 'down', detail: err?.message || 'Check failed', latencyMs: Date.now() - start };
    }
}

/** GET /api/superadmin/service-health — live status of critical dependencies */
export const getServiceHealth = async (_req: Request, res: Response) => {
    const uploadDir = path.resolve(__dirname, '../../uploads');

    const checks = await Promise.all([
        // Database
        runCheck('Database', false, async () => {
            await pool.query('SELECT 1');
            return 'Connected';
        }),
        // SMTP / Email
        runCheck('Email (SMTP)', !process.env.SMTP_USER || !process.env.SMTP_PASS, async () => {
            await verifySmtp();
            return `Verified via ${process.env.SMTP_HOST || 'smtp.gmail.com'}`;
        }),
        // Local file storage (image uploads)
        runCheck('File Storage', false, async () => {
            if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
            const probe = path.join(uploadDir, `.healthcheck_${Date.now()}`);
            fs.writeFileSync(probe, 'ok');
            fs.unlinkSync(probe);
            return 'Uploads directory writable';
        }),
        // Razorpay payments
        runCheck(
            'Payments (Razorpay)',
            !process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET,
            async () => {
                await razorpay.orders.all({ count: 1 });
                return 'API reachable & keys valid';
            }
        ),
        // Firebase push
        runCheck('Push (Firebase)', false, async () => {
            if (!admin.apps.length) throw new Error('firebase-service-account.json missing or invalid');
            return `Initialized (${admin.apps.length} app)`;
        }),
    ]);

    const overall = checks.some(c => c.status === 'down') ? 'degraded' : 'healthy';
    res.json({ overall, checkedAt: new Date().toISOString(), services: checks });
};

/** GET /api/superadmin/stuck-orders?minutes=30 — orders hung in pending/preparing */
export const getStuckOrders = async (req: Request, res: Response) => {
    const minutes = Math.max(1, Math.min(parseInt(req.query.minutes as string) || 30, 1440));
    try {
        const result = await pool.query(
            `SELECT o.id, o.order_token, o.status, o.total_amount, o.payment_id, o.created_at,
                    o.user_id, u.name AS user_name, u.phone AS user_phone,
                    r.name AS restaurant_name,
                    ROUND(EXTRACT(EPOCH FROM (NOW() - o.created_at)) / 60)::int AS minutes_stuck
             FROM orders o
             LEFT JOIN users u ON o.user_id = u.id
             LEFT JOIN restaurants r ON o.restaurant_id = r.id
             WHERE o.status IN ('pending', 'preparing')
               AND o.created_at < NOW() - (INTERVAL '1 minute' * $1)
             ORDER BY o.created_at ASC`,
            [minutes]
        );
        res.json({ threshold_minutes: minutes, orders: result.rows });
    } catch (err: any) {
        console.error('[SystemOps] getStuckOrders error:', err.message);
        res.status(500).json({ message: 'Server error' });
    }
};

/** POST /api/superadmin/stuck-orders/:id/resolve — force-complete or cancel+refund */
export const resolveStuckOrder = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { action } = req.body as { action: 'complete' | 'cancel_refund' };
    const caller = (req as any).user;
    const ip = getRequestIp(req);

    if (!['complete', 'cancel_refund'].includes(action)) {
        return res.status(400).json({ message: "action must be 'complete' or 'cancel_refund'" });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const orderRes = await client.query(
            'SELECT id, status, user_id, total_amount, order_token FROM orders WHERE id = $1 FOR UPDATE',
            [id]
        );
        const order = orderRes.rows[0];
        if (!order) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Order not found' });
        }
        if (!['pending', 'preparing'].includes(order.status)) {
            await client.query('ROLLBACK');
            return res.status(409).json({ message: `Order is already '${order.status}', nothing to resolve.` });
        }

        let refundedAmount = 0;

        if (action === 'complete') {
            await client.query("UPDATE orders SET status = 'completed', updated_at = NOW() WHERE id = $1", [id]);
        } else {
            // cancel + refund. 'preparing' orders had stock decremented & were paid — restore stock.
            if (order.status === 'preparing') {
                const itemsRes = await client.query('SELECT menu_item_id, quantity FROM order_items WHERE order_id = $1', [id]);
                const sorted = itemsRes.rows.sort((a: any, b: any) => a.menu_item_id.localeCompare(b.menu_item_id));
                for (const item of sorted) {
                    await client.query('SELECT id FROM menu_items WHERE id = $1 FOR UPDATE', [item.menu_item_id]);
                    await client.query('UPDATE menu_items SET stock_quantity = stock_quantity + $1 WHERE id = $2', [item.quantity, item.menu_item_id]);
                }
            }

            await client.query("UPDATE orders SET status = 'cancelled', updated_at = NOW() WHERE id = $1", [id]);

            refundedAmount = Number(order.total_amount);
            await client.query('UPDATE users SET wallet_balance = wallet_balance + $1 WHERE id = $2', [refundedAmount, order.user_id]);
            await client.query(
                `INSERT INTO wallet_transactions (user_id, amount, type, description, reference_id)
                 VALUES ($1, $2, 'refund', $3, $4)`,
                [order.user_id, refundedAmount, 'Super-admin resolved stuck order', order.id]
            );
        }

        await client.query('COMMIT');

        auditLog({
            userId: caller?.id,
            action: 'ORDER_FORCE_RESOLVED',
            resource: `order:${id}`,
            details: action === 'complete'
                ? `Force-completed stuck order (was ${order.status})`
                : `Cancelled & refunded ₹${refundedAmount} (was ${order.status})`,
            ip,
        });

        if (action === 'cancel_refund' && refundedAmount > 0) {
            triggerRefund(order.user_id, String(id), String(order.order_token || String(id).split('-')[0]), refundedAmount)
                .catch(e => console.error('[SystemOps] refund notify failed:', e.message));
        }

        res.json({
            message: action === 'complete'
                ? 'Order marked as completed.'
                : `Order cancelled and ₹${refundedAmount} refunded to the customer's wallet.`,
            refunded_amount: refundedAmount,
        });
    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error('[SystemOps] resolveStuckOrder error:', err.message);
        res.status(500).json({ message: 'Server error' });
    } finally {
        client.release();
    }
};

/** POST /api/superadmin/broadcast — push an announcement to every app user */
export const sendBroadcast = async (req: Request, res: Response) => {
    const { title, body } = req.body as { title?: string; body?: string };
    const caller = (req as any).user;
    const ip = getRequestIp(req);

    if (!title?.trim() || !body?.trim()) {
        return res.status(400).json({ message: 'Both title and body are required.' });
    }
    if (title.length > 120 || body.length > 500) {
        return res.status(400).json({ message: 'Title must be ≤120 and body ≤500 characters.' });
    }

    try {
        // Unique dedupe key per send so identical messages are never suppressed.
        const dedupeKey = `broadcast_${Date.now()}`;
        await notifyUniversityUsers(
            AHMEDABAD_UNIVERSITY_ID,
            'announcement',
            title.trim(),
            body.trim(),
            { source: 'super_admin' },
            dedupeKey
        );

        auditLog({
            userId: caller?.id,
            action: 'BROADCAST_SENT',
            resource: `university:${AHMEDABAD_UNIVERSITY_ID}`,
            details: `"${title.trim()}"`,
            ip,
        });

        res.json({ message: 'Broadcast sent to all app users.' });
    } catch (err: any) {
        console.error('[SystemOps] sendBroadcast error:', err.message);
        res.status(500).json({ message: 'Server error' });
    }
};
