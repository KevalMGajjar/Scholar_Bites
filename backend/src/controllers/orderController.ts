import { Request, Response } from 'express';
import pool from '../config/db';
import razorpay from '../config/razorpay';
import crypto from 'crypto';
import { AuthRequest } from '../middlewares/authMiddleware';
import { emitNewOrder, emitStatusUpdate } from '../services/socketService';
import { triggerOrderReady, triggerRefund } from './notificationController';
import { auditLog, getRequestIp } from '../services/auditLogger';

// ─── Restaurant Closing-Time Protection ───
const ORDER_CUTOFF_MINUTES = 5; // Block orders within 5 min of closing
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // UTC+5:30

/**
 * Server-side gate check: is the restaurant currently accepting orders?
 * Checks both the is_open flag AND the closing_time with cutoff buffer.
 * Returns { accepting: true } or { accepting: false, reason: string }.
 */
const checkRestaurantAcceptingOrders = async (
    client: any,
    restaurantId: string
): Promise<{ accepting: boolean; reason?: string; minutesLeft?: number }> => {
    const result = await client.query(
        'SELECT is_open, opening_time, closing_time, name FROM restaurants WHERE id = $1',
        [restaurantId]
    );
    if (result.rows.length === 0) {
        return { accepting: false, reason: 'Restaurant not found' };
    }
    const rest = result.rows[0];

    if (!rest.is_open) {
        return { accepting: false, reason: `${rest.name} is currently closed` };
    }

    if (rest.closing_time) {
        // Parse closing_time (stored as HH:mm:ss TIME) and compare with IST now
        const nowUTC = Date.now();
        const nowIST = new Date(nowUTC + IST_OFFSET_MS);
        const nowMin = nowIST.getUTCHours() * 60 + nowIST.getUTCMinutes();

        const closeParts = rest.closing_time.toString().split(':');
        const closeMin = parseInt(closeParts[0], 10) * 60 + parseInt(closeParts[1], 10);

        const minutesLeft = closeMin - nowMin;

        // If past closing time or within cutoff buffer
        if (minutesLeft <= 0) {
            return { accepting: false, reason: `${rest.name} has closed for today`, minutesLeft: 0 };
        }
        if (minutesLeft <= ORDER_CUTOFF_MINUTES) {
            return {
                accepting: false,
                reason: `${rest.name} closes in ${minutesLeft} minute${minutesLeft === 1 ? '' : 's'}. Orders are no longer accepted.`,
                minutesLeft,
            };
        }
    }

    return { accepting: true };
};

// ─── Generate a unique 4-char alphanumeric order token ───
const generateOrderToken = async (client: any): Promise<string> => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No 0/O/1/I to avoid confusion
    let attempts = 0;
    while (attempts < 20) {
        let token = '';
        for (let i = 0; i < 4; i++) {
            token += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        // Check uniqueness among active orders (not completed/cancelled)
        const existing = await client.query(
            "SELECT id FROM orders WHERE order_token = $1 AND status NOT IN ('completed', 'cancelled')",
            [token]
        );
        if (existing.rows.length === 0) return token;
        attempts++;
    }
    // Fallback: 6-char token if 4-char space is exhausted
    return crypto.randomBytes(3).toString('hex').toUpperCase();
};

export const createOrder = async (req: AuthRequest, res: Response) => {
    const { items, university_id } = req.body; // items: [{ menu_item_id, quantity }]
    const user_id = req.user.id;

    if (!items || items.length === 0) {
        return res.status(400).json({ message: 'No items provided' });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Calculate Total Amount and determine restaurant
        let totalAmount = 0;
        let restaurantId: string | null = null;
        const orderItemsData = [];

        // Sort items by menu_item_id to prevent deadlocks during concurrent orders
        const sortedItems = [...items].sort((a, b) => a.menu_item_id.localeCompare(b.menu_item_id));

        for (const item of sortedItems) {
            // Read-only availability check — stock is NOT decremented here.
            // Stock is only decremented after successful payment in verifyPayment/payOrderWithWallet.
            const result = await client.query('SELECT price, is_available, restaurant_id, stock_quantity, name FROM menu_items WHERE id = $1', [item.menu_item_id]);
            const menuItem = result.rows[0];

            if (!menuItem || !menuItem.is_available) {
                throw new Error(`Item ${item.menu_item_id} not available`);
            }

            if (menuItem.stock_quantity < item.quantity) {
                throw new Error(`Insufficient stock for item: ${menuItem.name}. Only ${menuItem.stock_quantity} left.`);
            }

            const price = parseFloat(menuItem.price);
            totalAmount += price * item.quantity;
            if (!restaurantId) restaurantId = menuItem.restaurant_id;
            orderItemsData.push({ ...item, price });

            // ⚠️ NO stock decrement here — user hasn't paid yet.
            // If we decrement now and user cancels Razorpay checkout,
            // the stock is lost until the 15-min cleanup runs.
        }

        if (!restaurantId) {
            throw new Error('Could not determine restaurant for order');
        }

        // ── Gate Check: Restaurant must be open and within operating hours ──
        const gateCheck = await checkRestaurantAcceptingOrders(client, restaurantId);
        if (!gateCheck.accepting) {
            throw new Error(gateCheck.reason || 'Restaurant is not accepting orders');
        }

        const amountInPaise = Math.round(totalAmount * 100);

        // 2. Create Razorpay Order
        let orderId = `mock_order_${crypto.randomBytes(4).toString('hex')}`;

        if (process.env.RAZORPAY_KEY_ID && !process.env.RAZORPAY_KEY_ID.includes('placeholder')) {
            const razorpayOrder = await razorpay.orders.create({
                amount: amountInPaise,
                currency: 'INR',
                receipt: `order_${Date.now()}`,
            });
            orderId = razorpayOrder.id;
            console.log(`✅ Razorpay order created: ${orderId}, amount: ${amountInPaise} paise`);
        } else if (process.env.NODE_ENV === 'production') {
            throw new Error('Payment gateway is not configured');
        }

        // 3. Create Database Order
        // Note: Using razorpay_order_id as payment_id initially

        // Generate unique pickup token
        const orderToken = await generateOrderToken(client);

        // Generate QR secret for rotating QR codes
        const qrSecret = crypto.randomBytes(32).toString('hex');

        const insertOrderQuery = `
            INSERT INTO orders (user_id, university_id, restaurant_id, status, total_amount, payment_id, order_token, qr_secret, qr_rotated_at)
            VALUES ($1, $2, $3, 'pending', $4, $5, $6, $7, NOW())
            RETURNING id, order_token
        `;
        const orderResult = await client.query(insertOrderQuery, [user_id, university_id, restaurantId, totalAmount, orderId, orderToken, qrSecret]);
        const dbOrderId = orderResult.rows[0].id;
        const dbOrderToken = orderResult.rows[0].order_token;

        // 4. Create Order Items
        for (const item of orderItemsData) {
            await client.query(
                'INSERT INTO order_items (order_id, menu_item_id, quantity, price_at_time) VALUES ($1, $2, $3, $4)',
                [dbOrderId, item.menu_item_id, item.quantity, item.price]
            );
        }

        // 5. Fetch restaurant name
        const restaurantResult = await client.query('SELECT name FROM restaurants WHERE id = $1', [restaurantId]);
        const restaurantName = restaurantResult.rows[0]?.name ?? 'Restaurant';

        await client.query('COMMIT');

        res.status(201).json({
            id: dbOrderId,
            payment_id: orderId, // Razorpay Order ID
            amount: totalAmount,
            amount_in_paise: amountInPaise,
            currency: 'INR',
            order_token: dbOrderToken,
            restaurant_name: restaurantName,
            items: orderItemsData
        });

    } catch (error: any) {
        await client.query('ROLLBACK');
        const msg = error.message || 'Server error';

        // Business-logic errors — these are expected client mistakes, NOT server bugs
        const isClientError = msg.includes('not available')
            || msg.includes('Insufficient stock')
            || msg.includes('closed')
            || msg.includes('no longer accepted')
            || msg.includes('Could not determine restaurant');

        if (isClientError) {
            console.warn(`[Order] Rejected: ${msg}`);
            return res.status(400).json({ message: msg });
        }

        // Genuine server error — log full stack for debugging
        console.error('[Order] createOrder error:', error);
        res.status(500).json({ message: 'Server error' });
    } finally {
        client.release();
    }
};

