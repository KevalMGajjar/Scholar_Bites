import { Request, Response } from 'express';
import pool from '../config/db';
import { AuthRequest } from '../middlewares/authMiddleware';
import { sendPush } from '../config/firebaseAdmin';

// ─── Canonical Notification Type Constants ───
// Keep these in sync with frontend filter types in notifications_screen.dart
export const NOTIF_TYPES = {
    ITEM_AVAILABLE: 'item_available',
    RESTAURANT_OPEN: 'restaurant_open',
    RESTAURANT_CLOSING_SOON: 'restaurant_closing_soon',
    CART_REMINDER: 'cart_reminder',
    ORDER_READY: 'order_ready',
    REFUND: 'refund',
} as const;

// ─── Gen-Z Notification Copy Templates ───
const NOTIF_COPY = {
    item_available: {
        title: "it's BACK 🔥",
        body: (itemName: string) =>
            `${itemName} just dropped back on the menu — go grab it before it's gone fr fr`,
    },
    restaurant_open: {
        title: (restaurantName: string) => `${restaurantName} is OPEN 🤌`,
        body: `the vibes are immaculate rn, get your order in bestie`,
    },
    restaurant_closing_soon: {
        title: 'LAST CALL 💨',
        body: (restaurantName: string) =>
            `${restaurantName} closes in 15 mins!! don't be the one who missed out`,
    },
    cart_reminder: {
        title: 'your cart misses you 😭',
        body: (itemName: string) =>
            `${itemName} and the squad have been waiting — they might sell out ngl`,
    },
    order_ready: {
        title: 'Your Order is Ready! 🍔',
        body: (orderToken: string) =>
            `Your order #${orderToken} is freshly prepared and ready for pickup at the counter!`,
    },
    refund: {
        title: 'Refund Credited! 💰',
        body: (amount: string, orderToken: string) =>
            `₹${amount} has been refunded to your wallet for Order #${orderToken}.`,
    },
};

// ─── Internal: Create notification + push ───
export const createAndPush = async (
    userId: string,
    type: string,
    title: string,
    body: string,
    data: Record<string, any> = {},
    dedupeInterval?: string // e.g. '24 hours'
) => {
    try {
        let insertedId: string | null = null;
        
        // ─── Atomic Deduplication ───
        // If a dedupe_key is provided along with an interval, we do an atomic
        // INSERT ... SELECT ... WHERE NOT EXISTS to guarantee thread safety.
        if (data.dedupe_key && dedupeInterval) {
            const insertQuery = `
                INSERT INTO notifications (user_id, type, title, body, data)
                SELECT $1::uuid, $2::varchar, $3::varchar, $4::text, $5::jsonb
                WHERE NOT EXISTS (
                    SELECT 1 FROM notifications
                    WHERE user_id = $1::uuid 
                      AND data->>'dedupe_key' = $6::text
                      AND created_at > NOW() - INTERVAL '${dedupeInterval}'
                )
                RETURNING id;
            `;
            const result = await pool.query(insertQuery, [
                userId, type, title, body, JSON.stringify(data), data.dedupe_key
            ]);
            
            if (result.rows.length === 0) {
                // Was not inserted because a duplicate already exists in the time window
                return;
            }
            insertedId = result.rows[0].id;
        } else {
            // Standard unconditional insert
            const result = await pool.query(
                `INSERT INTO notifications (user_id, type, title, body, data)
                 VALUES ($1, $2, $3, $4, $5) RETURNING id`,
                [userId, type, title, body, JSON.stringify(data)]
            );
            insertedId = result.rows[0].id;
        }

        // Send FCM push only if successfully inserted (wasn't deduped)
        if (insertedId) {
            const tokenRes = await pool.query(
                'SELECT fcm_token FROM users WHERE id = $1',
                [userId]
            );
            const fcmToken = tokenRes.rows[0]?.fcm_token;
            if (fcmToken) {
                const stringData: Record<string, string> = {};
                for (const [k, v] of Object.entries(data)) {
                    stringData[k] = String(v);
                }
                stringData['type'] = type;
                await sendPush(fcmToken, title, body, stringData);
            }
        }
    } catch (error) {
        console.error('createAndPush error:', error);
    }
};

// ─── Bulk: Notify all users in a university ───
export const notifyUniversityUsers = async (
    universityId: string,
    type: string,
    title: string,
    body: string,
    data: Record<string, any> = {},
    dedupeKey?: string
) => {
    try {
        const usersRes = await pool.query(
            'SELECT id FROM users WHERE university_id = $1',
            [universityId]
        );

        for (const user of usersRes.rows) {
            const notifData = dedupeKey ? { ...data, dedupe_key: dedupeKey } : data;
            
            // Due to the new Atomic Deduplication in createAndPush, we no longer need a 
            // separate, race-condition-vulnerable SELECT query here!
            await createAndPush(
                user.id, 
                type, 
                title, 
                body, 
                notifData, 
                dedupeKey ? '24 hours' : undefined
            );
        }
    } catch (error) {
        console.error('notifyUniversityUsers error:', error);
    }
};

