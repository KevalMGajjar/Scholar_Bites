import { Request, Response } from 'express';
import pool from '../config/db';
import razorpay from '../config/razorpay';
import crypto from 'crypto';
import { AuthRequest } from '../middlewares/authMiddleware';
import { emitNewOrder, emitStatusUpdate } from '../services/socketService';

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

        // 2. Create Razorpay Order
        let orderId = `mock_order_${crypto.randomBytes(4).toString('hex')}`;

        if (process.env.RAZORPAY_KEY_ID && !process.env.RAZORPAY_KEY_ID.includes('placeholder')) {
            const razorpayOrder = await razorpay.orders.create({
                amount: Math.round(totalAmount * 100), // amount in paisa
                currency: 'INR',
                receipt: `order_${Date.now()}`,
            });
            orderId = razorpayOrder.id;
        }

        // 3. Create Database Order
        // Note: Using razorpay_order_id as payment_id initially

        const insertOrderQuery = `
            INSERT INTO orders (user_id, university_id, restaurant_id, status, total_amount, payment_id)
            VALUES ($1, $2, $3, 'pending', $4, $5)
            RETURNING id
        `;
        const orderResult = await client.query(insertOrderQuery, [user_id, university_id, restaurantId, totalAmount, orderId]);
        const dbOrderId = orderResult.rows[0].id;

        // 4. Create Order Items
        for (const item of orderItemsData) {
            await client.query(
                'INSERT INTO order_items (order_id, menu_item_id, quantity, price_at_time) VALUES ($1, $2, $3, $4)',
                [dbOrderId, item.menu_item_id, item.quantity, item.price]
            );
        }

        await client.query('COMMIT');

        res.status(201).json({
            id: dbOrderId,
            payment_id: orderId, // Razorpay Order ID
            amount: totalAmount,
            currency: 'INR',
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
        const result = await pool.query(
            'SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC',
            [req.user.id]
        );
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

export const getPendingOrders = async (req: AuthRequest, res: Response) => {
    // Staff only. Ideally fetch by university_id (from staff's university)
    // We assume staff is from a specific university. 
    // Need to fetch staff's university_id first.

    try {
        const staffRes = await pool.query('SELECT university_id FROM staff WHERE id = $1', [req.user.id]);
        if (staffRes.rows.length === 0) return res.sendStatus(403);
        const uniId = staffRes.rows[0].university_id;

        const result = await pool.query(
            "SELECT * FROM orders WHERE university_id = $1 AND status != 'completed' AND status != 'cancelled' ORDER BY created_at ASC",
            [uniId]
        );
        res.json(result.rows);
    } catch (error) {
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
