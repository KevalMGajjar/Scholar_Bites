import { Request, Response } from 'express';
import pool from '../config/db';
import razorpay from '../config/razorpay';
import crypto from 'crypto';
import { AuthRequest } from '../middlewares/authMiddleware';
import { emitNewOrder, emitStatusUpdate } from '../services/socketService';
import { createAndPush } from './notificationController';
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

        const insertOrderQuery = `
            INSERT INTO orders (user_id, university_id, restaurant_id, status, total_amount, payment_id, order_token)
            VALUES ($1, $2, $3, 'pending', $4, $5, $6)
            RETURNING id, order_token
        `;
        const orderResult = await client.query(insertOrderQuery, [user_id, university_id, restaurantId, totalAmount, orderId, orderToken]);
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
                SELECT id as base_order_id, group_order_id 
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
            GROUP BY COALESCE(go.code, uc.base_order_id::text)
            ORDER BY MAX(COALESCE(go.created_at, o.created_at)) DESC
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
    const { token } = req.params;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Lock the order row to prevent concurrent scans
        const result = await client.query(`
            SELECT o.id, o.status, o.total_amount, o.payment_id, o.order_token,
                   o.created_at, o.updated_at, o.is_scanned, o.scanned_at,
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
        `, [token]);

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
        const staffRes = await pool.query('SELECT university_id FROM staff WHERE id = $1', [req.user.id]);
        if (staffRes.rows.length === 0) return res.sendStatus(403);
        const uniId = staffRes.rows[0].university_id;

        const result = await pool.query(`
            SELECT o.id, o.status, o.total_amount, o.payment_id, o.order_token,
                   o.created_at, o.updated_at,
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
              AND o.status NOT IN ('completed', 'cancelled', 'pending')
            GROUP BY o.id, u.name, u.phone, r.name
            ORDER BY o.created_at ASC
        `, [uniId]);

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
        const orderRes = await client.query('SELECT status, user_id, university_id FROM orders WHERE id = $1 FOR UPDATE', [id]);
        const currentOrder = orderRes.rows[0];
        
        if (!currentOrder) {
            throw new Error('Order not found');
        }

        // ─── IDOR: verify order belongs to staff's university ───
        if (req.user?.university_id && currentOrder.university_id !== req.user.university_id) {
            await client.query('ROLLBACK');
            return res.status(403).json({ message: 'Forbidden' });
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
            await createAndPush(
                currentOrder.user_id,
                'order_ready',
                'Your Order is Ready! 🍔',
                `Your order #${order.order_token || String(id).split('-')[0]} is freshly prepared and ready for pickup at the counter!`,
                { 
                  order_id: String(id), 
                  type: 'order_ready',
                  order_token: String(order.order_token || ''),
                  amount: String(order.total_amount || '0')
                }
            );
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
        const staffRes = await pool.query('SELECT university_id FROM staff WHERE id = $1', [req.user.id]);
        if (staffRes.rows.length === 0) return res.sendStatus(403);
        const uniId = staffRes.rows[0].university_id;

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
        if (restaurant_id) {
            query += ` AND o.restaurant_id = $${pIdx++}`;
            params.push(restaurant_id);
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
        if (restaurant_id) { countQuery += ` AND o.restaurant_id = $${cIdx++}`; countParams.push(restaurant_id); }
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

        await createAndPush(
            order.user_id,
            'refund',
            'Refund Credited! 💰',
            `₹${refundAmount.toFixed(0)} has been refunded to your wallet for Order #${order.order_token || orderId.toString().substring(0, 6)}.`,
            { order_id: String(orderId), type: 'refund', amount: String(refundAmount) }
        );

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

// Start the cleanup interval
export const startPendingOrderCleanup = () => {
    console.log(`🕐 Pending order cleanup scheduled every ${CLEANUP_INTERVAL_MS / 60000} minutes (expiry: ${PENDING_EXPIRY_MINUTES} min)`);
    setInterval(expireStalePendingOrders, CLEANUP_INTERVAL_MS);
    // Run once on startup after a short delay
    setTimeout(expireStalePendingOrders, 10_000);
};