export const verifyPayment = async (req: AuthRequest, res: Response) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    try {
        let isValid = false;

        if (process.env.RAZORPAY_KEY_SECRET && !process.env.RAZORPAY_KEY_SECRET.includes('placeholder')) {
            const body = razorpay_order_id + "|" + razorpay_payment_id;
            const expectedSignature = crypto
                .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
                .update(body.toString())
                .digest('hex');
            isValid = (expectedSignature === razorpay_signature);
        } else if (process.env.NODE_ENV !== 'production') {
            // Mock environment check — ONLY allowed in development
            isValid = razorpay_order_id.startsWith('mock_') && razorpay_signature === 'mock_signature';
        }

        if (isValid) {
            // Payment confirmed — NOW we decrement stock (inside a transaction)
            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                // 1. Lock and fetch the order
                const orderRes = await client.query(
                    "SELECT * FROM orders WHERE payment_id = $1 AND status = 'pending' FOR UPDATE",
                    [razorpay_order_id]
                );

                if (orderRes.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ status: 'failure', message: 'Order not found or already processed' });
                }

                const order = orderRes.rows[0];

                // ── Gate Check: Re-verify restaurant is still open ──
                // Catches the race condition where user opened Razorpay before close and paid after.
                const gateCheck = await checkRestaurantAcceptingOrders(client, order.restaurant_id);
                if (!gateCheck.accepting) {
                    // Cancel the order
                    await client.query(
                        "UPDATE orders SET status = 'cancelled', updated_at = NOW() WHERE id = $1",
                        [order.id]
                    );
                    // Auto-refund to wallet
                    const refundAmount = Number(order.total_amount);
                    await client.query(
                        'UPDATE users SET wallet_balance = wallet_balance + $1 WHERE id = $2',
                        [refundAmount, order.user_id]
                    );
                    await client.query(
                        `INSERT INTO wallet_transactions (user_id, amount, type, description, reference_id)
                         VALUES ($1, $2, 'refund', $3, $4)`,
                        [order.user_id, refundAmount, `Auto-refund: ${gateCheck.reason}`, order.id]
                    );
                    await client.query('COMMIT');
                    console.log(`🔒 Order ${order.id} auto-cancelled & refunded ₹${refundAmount}: ${gateCheck.reason}`);
                    return res.status(409).json({
                        status: 'failure',
                        message: gateCheck.reason,
                        refunded: true,
                        refund_amount: refundAmount,
                    });
                }

                // 2. Fetch order items and decrement stock
                const itemsRes = await client.query(
                    'SELECT menu_item_id, quantity FROM order_items WHERE order_id = $1',
                    [order.id]
                );

                // Sort by menu_item_id to prevent deadlocks
                const sortedItems = itemsRes.rows.sort((a: any, b: any) =>
                    a.menu_item_id.localeCompare(b.menu_item_id)
                );

                for (const item of sortedItems) {
                    // Lock menu item row
                    const miRes = await client.query(
                        'SELECT stock_quantity, name, is_available FROM menu_items WHERE id = $1 FOR UPDATE',
                        [item.menu_item_id]
                    );
                    const mi = miRes.rows[0];

                    if (!mi || !mi.is_available) {
                        throw new Error(`Item ${mi?.name || item.menu_item_id} is no longer available`);
                    }
                    if (mi.stock_quantity < item.quantity) {
                        throw new Error(`Insufficient stock for ${mi.name}. Only ${mi.stock_quantity} left.`);
                    }

                    // Decrement stock
                    const newStock = mi.stock_quantity - item.quantity;
                    await client.query(
                        'UPDATE menu_items SET stock_quantity = stock_quantity - $1 WHERE id = $2',
                        [item.quantity, item.menu_item_id]
                    );

                    // Auto-disable item when stock runs out
                    if (newStock <= 0) {
                        await client.query('UPDATE menu_items SET is_available = false WHERE id = $1', [item.menu_item_id]);
                        console.log(`📦 Auto-disabled item ${mi.name} (stock exhausted)`);
                    }
                }

                // 3. Mark order as preparing
                await client.query(
                    "UPDATE orders SET status = 'preparing', updated_at = NOW() WHERE id = $1",
                    [order.id]
                );

                await client.query('COMMIT');

                // 4. Emit to Staff — fetch full order with joins
                const fullOrderRes = await pool.query(`
                    SELECT o.id, o.status, o.total_amount, o.payment_id, o.order_token,
                           o.created_at, o.updated_at, o.university_id,
                           u.name as user_name, u.phone as user_phone,
                           r.name as restaurant_name,
                           COALESCE(json_agg(
                               json_build_object(
                                   'id', oi.id,
                                   'menu_item_id', oi.menu_item_id,
                                   'quantity', oi.quantity,
                                   'price_at_time', oi.price_at_time,
                                   'item_name', mi.name,
                                   'item_image', mi.image_url
                               )
                           ) FILTER (WHERE oi.id IS NOT NULL), '[]') as items
                    FROM orders o
                    LEFT JOIN users u ON o.user_id = u.id
                    LEFT JOIN restaurants r ON o.restaurant_id = r.id
                    LEFT JOIN order_items oi ON oi.order_id = o.id
                    LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
                    WHERE o.id = $1
                    GROUP BY o.id, u.name, u.phone, r.name
                `, [order.id]);

                const fullOrder = fullOrderRes.rows[0] || order;
                emitNewOrder(order.university_id, fullOrder);

                res.json({ status: 'success', order: { ...order, status: 'preparing' } });
            } catch (stockError: any) {
                await client.query('ROLLBACK');
                console.warn(`[Order] verifyPayment stock conflict: ${stockError.message}`);
                // Payment was valid but stock check failed — order stays pending
                // TODO: Initiate Razorpay refund here in production
                res.status(409).json({ status: 'failure', message: stockError.message || 'Stock unavailable after payment' });
            } finally {
                client.release();
            }
        } else {
            res.status(400).json({ status: 'failure', message: 'Invalid signature' });
        }
    } catch (error: any) {
        console.error('[Order] verifyPayment error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// ─── Cancel Pending (Unpaid) Order ───
export const cancelPendingOrder = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const userId = req.user.id;

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Lock the order row — only cancel if still 'pending' (unpaid)
        const orderRes = await client.query(
            "SELECT id, user_id, status FROM orders WHERE id = $1 FOR UPDATE",
            [id]
        );

        if (orderRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Order not found' });
        }

        const order = orderRes.rows[0];

        // Only the order owner can cancel their own pending order
        if (order.user_id !== userId) {
            await client.query('ROLLBACK');
            return res.status(403).json({ message: 'Forbidden' });
        }

        if (order.status !== 'pending') {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Only unpaid (pending) orders can be cancelled this way' });
        }

        // Pending orders never had stock decremented (stock is only
        // decremented after successful payment), so NO stock restoration needed.

        // Mark order as cancelled
        await client.query(
            "UPDATE orders SET status = 'cancelled', updated_at = NOW() WHERE id = $1",
            [id]
        );

        await client.query('COMMIT');
        console.log(`🗑️ Pending order ${id} cancelled by user (no stock to restore)`);
        res.json({ message: 'Order cancelled' });
    } catch (error: any) {
        await client.query('ROLLBACK');
        console.error('[Order] cancelPendingOrder error:', error.message);
        res.status(500).json({ message: 'Failed to cancel order' });
    } finally {
        client.release();
    }
};

