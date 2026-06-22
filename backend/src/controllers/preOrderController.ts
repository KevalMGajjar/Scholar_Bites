import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import pool from '../config/db';
import { auditLog, getRequestIp } from '../services/auditLogger';
import { AHMEDABAD_UNIVERSITY_ID } from '../config/constants';

// ═══════════════════════════════════════════════════════════════
// Staff Pre-Order Controller — Daily meal pre-ordering
// Only accessible by university_staff users
// ═══════════════════════════════════════════════════════════════

/** Create a staff pre-order */
export const createPreOrder = async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const userType = req.user?.user_type;

    if (userType !== 'university_staff') {
        return res.status(403).json({ message: 'Only university staff can create pre-orders' });
    }

    const { restaurant_id, items } = req.body;

    if (!restaurant_id || !items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: 'Restaurant and items are required' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Get university_id + balance. FOR UPDATE locks the user row so two
        // concurrent pre-orders can't both pass the balance check and overdraw
        // the wallet (the deduct below is atomic, but the check above is not).
        const userResult = await client.query(
            'SELECT university_id, wallet_balance FROM users WHERE id = $1 FOR UPDATE',
            [userId]
        );
        if (userResult.rows.length === 0) throw new Error('User not found');

        const { university_id, wallet_balance } = userResult.rows[0];

        // Daily pre-orders are for today and close at the super-admin pickup cutoff (IST).
        const cutoffRes = await client.query(
            'SELECT pre_order_cutoff FROM university_settings WHERE university_id = $1',
            [university_id]
        );
        const cutoff = cutoffRes.rows[0]?.pre_order_cutoff; // 'HH:MM' or null
        if (cutoff) {
            const nowIST = new Date(Date.now() + 5.5 * 60 * 60 * 1000); // IST wall clock via UTC getters
            const nowMins = nowIST.getUTCHours() * 60 + nowIST.getUTCMinutes();
            const [ch, cm] = String(cutoff).split(':').map(Number);
            if (nowMins > (ch * 60 + cm)) {
                throw new Error(`Pre-orders for today close at ${String(cutoff).slice(0, 5)}.`);
            }
        }

        // Validate restaurant exists
        const restResult = await client.query(
            'SELECT id, name, is_open FROM restaurants WHERE id = $1 AND university_id = $2',
            [restaurant_id, university_id]
        );
        if (restResult.rows.length === 0) throw new Error('Restaurant not found');

        // Calculate total and validate items
        let totalAmount = 0;
        const validatedItems: any[] = [];

        for (const item of items) {
            if (!item.menu_item_id || !item.quantity || item.quantity < 1) {
                throw new Error('Each item must have menu_item_id and quantity');
            }

            const miResult = await client.query(
                'SELECT id, name, price, is_available FROM menu_items WHERE id = $1 AND restaurant_id = $2',
                [item.menu_item_id, restaurant_id]
            );

            if (miResult.rows.length === 0) throw new Error(`Menu item not found: ${item.menu_item_id}`);
            if (!miResult.rows[0].is_available) throw new Error(`${miResult.rows[0].name} is not available`);

            const price = Number(miResult.rows[0].price);
            totalAmount += price * item.quantity;

            validatedItems.push({
                menu_item_id: item.menu_item_id,
                quantity: item.quantity,
                price_at_time: price,
            });
        }

        // Check wallet balance
        if (Number(wallet_balance) < totalAmount) {
            throw new Error(`Insufficient wallet balance. Need ₹${totalAmount.toFixed(2)}, have ₹${Number(wallet_balance).toFixed(2)}`);
        }

        // Deduct from wallet
        await client.query(
            'UPDATE users SET wallet_balance = wallet_balance - $1 WHERE id = $2',
            [totalAmount, userId]
        );

        // Record debit transaction
        const orderDate = new Date().toISOString().split('T')[0]; // Today's date

        // Create pre-order
        const orderResult = await client.query(
            `INSERT INTO staff_pre_orders (user_id, university_id, restaurant_id, order_date, total_amount, payment_method)
             VALUES ($1, $2, $3, $4, $5, 'wallet')
             RETURNING *`,
            [userId, university_id, restaurant_id, orderDate, totalAmount]
        );

        const preOrder = orderResult.rows[0];

        // Insert items
        for (const item of validatedItems) {
            await client.query(
                `INSERT INTO staff_pre_order_items (pre_order_id, menu_item_id, quantity, price_at_time)
                 VALUES ($1, $2, $3, $4)`,
                [preOrder.id, item.menu_item_id, item.quantity, item.price_at_time]
            );
        }

        // Record wallet debit
        await client.query(
            `INSERT INTO wallet_transactions (user_id, amount, type, description, reference_id)
             VALUES ($1, $2, 'debit', 'Staff Pre-Order', $3)`,
            [userId, totalAmount, preOrder.id]
        );

        await client.query('COMMIT');

        auditLog({ userId, action: 'STAFF_PRE_ORDER', resource: `pre-order:${preOrder.id}`, ip: getRequestIp(req) });

        res.status(201).json({
            ...preOrder,
            total_amount: Number(preOrder.total_amount),
            items: validatedItems,
        });
    } catch (error: any) {
        await client.query('ROLLBACK');
        const msg = error.message || 'Failed to create pre-order';
        const isClientError = msg.includes('Insufficient') || msg.includes('not found') || msg.includes('not available') || msg.includes('must have');
        console.error('[PreOrder] createPreOrder error:', msg);
        res.status(isClientError ? 400 : 500).json({ message: msg });
    } finally {
        client.release();
    }
};

