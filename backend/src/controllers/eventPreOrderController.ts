import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import pool from '../config/db';
import { auditLog, getRequestIp } from '../services/auditLogger';
import { sendNewEventNotification } from '../services/emailService';

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

        // Get user's university_id
        const userResult = await client.query(
            'SELECT university_id FROM users WHERE id = $1',
            [userId]
        );
        if (userResult.rows.length === 0) throw new Error('User not found');
        const { university_id } = userResult.rows[0];

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

    try {
        const result = await pool.query(
            `UPDATE event_pre_orders SET status = 'cancelled'
             WHERE id = $1 AND user_id = $2 AND status = 'upcoming'
             RETURNING *`,
            [id, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Event order not found or cannot be cancelled' });
        }

        res.json({ message: 'Event order cancelled', event: result.rows[0] });
    } catch (error: any) {
        console.error('[EventOrder] cancelEventPreOrder error:', error.message);
        res.status(500).json({ message: 'Server error' });
    }
};

/** Update event pre-order status (admin) */
export const updateEventStatus = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['upcoming', 'confirmed', 'preparing', 'completed', 'cancelled'];
    if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({ message: `Status must be one of: ${validStatuses.join(', ')}` });
    }

    try {
        const result = await pool.query(
            `UPDATE event_pre_orders SET status = $1::\"EventStatus\" WHERE id = $2 RETURNING *`,
            [status, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Event order not found' });
        }

        res.json({
            ...result.rows[0],
            total_amount: Number(result.rows[0].total_amount),
        });
    } catch (error: any) {
        console.error('[EventOrder] updateEventStatus error:', error.message);
        res.status(500).json({ message: 'Server error' });
    }
};

/** Get event menu items (from Club Events restaurant) */
export const getEventMenuItems = async (req: AuthRequest, res: Response) => {
    const { university_id } = req.params;

    try {
        // Find the "Club Events" or "Event Management" restaurant
        const restResult = await pool.query(
            "SELECT id FROM restaurants WHERE university_id = $1 AND (name ILIKE '%Club Events%' OR name ILIKE '%Event Management%')",
            [university_id]
        );

        if (restResult.rows.length === 0) {
            return res.json([]); // No Club Events restaurant yet
        }

        const restaurantId = restResult.rows[0].id;

        const result = await pool.query(
            `SELECT id, name, description, price, category, image_url, is_available, stock_quantity
             FROM menu_items
             WHERE restaurant_id = $1 AND is_available = true
             ORDER BY category, name`,
            [restaurantId]
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
