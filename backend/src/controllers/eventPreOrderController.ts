import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import pool from '../config/db';
import { auditLog, getRequestIp } from '../services/auditLogger';
import { sendNewEventNotification, sendCateringRejectionEmail } from '../services/emailService';

// ═══════════════════════════════════════════════════════════════
// Event Pre-Order Controller — Staff event catering requests
// Only university_staff users can create event pre-orders
// Items must come from the "Club Events" restaurant
// ═══════════════════════════════════════════════════════════════

/** Create an event pre-order */
export const createEventPreOrder = async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const userType = req.user?.user_type;

    if (userType !== 'university_staff') {
        return res.status(403).json({ message: 'Only university staff can create event orders' });
    }

    const { event_name, event_date, event_time, member_count, staff_name, staff_email, items } = req.body;

    if (!event_name || !event_date || !event_time || !member_count || !staff_name || !staff_email) {
        return res.status(400).json({ message: 'All event details are required' });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: 'At least one food item is required' });
    }

    // Validate event date is in the future
    const eventDateObj = new Date(event_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (eventDateObj < today) {
        return res.status(400).json({ message: 'Event date must be in the future' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Get user's university_id and wallet balance
        const userResult = await client.query(
            'SELECT university_id, wallet_balance FROM users WHERE id = $1 FOR UPDATE',
            [userId]
        );
        if (userResult.rows.length === 0) throw new Error('User not found');
        const { university_id, wallet_balance } = userResult.rows[0];

        // Calculate total from items
        let totalAmount = 0;
        const validatedItems: any[] = [];

        for (const item of items) {
            if (!item.menu_item_id || !item.quantity || item.quantity < 1) {
                throw new Error('Each item must have menu_item_id and quantity');
            }

            const miResult = await client.query(
                'SELECT id, name, price, is_available, restaurant_id FROM menu_items WHERE id = $1',
                [item.menu_item_id]
            );

            if (miResult.rows.length === 0) throw new Error(`Menu item not found`);
            if (!miResult.rows[0].is_available) throw new Error(`${miResult.rows[0].name} is not available`);

            const price = Number(miResult.rows[0].price);
            totalAmount += price * item.quantity;

            validatedItems.push({
                menu_item_id: item.menu_item_id,
                quantity: item.quantity,
                price_at_time: price,
                item_name: miResult.rows[0].name,
            });
        }

        // Check wallet balance
        const currentBalance = Number(wallet_balance);
        if (currentBalance < totalAmount) {
            throw new Error(`Insufficient wallet balance. Need ₹${totalAmount.toFixed(2)}, have ₹${currentBalance.toFixed(2)}`);
        }

        // Deduct from wallet
        await client.query(
            'UPDATE users SET wallet_balance = wallet_balance - $1 WHERE id = $2',
            [totalAmount, userId]
        );

        // Create event pre-order
        const orderResult = await client.query(
            `INSERT INTO event_pre_orders (user_id, university_id, event_name, event_date, event_time, member_count, staff_name, staff_email, total_amount)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING *`,
            [userId, university_id, event_name, event_date, event_time, member_count, staff_name, staff_email, totalAmount]
        );

        const eventOrder = orderResult.rows[0];

        // Insert items
        for (const item of validatedItems) {
            await client.query(
                `INSERT INTO event_pre_order_items (event_order_id, menu_item_id, quantity, price_at_time)
                 VALUES ($1, $2, $3, $4)`,
                [eventOrder.id, item.menu_item_id, item.quantity, item.price_at_time]
            );
        }

        // Record wallet debit transaction
        await client.query(
            `INSERT INTO wallet_transactions (user_id, amount, type, description, reference_id)
             VALUES ($1, $2, 'debit', $3, $4)`,
            [userId, totalAmount, `Catering: ${event_name}`, eventOrder.id]
        );

        await client.query('COMMIT');

        auditLog({ userId, action: 'EVENT_PRE_ORDER', resource: `event:${eventOrder.id}`, ip: getRequestIp(req) });

        // Send admin notification email (async, non-blocking)
        sendNewEventNotification({
            event_name,
            event_date,
            event_time,
            member_count,
            staff_name,
            staff_email,
            total_amount: totalAmount,
            items: validatedItems,
        }).catch((err: any) => console.error('[EventOrder] Email notification failed:', err.message));

        res.status(201).json({
            ...eventOrder,
            total_amount: Number(eventOrder.total_amount),
            items: validatedItems,
        });
    } catch (error: any) {
        await client.query('ROLLBACK');
        const msg = error.message || 'Failed to create event order';
        console.error('[EventOrder] createEventPreOrder error:', msg);
        res.status(400).json({ message: msg });
    } finally {
        client.release();
    }
};

/** Get my event pre-orders */
export const getMyEventPreOrders = async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;

    try {
        const result = await pool.query(
            `SELECT e.*,
                    COALESCE(json_agg(
                        json_build_object(
                            'id', ei.id,
                            'menu_item_id', ei.menu_item_id,
                            'quantity', ei.quantity,
                            'price_at_time', ei.price_at_time,
                            'item_name', mi.name,
                            'item_image', mi.image_url
                        )
                    ) FILTER (WHERE ei.id IS NOT NULL), '[]') as items
             FROM event_pre_orders e
             LEFT JOIN event_pre_order_items ei ON ei.event_order_id = e.id
             LEFT JOIN menu_items mi ON ei.menu_item_id = mi.id
             WHERE e.user_id = $1
             GROUP BY e.id
             ORDER BY e.event_date DESC
             LIMIT 50`,
            [userId]
        );

        res.json(result.rows.map((r: any) => ({
            ...r,
            total_amount: Number(r.total_amount),
        })));
    } catch (error: any) {
        console.error('[EventOrder] getMyEventPreOrders error:', error.message);
        res.status(500).json({ message: 'Server error' });
    }
};

/** Cancel an upcoming event pre-order */
export const cancelEventPreOrder = async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const { id } = req.params;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const result = await client.query(
            `UPDATE event_pre_orders SET status = 'cancelled'
             WHERE id = $1 AND user_id = $2 AND status IN ('upcoming', 'pending')
             RETURNING *`,
            [id, userId]
        );

        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Event order not found or cannot be cancelled' });
        }

        const order = result.rows[0];
        const refundAmount = Number(order.total_amount);

        // Refund wallet
        if (refundAmount > 0) {
            await client.query(
                'UPDATE users SET wallet_balance = wallet_balance + $1 WHERE id = $2',
                [refundAmount, userId]
            );
            await client.query(
                `INSERT INTO wallet_transactions (user_id, amount, type, description, reference_id)
                 VALUES ($1, $2, 'credit', $3, $4)`,
                [userId, refundAmount, `Refund: Catering cancelled — ${order.event_name}`, order.id]
            );
        }

        await client.query('COMMIT');

        res.json({ message: 'Event order cancelled and refunded', event: order });
    } catch (error: any) {
        await client.query('ROLLBACK');
        console.error('[EventOrder] cancelEventPreOrder error:', error.message);
        res.status(500).json({ message: 'Server error' });
    } finally {
        client.release();
    }
};

