import { Request, Response } from 'express';
import pool from '../config/db';
import razorpay from '../config/razorpay';
import crypto from 'crypto';
import { AuthRequest } from '../middlewares/authMiddleware';
import { emitNewOrder, emitStatusUpdate } from '../services/socketService';

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

        for (const item of items) {
            const result = await client.query('SELECT price, is_available, restaurant_id FROM menu_items WHERE id = $1', [item.menu_item_id]);
            const menuItem = result.rows[0];

            if (!menuItem || !menuItem.is_available) {
                throw new Error(`Item ${item.menu_item_id} not available`);
            }

            const price = parseFloat(menuItem.price);
            totalAmount += price * item.quantity;
            if (!restaurantId) restaurantId = menuItem.restaurant_id;
            orderItemsData.push({ ...item, price });
        }

        if (!restaurantId) {
            throw new Error('Could not determine restaurant for order');
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
        console.error(error);
        res.status(500).json({ message: error.message || 'Server error' });
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
        } else {
            // Mock environment check
            isValid = razorpay_order_id.startsWith('mock_') && razorpay_signature === 'mock_signature';
        }

        if (isValid) {
            // Payment successful
            const result = await pool.query(
                "UPDATE orders SET status = 'preparing', updated_at = NOW() WHERE payment_id = $1 RETURNING *",
                [razorpay_order_id]
            );

            const order = result.rows[0];

            // Emit to Staff
            if (order) {
                emitNewOrder(order.university_id, order);
            }

            res.json({ status: 'success', order });
        } else {
            res.status(400).json({ status: 'failure', message: 'Invalid signature' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
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
                MAX(COALESCE(go.status, o.status)) as status,
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
    } catch (error) {
        console.error('getMyOrders error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// ─── Scan Order by Token (Staff) ───
export const scanOrderByToken = async (req: AuthRequest, res: Response) => {
    const { token } = req.params;

    try {
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
            WHERE UPPER(o.order_token) = UPPER($1)
              AND o.status NOT IN ('completed', 'cancelled')
            GROUP BY o.id, u.name, u.phone, r.name
        `, [token]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Order not found or already completed' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('scanOrderByToken error:', error);
        res.status(500).json({ message: 'Server error' });
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
              AND o.status NOT IN ('completed', 'cancelled')
            GROUP BY o.id, u.name, u.phone, r.name
            ORDER BY o.created_at ASC
        `, [uniId]);

        res.json(result.rows);
    } catch (error) {
        console.error('getPendingOrders error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const updateOrderStatus = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { status } = req.body;

    try {
        const result = await pool.query(
            'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
            [status, id]
        );

        const order = result.rows[0];
        if (!order) return res.status(404).json({ message: 'Order not found' });

        // Emit to user
        emitStatusUpdate(order.user_id, order);

        res.json(order);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// ─── Admin: Get All Orders (with items + user info) ───
export const getAllOrders = async (req: AuthRequest, res: Response) => {
    const { status, restaurant_id, page = '1', limit = '50' } = req.query;

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

        query += ` GROUP BY o.id, u.name, u.phone, r.name ORDER BY o.created_at DESC`;
        query += ` LIMIT $${pIdx++} OFFSET $${pIdx++}`;
        params.push(parseInt(limit as string), (parseInt(page as string) - 1) * parseInt(limit as string));

        const result = await pool.query(query, params);

        // Get total count
        let countQuery = `SELECT COUNT(DISTINCT o.id) FROM orders o WHERE o.university_id = $1`;
        const countParams: any[] = [uniId];
        let cIdx = 2;
        if (status) { countQuery += ` AND o.status = $${cIdx++}`; countParams.push(status); }
        if (restaurant_id) { countQuery += ` AND o.restaurant_id = $${cIdx++}`; countParams.push(restaurant_id); }

        const countResult = await pool.query(countQuery, countParams);

        res.json({
            orders: result.rows,
            total: parseInt(countResult.rows[0].count),
            page: parseInt(page as string),
            limit: parseInt(limit as string),
        });
    } catch (error) {
        console.error(error);
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
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// ─── Admin: Refund Order ───
export const refundOrder = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { reason } = req.body;

    try {
        const result = await pool.query(
            `UPDATE orders SET status = 'cancelled', updated_at = NOW() WHERE id = $1 RETURNING *`,
            [id]
        );

        const order = result.rows[0];
        if (!order) return res.status(404).json({ message: 'Order not found' });

        // Notify user about refund
        emitStatusUpdate(order.user_id, { ...order, refund_reason: reason || 'Refund processed by admin' });

        res.json({ message: 'Order refunded successfully', order });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};