export const getMyOrders = async (req: AuthRequest, res: Response) => {
    try {
        const result = await pool.query(`
            WITH user_contexts AS (
                SELECT id as base_order_id, group_order_id, batch_id
                FROM orders 
                WHERE user_id = $1
            )
            SELECT 
                COALESCE(go.code, uc.base_order_id::text) as id,
                MAX(COALESCE(go.status::text, o.status::text)) as status,
                MAX(COALESCE(go.total_amount, o.total_amount)) as total_amount,
                MAX(COALESCE(o.payment_id, '')) as payment_id,
                MAX(COALESCE(o.order_token, '')) as order_token,
                MAX(COALESCE(go.created_at, o.created_at)) as created_at,
                MAX(COALESCE(go.created_at, o.updated_at)) as updated_at,
                MAX(r.name) as restaurant_name,
                MAX(o.batch_id) as batch_id,
                COALESCE(json_agg(
                    json_build_object(
                        'id', oi.id,
                        'menu_item_id', oi.menu_item_id,
                        'quantity', oi.quantity,
                        'price_at_time', oi.price_at_time,
                        'item_name', mi.name,
                        'item_image', mi.image_url,
                        'added_by', u.name
                    )
                ) FILTER (WHERE oi.id IS NOT NULL), '[]') as items
            FROM user_contexts uc
            JOIN orders o ON (uc.group_order_id IS NULL AND o.id = uc.base_order_id)
                          OR (uc.group_order_id IS NOT NULL AND o.group_order_id = uc.group_order_id)
            LEFT JOIN group_orders go ON uc.group_order_id = go.id
            LEFT JOIN restaurants r ON o.restaurant_id = r.id
            LEFT JOIN order_items oi ON oi.order_id = o.id
            LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
            LEFT JOIN users u ON o.user_id = u.id
            WHERE uc.batch_id IS NULL
            GROUP BY COALESCE(go.code, uc.base_order_id::text)

            UNION ALL

            -- Batch orders (multi-restaurant) grouped into single entries
            SELECT 
                uc.batch_id as id,
                MAX(o.status::text) as status,
                SUM(o.total_amount)::text as total_amount,
                MAX(COALESCE(o.payment_id, '')) as payment_id,
                '' as order_token,
                MAX(o.created_at) as created_at,
                MAX(o.updated_at) as updated_at,
                STRING_AGG(DISTINCT r.name, ', ') as restaurant_name,
                uc.batch_id as batch_id,
                COALESCE(json_agg(
                    json_build_object(
                        'id', oi.id,
                        'menu_item_id', oi.menu_item_id,
                        'quantity', oi.quantity,
                        'price_at_time', oi.price_at_time,
                        'item_name', mi.name,
                        'item_image', mi.image_url,
                        'added_by', u.name
                    )
                ) FILTER (WHERE oi.id IS NOT NULL), '[]') as items
            FROM user_contexts uc
            JOIN orders o ON o.id = uc.base_order_id
            LEFT JOIN restaurants r ON o.restaurant_id = r.id
            LEFT JOIN order_items oi ON oi.order_id = o.id
            LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
            LEFT JOIN users u ON o.user_id = u.id
            WHERE uc.batch_id IS NOT NULL
            GROUP BY uc.batch_id

            ORDER BY created_at DESC
        `, [req.user.id]);

        res.json(result.rows);
    } catch (error: any) {
        console.error('[Order] getMyOrders error:', error.message);
        res.status(500).json({ message: 'Server error' });
    }
};

// ─── Scan Order by Token (Staff) ───
// Security: QR can only be scanned ONCE. After the first scan, subsequent
// scans return 409 Conflict with the original scan timestamp.
export const scanOrderByToken = async (req: AuthRequest, res: Response) => {
    const rawToken = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;

    // Parse rotating QR: format is "TOKEN:HMAC" or plain "TOKEN"
    let orderToken = rawToken;
    let hmacFromQr: string | null = null;
    if (rawToken.includes(':')) {
        const parts = rawToken.split(':');
        orderToken = parts[0];
        hmacFromQr = parts[1];
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Lock the order row to prevent concurrent scans
        const result = await client.query(`
            SELECT o.id, o.status, o.total_amount, o.payment_id, o.order_token,
                   o.created_at, o.updated_at, o.is_scanned, o.scanned_at,
                   o.qr_secret, o.restaurant_id,
                   u.name as user_name, u.phone as user_phone,
                   r.name as restaurant_name,
                   COALESCE(json_agg(
                       json_build_object(
                           'id', oi.id,
                           'menu_item_id', oi.menu_item_id,
                           'quantity', oi.quantity,
                           'price_at_time', oi.price_at_time,
                           'item_name', mi.name,
                           'item_image', mi.image_url
                       )
                   ) FILTER (WHERE oi.id IS NOT NULL), '[]') as items
            FROM orders o
            LEFT JOIN users u ON o.user_id = u.id
            LEFT JOIN restaurants r ON o.restaurant_id = r.id
            LEFT JOIN order_items oi ON oi.order_id = o.id
            LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
            WHERE UPPER(o.order_token) = UPPER($1)
              AND o.status NOT IN ('pending', 'cancelled')
            GROUP BY o.id, u.name, u.phone, r.name
            FOR UPDATE OF o
        `, [orderToken]);

        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Order not found or not yet paid' });
        }

        const order = result.rows[0];

        // ─── Already scanned? Reject with details ───
        if (order.is_scanned) {
            await client.query('ROLLBACK');
            return res.status(409).json({
                message: 'This QR code has already been scanned',
                already_scanned: true,
                scanned_at: order.scanned_at,
                order_token: order.order_token,
            });
        }

        // ─── Verify rotating QR HMAC if the order has a qr_secret ───
        if (order.qr_secret && hmacFromQr) {
            const timeBucket = Math.floor(Date.now() / 15000);
            let verified = false;

            // Check current bucket and ±1 for clock skew tolerance
            for (const bucket of [timeBucket, timeBucket - 1, timeBucket + 1]) {
                const payload = `${order.order_token}:${bucket}`;
                const expectedHmac = crypto.createHmac('sha256', order.qr_secret)
                    .update(payload)
                    .digest('hex')
                    .substring(0, 16);
                if (expectedHmac === hmacFromQr) {
                    verified = true;
                    break;
                }
            }

            if (!verified) {
                await client.query('ROLLBACK');
                return res.status(400).json({ message: 'Invalid or expired QR code. Please refresh and try again.' });
            }
        }

        // ─── Restaurant IDOR check for staff ───
        if (req.user?.restaurant_id && order.restaurant_id && order.restaurant_id !== req.user.restaurant_id) {
            await client.query('ROLLBACK');
            return res.status(403).json({ message: 'This order belongs to a different restaurant' });
        }

        // ─── First scan — mark as scanned ───
        await client.query(
            'UPDATE orders SET is_scanned = TRUE, scanned_at = NOW() WHERE id = $1',
            [order.id]
        );

        await client.query('COMMIT');

        console.log(`🔒 Order #${order.order_token} scanned for the first time by staff ${req.user?.id}`);
        auditLog({ userId: req.user?.id, action: 'ORDER_QR_SCANNED', resource: `order:${order.id}`, details: `token=${order.order_token}`, ip: getRequestIp(req) });

        res.json({ ...order, is_scanned: true, scanned_at: new Date().toISOString() });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[Order] scanOrderByToken error:', (error as any).message);
        res.status(500).json({ message: 'Server error' });
    } finally {
        client.release();
    }
};