/** Update event pre-order status (admin) */
export const updateEventStatus = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { status, rejection_reason } = req.body;

    const validStatuses = ['pending', 'upcoming', 'confirmed', 'preparing', 'completed', 'cancelled', 'approved', 'rejected'];
    if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({ message: `Status must be one of: ${validStatuses.join(', ')}` });
    }

    if (status === 'rejected' && !rejection_reason) {
        return res.status(400).json({ message: 'Rejection reason is required' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        let result;
        if (status === 'rejected') {
            result = await client.query(
                `UPDATE event_pre_orders SET status = $1::"EventStatus", rejection_reason = $2 WHERE id = $3 RETURNING *`,
                [status, rejection_reason, id]
            );
        } else {
            result = await client.query(
                `UPDATE event_pre_orders SET status = $1::"EventStatus", rejection_reason = NULL WHERE id = $2 RETURNING *`,
                [status, id]
            );
        }

        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Event order not found' });
        }

        const order = result.rows[0];

        // Refund wallet on rejection or cancellation
        if (status === 'rejected' || status === 'cancelled') {
            const refundAmount = Number(order.total_amount);
            if (refundAmount > 0) {
                await client.query(
                    'UPDATE users SET wallet_balance = wallet_balance + $1 WHERE id = $2',
                    [refundAmount, order.user_id]
                );
                await client.query(
                    `INSERT INTO wallet_transactions (user_id, amount, type, description, reference_id)
                     VALUES ($1, $2, 'credit', $3, $4)`,
                    [order.user_id, refundAmount, `Refund: Catering ${status} — ${order.event_name}`, order.id]
                );
            }
        }

        await client.query('COMMIT');

        // Send rejection email to staff (async, non-blocking)
        if (status === 'rejected') {
            sendCateringRejectionEmail({
                to: order.staff_email,
                staffName: order.staff_name,
                eventName: order.event_name,
                eventDate: new Date(order.event_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }),
                rejectionReason: rejection_reason,
                totalAmount: Number(order.total_amount),
            }).catch((err: any) => console.error('[EventOrder] Rejection email failed:', err.message));
        }

        res.json({
            ...order,
            total_amount: Number(order.total_amount),
        });
    } catch (error: any) {
        await client.query('ROLLBACK');
        console.error('[EventOrder] updateEventStatus error:', error.message);
        res.status(500).json({ message: 'Server error' });
    } finally {
        client.release();
    }
};

/** Get event menu items (from Club Events restaurant) */
export const getEventMenuItems = async (req: AuthRequest, res: Response) => {
    const { university_id } = req.params;

    try {
        // Find restaurants marked as event/catering restaurants
        const restResult = await pool.query(
            "SELECT id FROM restaurants WHERE university_id = $1 AND is_event_restaurant = true",
            [university_id]
        );

        if (restResult.rows.length === 0) {
            return res.json([]); // No event restaurants yet
        }

        const restaurantIds = restResult.rows.map((r: any) => r.id);

        const result = await pool.query(
            `SELECT id, name, description, price, category, image_url, is_available, stock_quantity
             FROM menu_items
             WHERE restaurant_id = ANY($1) AND is_available = true
             ORDER BY category, name`,
            [restaurantIds]
        );

        res.json(result.rows.map((r: any) => ({
            ...r,
            price: Number(r.price),
        })));
    } catch (error: any) {
        console.error('[EventOrder] getEventMenuItems error:', error.message);
        res.status(500).json({ message: 'Server error' });
    }
};