/** Get my pre-orders */
export const getMyPreOrders = async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;

    try {
        const result = await pool.query(
            `SELECT po.*, r.name as restaurant_name, r.logo_url as restaurant_logo,
                    COALESCE(json_agg(
                        json_build_object(
                            'id', poi.id,
                            'menu_item_id', poi.menu_item_id,
                            'quantity', poi.quantity,
                            'price_at_time', poi.price_at_time,
                            'item_name', mi.name,
                            'item_image', mi.image_url
                        )
                    ) FILTER (WHERE poi.id IS NOT NULL), '[]') as items
             FROM staff_pre_orders po
             LEFT JOIN restaurants r ON po.restaurant_id = r.id
             LEFT JOIN staff_pre_order_items poi ON poi.pre_order_id = po.id
             LEFT JOIN menu_items mi ON poi.menu_item_id = mi.id
             WHERE po.user_id = $1
             GROUP BY po.id, r.name, r.logo_url
             ORDER BY po.created_at DESC
             LIMIT 50`,
            [userId]
        );

        res.json(result.rows.map((r: any) => ({
            ...r,
            total_amount: Number(r.total_amount),
        })));
    } catch (error: any) {
        console.error('[PreOrder] getMyPreOrders error:', error.message);
        res.status(500).json({ message: 'Server error' });
    }
};

/** Cancel a pending pre-order */
export const cancelPreOrder = async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const { id } = req.params;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // FOR UPDATE serialises concurrent cancels of the same pre-order. Without
        // it, two requests both see status='pending' and BOTH refund the wallet
        // (double refund). With it, the second waits, then sees status no longer
        // 'pending' → 0 rows → 404, so the refund happens exactly once.
        const result = await client.query(
            "SELECT * FROM staff_pre_orders WHERE id = $1 AND user_id = $2 AND status = 'pending' FOR UPDATE",
            [id, userId]
        );

        if (result.rows.length === 0) {
            await client.query('ROLLBACK'); // close the open transaction on this path
            return res.status(404).json({ message: 'Pre-order not found or cannot be cancelled' });
        }

        const preOrder = result.rows[0];
        const refundAmount = Number(preOrder.total_amount);

        // Refund to wallet
        await client.query(
            'UPDATE users SET wallet_balance = wallet_balance + $1 WHERE id = $2',
            [refundAmount, userId]
        );

        // Record refund transaction
        await client.query(
            `INSERT INTO wallet_transactions (user_id, amount, type, description, reference_id)
             VALUES ($1, $2, 'refund', 'Pre-Order Cancelled', $3)`,
            [userId, refundAmount, id]
        );

        // Mark as cancelled
        await client.query(
            "UPDATE staff_pre_orders SET status = 'cancelled' WHERE id = $1",
            [id]
        );

        await client.query('COMMIT');

        res.json({ message: 'Pre-order cancelled and refunded', refund_amount: refundAmount });
    } catch (error: any) {
        await client.query('ROLLBACK');
        console.error('[PreOrder] cancelPreOrder error:', error.message);
        res.status(500).json({ message: 'Server error' });
    } finally {
        client.release();
    }
};

// ═══════════════════════════════════════════════════════════════
// Admin Pre-Order Views
// ═══════════════════════════════════════════════════════════════