export const getPendingOrders = async (req: AuthRequest, res: Response) => {
    try {
        const staffRes = await pool.query('SELECT university_id, restaurant_id, role FROM staff WHERE id = $1', [req.user.id]);
        if (staffRes.rows.length === 0) return res.sendStatus(403);
        const uniId = staffRes.rows[0].university_id;
        const staffRole = staffRes.rows[0].role;
        const staffRestaurantId = staffRes.rows[0].restaurant_id;

        // Determine restaurant filter
        let restaurantId: string | null = null;
        if (staffRole === 'staff') {
            if (!staffRestaurantId) return res.status(403).json({ message: 'Staff member not assigned to a restaurant' });
            restaurantId = staffRestaurantId;
        } else if (req.query.restaurant_id) {
            restaurantId = req.query.restaurant_id as string;
        }

        const params: any[] = [uniId];
        let restaurantClause = '';
        if (restaurantId) {
            restaurantClause = ' AND o.restaurant_id = $2';
            params.push(restaurantId);
        }

        const result = await pool.query(`
            SELECT o.id, o.status, o.total_amount, o.payment_id, o.order_token,
                   o.created_at, o.updated_at, o.restaurant_id, o.batch_id,
                   u.name as user_name, u.phone as user_phone,
                   r.name as restaurant_name,
                   COALESCE(json_agg(
                       json_build_object(
                           'id', oi.id,
                           'menu_item_id', oi.menu_item_id,
                           'quantity', oi.quantity,
                           'price_at_time', oi.price_at_time,
                           'item_name', mi.name,
                           'item_image', mi.image_url
                       )
                   ) FILTER (WHERE oi.id IS NOT NULL), '[]') as items
            FROM orders o
            LEFT JOIN users u ON o.user_id = u.id
            LEFT JOIN restaurants r ON o.restaurant_id = r.id
            LEFT JOIN order_items oi ON oi.order_id = o.id
            LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
            WHERE o.university_id = $1
              AND o.status NOT IN ('completed', 'cancelled', 'pending')${restaurantClause}
            GROUP BY o.id, u.name, u.phone, r.name
            ORDER BY o.created_at ASC
        `, params);

        res.json(result.rows);
    } catch (error: any) {
        console.error('[Order] getPendingOrders error:', error.message);
        res.status(500).json({ message: 'Server error' });
    }
};

export const updateOrderStatus = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { status } = req.body;

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // First lock the order to prevent race conditions
        const orderRes = await client.query('SELECT status, user_id, university_id, restaurant_id FROM orders WHERE id = $1 FOR UPDATE', [id]);
        const currentOrder = orderRes.rows[0];
        
        if (!currentOrder) {
            throw new Error('Order not found');
        }

        // ─── IDOR: verify order belongs to staff's university ───
        if (req.user?.university_id && currentOrder.university_id !== req.user.university_id) {
            await client.query('ROLLBACK');
            return res.status(403).json({ message: 'Forbidden' });
        }

        // ─── Restaurant IDOR: staff can only update orders for their restaurant ───
        if (req.user?.restaurant_id && currentOrder.restaurant_id !== req.user.restaurant_id) {
            await client.query('ROLLBACK');
            return res.status(403).json({ message: 'You can only manage orders for your assigned restaurant' });
        }

        // If a PAID order is being cancelled by admin, restore the stock.
        // Pending orders never had stock decremented, so skip those.
        if (currentOrder.status !== 'cancelled' && currentOrder.status !== 'pending' && status === 'cancelled') {
            const itemsRes = await client.query('SELECT menu_item_id, quantity FROM order_items WHERE order_id = $1', [id]);
            
            // Sort items to prevent deadlocks when restoring stock
            const sortedItems = itemsRes.rows.sort((a: any, b: any) => a.menu_item_id.localeCompare(b.menu_item_id));
            
            for (const item of sortedItems) {
                // We use FOR UPDATE to acquire locks in consistent order
                await client.query('SELECT id FROM menu_items WHERE id = $1 FOR UPDATE', [item.menu_item_id]);
                await client.query('UPDATE menu_items SET stock_quantity = stock_quantity + $1 WHERE id = $2', [item.quantity, item.menu_item_id]);
            }
        }

        const result = await client.query(
            'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
            [status, id]
        );

        const order = result.rows[0];
        await client.query('COMMIT');

        // Emit to user via WebSocket
        emitStatusUpdate(currentOrder.user_id, order);
        
        // If the order just became ready, send an instant Push Notification
        if (currentOrder.status !== 'ready' && status === 'ready') {
            triggerOrderReady(
                currentOrder.user_id,
                String(id),
                String(order.order_token || String(id).split('-')[0]),
                String(order.total_amount || '0')
            ).catch(err => console.error('triggerOrderReady failed:', err));
        }

        auditLog({ userId: req.user?.id, action: 'ORDER_STATUS_CHANGED', resource: `order:${id}`, details: `status=${status}`, ip: getRequestIp(req) });

        res.json(order);
    } catch (error: any) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: error.message || 'Server error' });
    } finally {
        client.release();
    }
};

