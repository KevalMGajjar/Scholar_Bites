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
// ALL notifications are deduplicated atomically via INSERT ... WHERE NOT EXISTS.
// If no dedupe_key is provided, one is auto-generated from type + context data.
export const createAndPush = async (
    userId: string,
    type: string,
    title: string,
    body: string,
    data: Record<string, any> = {},
    dedupeInterval: string = '5 minutes' // default: suppress exact-same notification for 5 min
) => {
    console.log(`[DEBUG createAndPush] userId=${userId}, type=${type}, title="${title}"`);
    try {
        const dedupeKey = data.dedupe_key
            || `${type}_${data.order_id || data.restaurant_id || data.item_id || userId}`;

        const notifData = { ...data, dedupe_key: dedupeKey };

        console.log(`[DEBUG createAndPush] dedupeKey="${dedupeKey}", interval=${dedupeInterval}`);

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
            userId, type, title, body, JSON.stringify(notifData), dedupeKey
        ]);

        if (result.rows.length === 0) {
            console.log(`[DEBUG createAndPush] ⏭️ Deduped — same key "${dedupeKey}" sent within ${dedupeInterval}`);
            return;
        }

        console.log(`[DEBUG createAndPush] ✅ Notification inserted id=${result.rows[0].id}`);

        // Send FCM push only if successfully inserted (wasn't deduped)
        const tokenRes = await pool.query(
            'SELECT fcm_token FROM users WHERE id = $1',
            [userId]
        );
        const fcmToken = tokenRes.rows[0]?.fcm_token;
        if (fcmToken) {
            console.log(`[DEBUG createAndPush] 📱 Sending FCM push to token=${fcmToken.substring(0, 20)}...`);
            const stringData: Record<string, string> = {};
            for (const [k, v] of Object.entries(notifData)) {
                stringData[k] = String(v);
            }
            stringData['type'] = type;
            await sendPush(fcmToken, title, body, stringData);
            console.log(`[DEBUG createAndPush] ✅ FCM push sent`);
        } else {
            console.log(`[DEBUG createAndPush] ⚠️ No FCM token for user ${userId} — notification saved in DB only`);
        }
    } catch (error) {
        console.error('[createAndPush] error:', error);
    }
};

// ─── Bulk: Notify all users in a university ───
// Deduplicates by FCM token so the same physical device only gets ONE push,
// even if multiple user accounts share the same phone.
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
            'SELECT id, fcm_token FROM users WHERE university_id = $1',
            [universityId]
        );

        const pushedTokens = new Set<string>(); // Track tokens we've already sent to

        for (const user of usersRes.rows) {
            const notifData = dedupeKey ? { ...data, dedupe_key: dedupeKey } : data;

            // Always insert to DB (each user gets their own notification row)
            const dedupeKeyFinal = notifData.dedupe_key
                || `${type}_${data.restaurant_id || data.item_id || user.id}`;
            const dbData = { ...notifData, dedupe_key: dedupeKeyFinal };

            const insertQuery = `
                INSERT INTO notifications (user_id, type, title, body, data)
                SELECT $1::uuid, $2::varchar, $3::varchar, $4::text, $5::jsonb
                WHERE NOT EXISTS (
                    SELECT 1 FROM notifications
                    WHERE user_id = $1::uuid 
                      AND data->>'dedupe_key' = $6::text
                      AND created_at > NOW() - INTERVAL '24 hours'
                )
                RETURNING id;
            `;
            const result = await pool.query(insertQuery, [
                user.id, type, title, body, JSON.stringify(dbData), dedupeKeyFinal
            ]);

            // Only send FCM push if:
            // 1. The DB row was actually inserted (not deduped)
            // 2. We haven't already pushed to this FCM token (same device)
            if (result.rows.length > 0 && user.fcm_token && !pushedTokens.has(user.fcm_token)) {
                pushedTokens.add(user.fcm_token);
                const stringData: Record<string, string> = {};
                for (const [k, v] of Object.entries(dbData)) {
                    stringData[k] = String(v);
                }
                stringData['type'] = type;
                await sendPush(user.fcm_token, title, body, stringData);
            }
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
// 1. Tries targeted delivery to users who favorited this item.
// 2. Falls back to university-wide broadcast if nobody has favorited it
//    (or if user_favorites isn't populated yet).
export const triggerItemAvailable = async (itemId: string, itemName: string) => {
    try {
        // 1. Resolve item details — LEFT JOIN because restaurant_id may be NULL
        //    on legacy items that only have university_id directly.
        const itemRes = await pool.query(
            `SELECT mi.id,
                    mi.name,
                    COALESCE(r.university_id, mi.university_id) AS university_id
             FROM menu_items mi
             LEFT JOIN restaurants r ON mi.restaurant_id = r.id
             WHERE mi.id = $1`,
            [itemId]
        );

        if (itemRes.rows.length === 0) {
            console.warn(`[Notif] triggerItemAvailable: item ${itemId} not found in DB — skipping.`);
            return;
        }

        const { university_id } = itemRes.rows[0];
        const name = itemName || itemRes.rows[0].name;

        // 2. Try targeted: find users who favorited this specific item
        let favUsersRows: any[] = [];
        try {
            const favUsersRes = await pool.query(
                `SELECT uf.user_id, u.fcm_token
                 FROM user_favorites uf
                 JOIN users u ON uf.user_id = u.id
                 WHERE uf.menu_item_id = $1`,
                [itemId]
            );
            favUsersRows = favUsersRes.rows;
        } catch (favError: any) {
            // user_favorites table may not exist on older deployments — fall through to broadcast
            console.warn(`[Notif] user_favorites query failed (table may not exist): ${favError.message}`);
        }

        if (favUsersRows.length > 0) {
            // ─── Targeted path: notify only fans ───
            console.log(`[Notif] 🔔 Item "${name}" is back → notifying ${favUsersRows.length} fan(s).`);

            for (const user of favUsersRows) {
                await createAndPush(
                    user.user_id,
                    NOTIF_TYPES.ITEM_AVAILABLE,
                    NOTIF_COPY.item_available.title,
                    NOTIF_COPY.item_available.body(name),
                    { item_id: itemId, item_name: name },
                    '24 hours'
                );
            }
        } else if (university_id) {
            // ─── Fallback: broadcast to all users in the university ───
            console.log(`[Notif] 🔔 Item "${name}" is back — no specific fans, broadcasting to university.`);

            await notifyUniversityUsers(
                university_id,
                NOTIF_TYPES.ITEM_AVAILABLE,
                NOTIF_COPY.item_available.title,
                NOTIF_COPY.item_available.body(name),
                { item_id: itemId, item_name: name },
                `item_available_${itemId}`
            );
        } else {
            console.warn(`[Notif] Item "${name}" has no university_id — cannot send notification.`);
        }
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