/** Get all pre-orders for today (admin view) */
export const getTodayPreOrders = async (req: AuthRequest, res: Response) => {
    try {
        const today = new Date().toISOString().split('T')[0];

        const result = await pool.query(
            `SELECT po.*, u.name as user_name, u.phone as user_phone,
                    r.name as restaurant_name,
                    COALESCE(json_agg(
                        json_build_object(
                            'id', poi.id,
                            'menu_item_id', poi.menu_item_id,
                            'quantity', poi.quantity,
                            'price_at_time', poi.price_at_time,
                            'item_name', mi.name
                        )
                    ) FILTER (WHERE poi.id IS NOT NULL), '[]') as items
             FROM staff_pre_orders po
             LEFT JOIN users u ON po.user_id = u.id
             LEFT JOIN restaurants r ON po.restaurant_id = r.id
             LEFT JOIN staff_pre_order_items poi ON poi.pre_order_id = po.id
             LEFT JOIN menu_items mi ON poi.menu_item_id = mi.id
             WHERE po.order_date = $1 AND po.university_id = $2
             GROUP BY po.id, u.name, u.phone, r.name
             ORDER BY po.created_at ASC`,
            [today, AHMEDABAD_UNIVERSITY_ID]
        );

        res.json(result.rows.map((r: any) => ({
            ...r,
            total_amount: Number(r.total_amount),
        })));
    } catch (error: any) {
        console.error('[PreOrder] getTodayPreOrders error:', error.message);
        res.status(500).json({ message: 'Server error' });
    }
};

/** Get all staff pre-orders (admin, paginated, restaurant-scoped for staff).
 *  Powers the "Pre-Orders" filter in Order History. */
export const getAdminPreOrders = async (req: AuthRequest, res: Response) => {
    const { restaurant_id, page = '1', limit = '20' } = req.query;
    try {
        const staffRes = await pool.query('SELECT university_id, restaurant_id, role FROM staff WHERE id = $1', [req.user.id]);
        if (staffRes.rows.length === 0) return res.sendStatus(403);
        const uniId = staffRes.rows[0].university_id;
        const staffRole = staffRes.rows[0].role;
        const staffRestaurantId = staffRes.rows[0].restaurant_id;

        // Staff are restricted to their own restaurant; admins may filter optionally.
        let effectiveRestaurantId: any = restaurant_id;
        if (staffRole === 'staff') {
            if (!staffRestaurantId) return res.status(403).json({ message: 'Staff member not assigned to a restaurant' });
            effectiveRestaurantId = staffRestaurantId;
        }

        const params: any[] = [uniId];
        let restaurantClause = '';
        if (effectiveRestaurantId) {
            restaurantClause = ` AND po.restaurant_id = $${params.length + 1}`;
            params.push(effectiveRestaurantId);
        }

        const lim = parseInt(limit as string) || 20;
        const off = ((parseInt(page as string) || 1) - 1) * lim;

        const result = await pool.query(
            `SELECT po.*, u.name as user_name, u.phone as user_phone, r.name as restaurant_name,
                    COALESCE(json_agg(json_build_object(
                        'id', poi.id, 'menu_item_id', poi.menu_item_id, 'quantity', poi.quantity,
                        'price_at_time', poi.price_at_time, 'item_name', mi.name
                    )) FILTER (WHERE poi.id IS NOT NULL), '[]') as items
             FROM staff_pre_orders po
             LEFT JOIN users u ON po.user_id = u.id
             LEFT JOIN restaurants r ON po.restaurant_id = r.id
             LEFT JOIN staff_pre_order_items poi ON poi.pre_order_id = po.id
             LEFT JOIN menu_items mi ON poi.menu_item_id = mi.id
             WHERE po.university_id = $1${restaurantClause}
             GROUP BY po.id, u.name, u.phone, r.name
             ORDER BY po.created_at DESC
             LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
            [...params, lim, off]
        );

        const countParams: any[] = [uniId];
        let countClause = '';
        if (effectiveRestaurantId) { countClause = ` AND restaurant_id = $2`; countParams.push(effectiveRestaurantId); }
        const countRes = await pool.query(
            `SELECT COUNT(*) FROM staff_pre_orders WHERE university_id = $1${countClause}`, countParams
        );

        res.json({
            orders: result.rows.map((r: any) => ({ ...r, total_amount: Number(r.total_amount), is_pre_order: true })),
            total: parseInt(countRes.rows[0].count),
        });
    } catch (error: any) {
        console.error('[PreOrder] getAdminPreOrders error:', error.message);
        res.status(500).json({ message: 'Server error' });
    }
};

/** Update pre-order status (admin) */
export const updatePreOrderStatus = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled'];
    if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({ message: `Status must be one of: ${validStatuses.join(', ')}` });
    }

    try {
        const result = await pool.query(
            `UPDATE staff_pre_orders SET status = $1::\"PreOrderStatus\" WHERE id = $2 RETURNING *`,
            [status, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Pre-order not found' });
        }

        res.json({
            ...result.rows[0],
            total_amount: Number(result.rows[0].total_amount),
        });
    } catch (error: any) {
        console.error('[PreOrder] updatePreOrderStatus error:', error.message);
        res.status(500).json({ message: 'Server error' });
    }
};