// ─── Admin: Get All Orders (with items + user info) ───
export const getAllOrders = async (req: AuthRequest, res: Response) => {
    const { status, restaurant_id, search, page = '1', limit = '50' } = req.query;

    try {
        const staffRes = await pool.query('SELECT university_id, restaurant_id, role FROM staff WHERE id = $1', [req.user.id]);
        if (staffRes.rows.length === 0) return res.sendStatus(403);
        const uniId = staffRes.rows[0].university_id;
        const staffRole = staffRes.rows[0].role;
        const staffRestaurantId = staffRes.rows[0].restaurant_id;

        // Staff enforcement: override restaurant_id filter
        let effectiveRestaurantId = restaurant_id;
        if (staffRole === 'staff') {
            if (!staffRestaurantId) return res.status(403).json({ message: 'Staff member not assigned to a restaurant' });
            effectiveRestaurantId = staffRestaurantId;
        }

        let query = `
            SELECT o.*, 
                   u.name as user_name, u.phone as user_phone,
                   r.name as restaurant_name,
                   json_agg(json_build_object(
                       'id', oi.id,
                       'menu_item_id', oi.menu_item_id,
                       'quantity', oi.quantity,
                       'price_at_time', oi.price_at_time,
                       'item_name', mi.name,
                       'item_image', mi.image_url
                   )) as items
            FROM orders o
            LEFT JOIN users u ON o.user_id = u.id
            LEFT JOIN restaurants r ON o.restaurant_id = r.id
            LEFT JOIN order_items oi ON oi.order_id = o.id
            LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
            WHERE o.university_id = $1
        `;
        const params: any[] = [uniId];
        let pIdx = 2;

        if (status) {
            query += ` AND o.status = $${pIdx++}`;
            params.push(status);
        }
        if (effectiveRestaurantId) {
            query += ` AND o.restaurant_id = $${pIdx++}`;
            params.push(effectiveRestaurantId);
        }
        if (search && typeof search === 'string' && search.trim()) {
            const term = `%${search.trim()}%`;
            query += ` AND (
                o.order_token ILIKE $${pIdx} OR
                u.name ILIKE $${pIdx} OR
                u.phone ILIKE $${pIdx} OR
                r.name ILIKE $${pIdx} OR
                CAST(o.id AS TEXT) ILIKE $${pIdx}
            )`;
            params.push(term);
            pIdx++;
        }

        query += ` GROUP BY o.id, u.name, u.phone, r.name ORDER BY o.created_at DESC`;
        query += ` LIMIT $${pIdx++} OFFSET $${pIdx++}`;
        params.push(parseInt(limit as string), (parseInt(page as string) - 1) * parseInt(limit as string));

        const result = await pool.query(query, params);

        // Get total count (same filters, no joins needed for count except for search)
        let countQuery = `
            SELECT COUNT(DISTINCT o.id) FROM orders o
            LEFT JOIN users u ON o.user_id = u.id
            LEFT JOIN restaurants r ON o.restaurant_id = r.id
            WHERE o.university_id = $1
        `;
        const countParams: any[] = [uniId];
        let cIdx = 2;
        if (status) { countQuery += ` AND o.status = $${cIdx++}`; countParams.push(status); }
        if (effectiveRestaurantId) { countQuery += ` AND o.restaurant_id = $${cIdx++}`; countParams.push(effectiveRestaurantId); }
        if (search && typeof search === 'string' && search.trim()) {
            const term = `%${search.trim()}%`;
            countQuery += ` AND (
                o.order_token ILIKE $${cIdx} OR
                u.name ILIKE $${cIdx} OR
                u.phone ILIKE $${cIdx} OR
                r.name ILIKE $${cIdx} OR
                CAST(o.id AS TEXT) ILIKE $${cIdx}
            )`;
            countParams.push(term);
            cIdx++;
        }

        const countResult = await pool.query(countQuery, countParams);

        res.json({
            orders: result.rows,
            total: parseInt(countResult.rows[0].count),
            page: parseInt(page as string),
            limit: parseInt(limit as string),
        });
    } catch (error: any) {
        console.error('[Order] getAllOrders error:', error.message);
        res.status(500).json({ message: 'Server error' });
    }
};

// ─── Admin: Get Single Order Details ───
export const getOrderDetails = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    try {
        const result = await pool.query(`
            SELECT o.*, 
                   u.name as user_name, u.phone as user_phone, u.email as user_email,
                   r.name as restaurant_name,
                   json_agg(json_build_object(
                       'id', oi.id,
                       'menu_item_id', oi.menu_item_id,
                       'quantity', oi.quantity,
                       'price_at_time', oi.price_at_time,
                       'item_name', mi.name,
                       'item_image', mi.image_url,
                       'item_category', mi.category
                   )) as items
            FROM orders o
            LEFT JOIN users u ON o.user_id = u.id
            LEFT JOIN restaurants r ON o.restaurant_id = r.id
            LEFT JOIN order_items oi ON oi.order_id = o.id
            LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
            WHERE o.id = $1
            GROUP BY o.id, u.name, u.phone, u.email, r.name
        `, [id]);

        if (result.rows.length === 0) return res.status(404).json({ message: 'Order not found' });
        res.json(result.rows[0]);
    } catch (error: any) {
        console.error('[Order] getOrderDetails error:', error.message);
        res.status(500).json({ message: 'Server error' });
    }
};

// ─── Admin: Request Refund (creates pending request for super_admin approval) ───
export const requestRefund = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { reason } = req.body;
    const staffId = req.user?.id;

    if (!reason || reason.trim().length === 0) {
        return res.status(400).json({ message: 'Reason is required for refund requests' });
    }

    try {
        // Check if order exists
        const orderRes = await pool.query('SELECT id, total_amount, status FROM orders WHERE id = $1', [id]);
        if (orderRes.rows.length === 0) {
            return res.status(404).json({ message: 'Order not found' });
        }

        const order = orderRes.rows[0];

        if (order.status !== 'completed') {
            return res.status(400).json({ message: 'Only completed orders can be refunded' });
        }

        // Check no pending request already exists for this order
        const existingReq = await pool.query(
            "SELECT id FROM refund_requests WHERE order_id = $1 AND status = 'pending'",
            [id]
        );
        if (existingReq.rows.length > 0) {
            return res.status(409).json({ message: 'A refund request is already pending for this order' });
        }

        const result = await pool.query(
            `INSERT INTO refund_requests (order_id, requested_by, reason, amount, status)
             VALUES ($1, $2, $3, $4, 'pending') RETURNING *`,
            [id, staffId, reason.trim(), order.total_amount]
        );

        auditLog({ userId: staffId, action: 'REFUND_REQUESTED', resource: `order:${id}`, details: reason, ip: getRequestIp(req) });

        res.status(201).json({ message: 'Refund request submitted for approval', request: result.rows[0] });
    } catch (error: any) {
        console.error('[Order] requestRefund error:', error.message);
        res.status(500).json({ message: 'Server error' });
    }
};

// ─── Super Admin: Get All Refund Requests ───
export const getRefundRequests = async (req: AuthRequest, res: Response) => {
    const { status: filterStatus } = req.query;

    try {
        const staffRes = await pool.query('SELECT university_id FROM staff WHERE id = $1', [req.user.id]);
        if (staffRes.rows.length === 0) return res.sendStatus(403);
        const uniId = staffRes.rows[0].university_id;

        let query = `
            SELECT rr.*,
                   o.order_token, o.status as order_status,
                   u.name as customer_name, u.phone as customer_phone,
                   r.name as restaurant_name,
                   s.name as requested_by_name, s.role as requested_by_role,
                   sa.name as approved_by_name,
                   COALESCE(json_agg(
                       json_build_object(
                           'item_name', mi.name,
                           'quantity', oi.quantity,
                           'price_at_time', oi.price_at_time
                       )
                   ) FILTER (WHERE oi.id IS NOT NULL), '[]') as order_items
            FROM refund_requests rr
            JOIN orders o ON rr.order_id = o.id
            LEFT JOIN users u ON o.user_id = u.id
            LEFT JOIN restaurants r ON o.restaurant_id = r.id
            LEFT JOIN staff s ON rr.requested_by = s.id
            LEFT JOIN staff sa ON rr.approved_by = sa.id
            LEFT JOIN order_items oi ON oi.order_id = o.id
            LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
            WHERE o.university_id = $1
        `;
        const params: any[] = [uniId];
        let pIdx = 2;

        if (filterStatus) {
            query += ` AND rr.status = $${pIdx++}`;
            params.push(filterStatus);
        }

        query += ` GROUP BY rr.id, o.order_token, o.status, u.name, u.phone, r.name, s.name, s.role, sa.name
                   ORDER BY rr.created_at DESC`;

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error: any) {
        console.error('[Order] getRefundRequests error:', error.message);
        res.status(500).json({ message: 'Server error' });
    }
};