// ─── GET /notifications ───
export const getNotifications = async (req: AuthRequest, res: Response) => {
    const userId = req.user.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 30;
    const offset = (page - 1) * limit;

    try {
        const result = await pool.query(
            `SELECT id, type, title, body, data, is_read, created_at
             FROM notifications
             WHERE user_id = $1
             ORDER BY created_at DESC
             LIMIT $2 OFFSET $3`,
            [userId, limit, offset]
        );

        const countRes = await pool.query(
            'SELECT COUNT(*) FROM notifications WHERE user_id = $1',
            [userId]
        );

        res.json({
            notifications: result.rows,
            total: parseInt(countRes.rows[0].count),
            page,
            limit,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// ─── GET /notifications/unread-count ───
export const getUnreadCount = async (req: AuthRequest, res: Response) => {
    const userId = req.user.id;

    try {
        const result = await pool.query(
            'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false',
            [userId]
        );
        res.json({ count: parseInt(result.rows[0].count) });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// ─── POST /notifications/:id/read ───
export const markAsRead = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
        await pool.query(
            'UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2',
            [id, userId]
        );
        res.json({ message: 'Marked as read' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// ─── POST /notifications/read-all ───
export const markAllAsRead = async (req: AuthRequest, res: Response) => {
    const userId = req.user.id;

    try {
        await pool.query(
            'UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false',
            [userId]
        );
        res.json({ message: 'All marked as read' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// ─── POST /notifications/register-token ───
export const registerFcmToken = async (req: AuthRequest, res: Response) => {
    const userId = req.user.id;
    const { fcm_token } = req.body;

    if (!fcm_token) return res.status(400).json({ message: 'fcm_token required' });

    try {
        await pool.query(
            'UPDATE users SET fcm_token = $1 WHERE id = $2',
            [fcm_token, userId]
        );
        res.json({ message: 'Token registered' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// ─── Trigger: Item becomes available ───
export const triggerItemAvailable = async (itemId: string, itemName: string) => {
    try {
        const itemRes = await pool.query(
            `SELECT mi.id, mi.name, r.university_id 
             FROM menu_items mi 
             JOIN restaurants r ON mi.restaurant_id = r.id 
             WHERE mi.id = $1`,
            [itemId]
        );
        if (itemRes.rows.length === 0) return;

        const { university_id } = itemRes.rows[0];
        const name = itemName || itemRes.rows[0].name;

        await notifyUniversityUsers(
            university_id,
            NOTIF_TYPES.ITEM_AVAILABLE,
            NOTIF_COPY.item_available.title,
            NOTIF_COPY.item_available.body(name),
            { item_id: itemId, item_name: name },
            `item_available_${itemId}`
        );
    } catch (error) {
        console.error('triggerItemAvailable error:', error);
    }
};

// ─── Trigger: Restaurant opens ───
export const triggerRestaurantOpen = async (restaurantId: string) => {
    try {
        const restRes = await pool.query(
            'SELECT name, university_id FROM restaurants WHERE id = $1',
            [restaurantId]
        );
        if (restRes.rows.length === 0) return;

        const { name, university_id } = restRes.rows[0];

        await notifyUniversityUsers(
            university_id,
            NOTIF_TYPES.RESTAURANT_OPEN,
            NOTIF_COPY.restaurant_open.title(name),
            NOTIF_COPY.restaurant_open.body,
            { restaurant_id: restaurantId, restaurant_name: name },
            `restaurant_open_${restaurantId}`
        );
    } catch (error) {
        console.error('triggerRestaurantOpen error:', error);
    }
};

// ─── Trigger: Restaurant closing soon ───
export const triggerRestaurantClosingSoon = async (
    restaurantId: string,
    restaurantName: string,
    universityId: string,
    minutesLeft: number = 15
) => {
    try {
        const dedupeKey = `closing_soon_${restaurantId}`;
        await notifyUniversityUsers(
            universityId,
            NOTIF_TYPES.RESTAURANT_CLOSING_SOON,
            NOTIF_COPY.restaurant_closing_soon.title,
            NOTIF_COPY.restaurant_closing_soon.body(restaurantName),
            { restaurant_id: restaurantId, restaurant_name: restaurantName },
            dedupeKey
        );
    } catch (error) {
        console.error('triggerRestaurantClosingSoon error:', error);
    }
};

// ─── Trigger: Order ready for pickup ───
export const triggerOrderReady = async (
    userId: string,
    orderId: string,
    orderToken: string,
    totalAmount: string
) => {
    try {
        await createAndPush(
            userId,
            NOTIF_TYPES.ORDER_READY,
            NOTIF_COPY.order_ready.title,
            NOTIF_COPY.order_ready.body(orderToken),
            {
                order_id: orderId,
                type: NOTIF_TYPES.ORDER_READY,
                order_token: orderToken,
                amount: totalAmount,
            }
        );
    } catch (error) {
        console.error('triggerOrderReady error:', error);
    }
};

// ─── Trigger: Refund credited ───
export const triggerRefund = async (
    userId: string,
    orderId: string,
    orderToken: string,
    refundAmount: number
) => {
    try {
        await createAndPush(
            userId,
            NOTIF_TYPES.REFUND,
            NOTIF_COPY.refund.title,
            NOTIF_COPY.refund.body(refundAmount.toFixed(0), orderToken),
            { order_id: orderId, type: NOTIF_TYPES.REFUND, amount: String(refundAmount) }
        );
    } catch (error) {
        console.error('triggerRefund error:', error);
    }
};

export { NOTIF_COPY };