// ─── Super Admin: Approve Refund ───
export const approveRefund = async (req: AuthRequest, res: Response) => {
    const { id } = req.params; // refund_request id
    const superAdminId = req.user?.id;

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Lock and validate the refund request
        const reqRes = await client.query(
            "SELECT * FROM refund_requests WHERE id = $1 AND status = 'pending' FOR UPDATE",
            [id]
        );
        if (reqRes.rows.length === 0) {
            throw new Error('Refund request not found or already processed');
        }

        const refundReq = reqRes.rows[0];
        const orderId = refundReq.order_id;
        const refundAmount = Number(refundReq.amount);

        // 2. Get the order and user
        const orderRes = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [orderId]);
        if (orderRes.rows.length === 0) throw new Error('Order not found');
        const order = orderRes.rows[0];

        // 3. If not already cancelled, cancel + restore stock
        if (order.status !== 'cancelled') {
            const itemsRes = await client.query('SELECT menu_item_id, quantity FROM order_items WHERE order_id = $1', [orderId]);
            const sortedItems = itemsRes.rows.sort((a: any, b: any) => a.menu_item_id.localeCompare(b.menu_item_id));
            for (const item of sortedItems) {
                await client.query('SELECT id FROM menu_items WHERE id = $1 FOR UPDATE', [item.menu_item_id]);
                await client.query('UPDATE menu_items SET stock_quantity = stock_quantity + $1 WHERE id = $2', [item.quantity, item.menu_item_id]);
            }
            await client.query("UPDATE orders SET status = 'cancelled', updated_at = NOW() WHERE id = $1", [orderId]);
        }

        // 4. Credit wallet
        await client.query(
            'UPDATE users SET wallet_balance = wallet_balance + $1 WHERE id = $2',
            [refundAmount, order.user_id]
        );

        // 5. Record wallet transaction
        await client.query(
            `INSERT INTO wallet_transactions (user_id, amount, type, description, reference_id)
             VALUES ($1, $2, 'refund', $3, $4)`,
            [order.user_id, refundAmount, `Refund for Order #${order.order_token || orderId.toString().substring(0, 8)}`, orderId]
        );

        // 6. Mark refund request as approved
        await client.query(
            "UPDATE refund_requests SET status = 'approved', approved_by = $1, resolved_at = NOW() WHERE id = $2",
            [superAdminId, id]
        );

        await client.query('COMMIT');

        // 7. Notify user via socket + push
        emitStatusUpdate(order.user_id, { ...order, status: 'cancelled', refund_amount: refundAmount });

        triggerRefund(
            order.user_id,
            String(orderId),
            String(order.order_token || orderId.toString().substring(0, 6)),
            refundAmount
        ).catch(err => console.error('triggerRefund failed:', err));

        auditLog({ userId: superAdminId, action: 'REFUND_APPROVED', resource: `order:${orderId}`, details: `amount:${refundAmount}`, ip: getRequestIp(req) });

        res.json({ message: `₹${refundAmount.toFixed(0)} refunded to student's wallet`, refund_request_id: id });
    } catch (error: any) {
        await client.query('ROLLBACK');
        console.error('[Order] approveRefund error:', error.message);
        res.status(500).json({ message: 'Server error' });
    } finally {
        client.release();
    }
};

// ─── Super Admin: Reject Refund ───
export const rejectRefund = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { note } = req.body;
    const superAdminId = req.user?.id;

    try {
        const result = await pool.query(
            "UPDATE refund_requests SET status = 'rejected', approved_by = $1, admin_note = $2, resolved_at = NOW() WHERE id = $3 AND status = 'pending' RETURNING *",
            [superAdminId, note || 'Rejected by super admin', id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Refund request not found or already processed' });
        }

        auditLog({ userId: superAdminId, action: 'REFUND_REJECTED', resource: `refund_request:${id}`, details: note, ip: getRequestIp(req) });

        res.json({ message: 'Refund request rejected', request: result.rows[0] });
    } catch (error: any) {
        console.error('[Order] rejectRefund error:', error.message);
        res.status(500).json({ message: 'Server error' });
    }
};

// ═══════════════════════════════════════════════════════
// Auto-Expire Stale Pending Orders
// ═══════════════════════════════════════════════════════
// Safety net: cancels orders stuck in 'pending' (unpaid) for > 15 minutes.
// Runs every 5 minutes. Restores stock for each expired order.

const PENDING_EXPIRY_MINUTES = 15;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

const expireStalePendingOrders = async () => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Find and lock all stale pending orders
        const staleOrders = await client.query(
            `SELECT id FROM orders
             WHERE status = 'pending'
               AND created_at < NOW() - INTERVAL '${PENDING_EXPIRY_MINUTES} minutes'
             FOR UPDATE`
        );

        if (staleOrders.rows.length === 0) {
            await client.query('COMMIT');
            return;
        }

        for (const order of staleOrders.rows) {
            // Pending orders never had stock decremented (stock is only
            // decremented after successful payment), so NO stock restoration needed.
            // Just cancel the order.
            await client.query(
                "UPDATE orders SET status = 'cancelled', updated_at = NOW() WHERE id = $1",
                [order.id]
            );
        }

        await client.query('COMMIT');
        console.log(`🧹 Auto-expired ${staleOrders.rows.length} stale pending order(s) (no stock to restore)`);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('expireStalePendingOrders error:', error);
    } finally {
        client.release();
    }
};

// ═══════════════════════════════════════════════════════════
// Multi-Restaurant Order Creation
// ═══════════════════════════════════════════════════════════

export const createMultiRestaurantOrder = async (req: AuthRequest, res: Response) => {
    const { items, university_id } = req.body; // items: [{ menu_item_id, quantity }]
    const user_id = req.user.id;

    if (!items || items.length === 0) {
        return res.status(400).json({ message: 'No items provided' });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Fetch all menu items and group by restaurant
        const sortedItems = [...items].sort((a: any, b: any) => a.menu_item_id.localeCompare(b.menu_item_id));
        const restaurantGroups: Record<string, { restaurantId: string; restaurantName: string; items: any[]; total: number }> = {};

        for (const item of sortedItems) {
            const result = await client.query(
                'SELECT price, is_available, restaurant_id, stock_quantity, name FROM menu_items WHERE id = $1',
                [item.menu_item_id]
            );
            const menuItem = result.rows[0];

            if (!menuItem || !menuItem.is_available) {
                throw new Error(`Item ${item.menu_item_id} not available`);
            }
            if (menuItem.stock_quantity < item.quantity) {
                throw new Error(`Insufficient stock for item: ${menuItem.name}. Only ${menuItem.stock_quantity} left.`);
            }

            const price = parseFloat(menuItem.price);
            const rid = menuItem.restaurant_id;

            if (!restaurantGroups[rid]) {
                const rResult = await client.query('SELECT name FROM restaurants WHERE id = $1', [rid]);
                restaurantGroups[rid] = {
                    restaurantId: rid,
                    restaurantName: rResult.rows[0]?.name ?? 'Restaurant',
                    items: [],
                    total: 0,
                };
            }

            restaurantGroups[rid].items.push({ ...item, price, name: menuItem.name });
            restaurantGroups[rid].total += price * item.quantity;
        }

        const restaurantKeys = Object.keys(restaurantGroups);

        // Gate check: verify ALL restaurants are open
        for (const rid of restaurantKeys) {
            const gateCheck = await checkRestaurantAcceptingOrders(client, rid);
            if (!gateCheck.accepting) {
                throw new Error(gateCheck.reason || `Restaurant is not accepting orders`);
            }
        }

        // 2. Calculate grand total and create ONE Razorpay order
        const grandTotal = Object.values(restaurantGroups).reduce((sum, g) => sum + g.total, 0);
        const amountInPaise = Math.round(grandTotal * 100);

        let razorpayOrderId = `mock_order_${crypto.randomBytes(4).toString('hex')}`;
        if (process.env.RAZORPAY_KEY_ID && !process.env.RAZORPAY_KEY_ID.includes('placeholder')) {
            const razorpayOrder = await razorpay.orders.create({
                amount: amountInPaise,
                currency: 'INR',
                receipt: `multi_${Date.now()}`,
            });
            razorpayOrderId = razorpayOrder.id;
            console.log(`✅ Razorpay multi-order created: ${razorpayOrderId}, amount: ${amountInPaise} paise, restaurants: ${restaurantKeys.length}`);
        } else if (process.env.NODE_ENV === 'production') {
            throw new Error('Payment gateway is not configured');
        }

        // 3. Create batch ID to link all sub-orders
        const batchId = `batch_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

        // 4. Create separate DB order for each restaurant
        const subOrders: any[] = [];

        for (let i = 0; i < restaurantKeys.length; i++) {
            const group = restaurantGroups[restaurantKeys[i]];
            const orderToken = await generateOrderToken(client);
            const qrSecret = crypto.randomBytes(32).toString('hex');
            // Each sub-order gets a unique payment_id suffix
            const subPaymentId = restaurantKeys.length === 1 ? razorpayOrderId : `${razorpayOrderId}#sub${i}`;

            const orderResult = await client.query(
                `INSERT INTO orders (user_id, university_id, restaurant_id, status, total_amount, payment_id, order_token, qr_secret, qr_rotated_at, batch_id)
                 VALUES ($1, $2, $3, 'pending', $4, $5, $6, $7, NOW(), $8)
                 RETURNING id, order_token`,
                [user_id, university_id, group.restaurantId, group.total, subPaymentId, orderToken, qrSecret, batchId]
            );
            const dbOrderId = orderResult.rows[0].id;

            // Insert order items
            for (const item of group.items) {
                await client.query(
                    'INSERT INTO order_items (order_id, menu_item_id, quantity, price_at_time) VALUES ($1, $2, $3, $4)',
                    [dbOrderId, item.menu_item_id, item.quantity, item.price]
                );
            }

            subOrders.push({
                id: dbOrderId,
                order_token: orderToken,
                restaurant_id: group.restaurantId,
                restaurant_name: group.restaurantName,
                amount: group.total,
                items: group.items,
            });
        }

        await client.query('COMMIT');

        res.status(201).json({
            payment_id: razorpayOrderId,
            total_amount: grandTotal,
            amount_in_paise: amountInPaise,
            currency: 'INR',
            batch_id: batchId,
            sub_orders: subOrders,
        });
    } catch (error: any) {
        await client.query('ROLLBACK');
        const msg = error.message || 'Server error';
        const isClientError = msg.includes('not available')
            || msg.includes('Insufficient stock')
            || msg.includes('closed')
            || msg.includes('no longer accepted')
            || msg.includes('Could not determine restaurant');

        if (isClientError) {
            console.warn(`[Order] Multi-order rejected: ${msg}`);
            return res.status(400).json({ message: msg });
        }
        console.error('[Order] createMultiRestaurantOrder error:', error);
        res.status(500).json({ message: 'Server error' });
    } finally {
        client.release();
    }
};

// ═══════════════════════════════════════════════════════════
// Verify Payment for Multi-Restaurant Orders (Batch)
// ═══════════════════════════════════════════════════════════
export const verifyBatchPayment = async (req: AuthRequest, res: Response) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, batch_id } = req.body;

    try {
        let isValid = false;

        if (process.env.RAZORPAY_KEY_SECRET && !process.env.RAZORPAY_KEY_SECRET.includes('placeholder')) {
            const body = razorpay_order_id + "|" + razorpay_payment_id;
            const expectedSignature = crypto
                .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
                .update(body.toString())
                .digest('hex');
            isValid = (expectedSignature === razorpay_signature);
        } else if (process.env.NODE_ENV !== 'production') {
            isValid = razorpay_order_id.startsWith('mock_') && razorpay_signature === 'mock_signature';
        }

        if (!isValid) {
            return res.status(400).json({ status: 'failure', message: 'Invalid signature' });
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Find all sub-orders in this batch
            const batchOrders = await client.query(
                "SELECT * FROM orders WHERE batch_id = $1 AND status = 'pending' FOR UPDATE",
                [batch_id]
            );

            if (batchOrders.rows.length === 0) {
                // Fallback: try single order by payment_id
                const singleOrder = await client.query(
                    "SELECT * FROM orders WHERE payment_id = $1 AND status = 'pending' FOR UPDATE",
                    [razorpay_order_id]
                );
                if (singleOrder.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ status: 'failure', message: 'Order not found or already processed' });
                }
                batchOrders.rows.push(...singleOrder.rows);
            }

            // Process each sub-order
            for (const order of batchOrders.rows) {
                // Gate check: re-verify restaurant open
                const gateCheck = await checkRestaurantAcceptingOrders(client, order.restaurant_id);
                if (!gateCheck.accepting) {
                    // Auto-refund this sub-order
                    const refundAmount = Number(order.total_amount);
                    await client.query("UPDATE orders SET status = 'cancelled', updated_at = NOW() WHERE id = $1", [order.id]);
                    await client.query('UPDATE users SET wallet_balance = wallet_balance + $1 WHERE id = $2', [refundAmount, order.user_id]);
                    await client.query(
                        `INSERT INTO wallet_transactions (user_id, amount, type, description, reference_id) VALUES ($1, $2, 'refund', $3, $4)`,
                        [order.user_id, refundAmount, `Auto-refund: ${gateCheck.reason}`, order.id]
                    );
                    console.log(`🔒 Sub-order ${order.id} auto-cancelled & refunded ₹${refundAmount}`);
                    continue;
                }

                // Decrement stock
                const itemsRes = await client.query('SELECT menu_item_id, quantity FROM order_items WHERE order_id = $1', [order.id]);
                const sortedItems = itemsRes.rows.sort((a: any, b: any) => a.menu_item_id.localeCompare(b.menu_item_id));

                for (const item of sortedItems) {
                    const miRes = await client.query(
                        'SELECT stock_quantity, name, is_available FROM menu_items WHERE id = $1 FOR UPDATE',
                        [item.menu_item_id]
                    );
                    const mi = miRes.rows[0];
                    if (!mi || !mi.is_available) throw new Error(`Item ${mi?.name || item.menu_item_id} is no longer available`);
                    if (mi.stock_quantity < item.quantity) throw new Error(`Insufficient stock for ${mi.name}`);

                    const newStock = mi.stock_quantity - item.quantity;
                    await client.query('UPDATE menu_items SET stock_quantity = stock_quantity - $1 WHERE id = $2', [item.quantity, item.menu_item_id]);
                    if (newStock <= 0) {
                        await client.query('UPDATE menu_items SET is_available = false WHERE id = $1', [item.menu_item_id]);
                    }
                }

                // Mark as preparing
                await client.query("UPDATE orders SET status = 'preparing', updated_at = NOW() WHERE id = $1", [order.id]);

                // Emit to staff
                const fullOrderRes = await client.query(`
                    SELECT o.id, o.status, o.total_amount, o.payment_id, o.order_token,
                           o.created_at, o.updated_at, o.university_id, o.restaurant_id,
                           u.name as user_name, u.phone as user_phone,
                           r.name as restaurant_name,
                           COALESCE(json_agg(
                               json_build_object(
                                   'id', oi.id, 'menu_item_id', oi.menu_item_id,
                                   'quantity', oi.quantity, 'price_at_time', oi.price_at_time,
                                   'item_name', mi.name, 'item_image', mi.image_url
                               )
                           ) FILTER (WHERE oi.id IS NOT NULL), '[]') as items
                    FROM orders o
                    LEFT JOIN users u ON o.user_id = u.id
                    LEFT JOIN restaurants r ON o.restaurant_id = r.id
                    LEFT JOIN order_items oi ON oi.order_id = o.id
                    LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
                    WHERE o.id = $1
                    GROUP BY o.id, u.name, u.phone, r.name
                `, [order.id]);
                const fullOrder = fullOrderRes.rows[0] || order;
                emitNewOrder(order.university_id, fullOrder);
            }

            await client.query('COMMIT');
            res.json({ status: 'success', batch_id, orders_processed: batchOrders.rows.length });
        } catch (stockError: any) {
            await client.query('ROLLBACK');
            console.warn(`[Order] verifyBatchPayment stock conflict: ${stockError.message}`);
            res.status(409).json({ status: 'failure', message: stockError.message || 'Stock unavailable after payment' });
        } finally {
            client.release();
        }
    } catch (error: any) {
        console.error('[Order] verifyBatchPayment error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// ═══════════════════════════════════════════════════════════
// Rotating QR Token
// ═══════════════════════════════════════════════════════════

export const getQrToken = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
        const orderRes = await pool.query(
            'SELECT id, user_id, order_token, qr_secret, status FROM orders WHERE id = $1',
            [id]
        );

        if (orderRes.rows.length === 0) {
            return res.status(404).json({ message: 'Order not found' });
        }

        const order = orderRes.rows[0];

        // Only order owner can get QR token
        if (order.user_id !== userId) {
            return res.status(403).json({ message: 'Forbidden' });
        }

        // If not ready, return status only
        if (order.status !== 'ready') {
            return res.json({
                ready: false,
                status: order.status,
                order_token: order.order_token,
            });
        }

        // Generate rotating QR data using HMAC
        const timeBucket = Math.floor(Date.now() / 15000); // 15-second buckets
        const payload = `${order.order_token}:${timeBucket}`;
        const hmac = crypto.createHmac('sha256', order.qr_secret || order.order_token)
            .update(payload)
            .digest('hex')
            .substring(0, 16);

        const qrData = `${order.order_token}:${hmac}`;

        // Time until next rotation
        const nextBucket = (timeBucket + 1) * 15000;
        const expiresIn = Math.max(1, Math.ceil((nextBucket - Date.now()) / 1000));

        res.json({
            ready: true,
            status: order.status,
            order_token: order.order_token,
            qr_data: qrData,
            expires_in: expiresIn,
        });
    } catch (error: any) {
        console.error('[Order] getQrToken error:', error.message);
        res.status(500).json({ message: 'Server error' });
    }
};

// ═══════════════════════════════════════════════════════════
// Get Sub-Orders by Batch ID (for multi-restaurant orders)
// ═══════════════════════════════════════════════════════════

export const getSubOrdersByBatch = async (req: AuthRequest, res: Response) => {
    const { batchId } = req.params;
    const userId = req.user.id;

    try {
        const result = await pool.query(`
            SELECT o.id, o.status, o.total_amount, o.order_token, o.restaurant_id, o.batch_id,
                   o.created_at, o.updated_at,
                   r.name as restaurant_name,
                   COALESCE(json_agg(
                       json_build_object(
                           'id', oi.id, 'menu_item_id', oi.menu_item_id,
                           'quantity', oi.quantity, 'price_at_time', oi.price_at_time,
                           'item_name', mi.name, 'item_image', mi.image_url
                       )
                   ) FILTER (WHERE oi.id IS NOT NULL), '[]') as items
            FROM orders o
            LEFT JOIN restaurants r ON o.restaurant_id = r.id
            LEFT JOIN order_items oi ON oi.order_id = o.id
            LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
            WHERE o.batch_id = $1 AND o.user_id = $2
            GROUP BY o.id, r.name
            ORDER BY r.name
        `, [batchId, userId]);

        res.json(result.rows);
    } catch (error: any) {
        console.error('[Order] getSubOrdersByBatch error:', error.message);
        res.status(500).json({ message: 'Server error' });
    }
};

// ═══════════════════════════════════════════════════════════
// Invoice/Bill Generation
// ═══════════════════════════════════════════════════════════

export const generateInvoice = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    try {
        const result = await pool.query(`
            SELECT o.id, o.status, o.total_amount, o.payment_id, o.order_token,
                   o.created_at, o.updated_at, o.batch_id, o.university_id,
                   u.name as customer_name, u.phone as customer_phone,
                   r.name as restaurant_name, r.logo_url as restaurant_logo,
                   COALESCE(uni.name, 'Ahmedabad University') as university_name,
                   COALESCE(json_agg(
                       json_build_object(
                           'item_name', mi.name,
                           'quantity', oi.quantity,
                           'unit_price', oi.price_at_time,
                           'total', oi.quantity * oi.price_at_time,
                           'category', mi.category,
                           'is_veg', mi.is_veg
                       )
                   ) FILTER (WHERE oi.id IS NOT NULL), '[]') as items
            FROM orders o
            LEFT JOIN users u ON o.user_id = u.id
            LEFT JOIN restaurants r ON o.restaurant_id = r.id
            LEFT JOIN universities uni ON o.university_id = uni.id
            LEFT JOIN order_items oi ON oi.order_id = o.id
            LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
            WHERE o.id = $1
            GROUP BY o.id, o.status, o.total_amount, o.payment_id, o.order_token,
                     o.created_at, o.updated_at, o.batch_id, o.university_id,
                     u.name, u.phone, r.name, r.logo_url, uni.name
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Order not found' });
        }

        const order = result.rows[0];
        const items = order.items || [];
        const subtotal = items.reduce((sum: number, i: any) => sum + parseFloat(i.total || 0), 0);
        const invoiceNumber = `INV-${order.order_token || order.id.substring(0, 8).toUpperCase()}-${new Date(order.created_at).getFullYear()}`;

        // Return invoice data as JSON — the frontend will render the PDF
        res.json({
            invoice_number: invoiceNumber,
            order_id: order.id,
            order_token: order.order_token,
            status: order.status,
            payment_method: order.payment_id?.startsWith('wallet_') ? 'Wallet' : 'Razorpay',
            payment_id: order.payment_id,
            created_at: order.created_at,
            updated_at: order.updated_at,
            customer: {
                name: order.customer_name,
                phone: order.customer_phone,
                email: order.customer_email,
            },
            restaurant: {
                name: order.restaurant_name,
                logo_url: order.restaurant_logo,
            },
            university: order.university_name,
            items: items.map((i: any) => ({
                name: i.item_name,
                quantity: i.quantity,
                unit_price: parseFloat(i.unit_price),
                total: parseFloat(i.total),
                category: i.category,
                is_veg: i.is_veg,
            })),
            subtotal,
            total: parseFloat(order.total_amount),
            batch_id: order.batch_id,
        });
    } catch (error: any) {
        console.error('[Order] generateInvoice error:', error.message);
        res.status(500).json({ message: 'Server error' });
    }
};

// Start the cleanup interval
export const startPendingOrderCleanup = () => {
    console.log(`🕐 Pending order cleanup scheduled every ${CLEANUP_INTERVAL_MS / 60000} minutes (expiry: ${PENDING_EXPIRY_MINUTES} min)`);
    setInterval(expireStalePendingOrders, CLEANUP_INTERVAL_MS);
    // Run once on startup after a short delay
    setTimeout(expireStalePendingOrders, 10_000);
};
