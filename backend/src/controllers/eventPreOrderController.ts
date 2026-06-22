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

    const { event_name, event_date, event_time, member_count, staff_name, staff_email, items, special_requirements } = req.body;

    if (!event_name || !event_date || !event_time || !member_count || !staff_name || !staff_email) {
        return res.status(400).json({ message: 'All event details are required' });
    }

    // Validate the contact email format.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(staff_email).trim())) {
        return res.status(400).json({ message: 'Please enter a valid email address.' });
    }

    const itemsArr = Array.isArray(items) ? items : [];
    const hasCustomOrder = typeof special_requirements === 'string' && special_requirements.trim().length > 0;
    if (itemsArr.length === 0 && !hasCustomOrder) {
        return res.status(400).json({ message: 'Add at least one item or describe a custom order' });
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

        // Calculate total from items + gather lead-time / cutoff rules from each item's category
        let totalAmount = 0;
        let maxLeadTime = 0;                        // minutes of advance notice required
        let earliestCutoff: string | null = null;  // 'HH:MM:SS' same-day ordering deadline
        const validatedItems: any[] = [];

        for (const item of itemsArr) {
            if (!item.menu_item_id || !item.quantity || item.quantity < 1) {
                throw new Error('Each item must have menu_item_id and quantity');
            }

            // Resolve the category by id first, then fall back to matching the legacy
            // category text by name within the same restaurant (items aren't always linked by category_id).
            const miResult = await client.query(
                `SELECT mi.id, mi.name, mi.price, mi.is_available, mi.restaurant_id,
                        COALESCE(c1.lead_time, c2.lead_time)     AS category_lead_time,
                        COALESCE(c1.cutoff_time, c2.cutoff_time) AS category_cutoff_time
                 FROM menu_items mi
                 LEFT JOIN categories c1 ON mi.category_id = c1.id
                 LEFT JOIN categories c2 ON c2.restaurant_id = mi.restaurant_id AND LOWER(c2.name) = LOWER(mi.category)
                 WHERE mi.id = $1`,
                [item.menu_item_id]
            );

            if (miResult.rows.length === 0) throw new Error(`Menu item not found`);
            const row = miResult.rows[0];
            if (!row.is_available) throw new Error(`${row.name} is not available`);

            const lt = Number(row.category_lead_time) || 0;
            if (lt > maxLeadTime) maxLeadTime = lt;
            if (row.category_cutoff_time) {
                const cut = String(row.category_cutoff_time);
                if (!earliestCutoff || cut < earliestCutoff) earliestCutoff = cut;
            }

            const price = Number(row.price);
            totalAmount += price * item.quantity;

            validatedItems.push({
                menu_item_id: item.menu_item_id,
                quantity: item.quantity,
                price_at_time: price,
                item_name: row.name,
            });
        }

        // ── Time rules (catering): per-item lead time + same-day cutoff, all in IST ──
        // We avoid string Date parsing entirely (it depends on the server's timezone)
        // and build absolute epoch millis from the raw numbers via Date.UTC, treating
        // the chosen date/time as IST. This is correct no matter the server timezone.
        const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
        const nowMs = Date.now();
        const nowIST = new Date(nowMs + IST_OFFSET_MS); // read IST wall-clock via UTC getters

        const [ey, emo, ed] = String(event_date).split('-').map(Number);
        const [eh, emin] = String(event_time).slice(0, 5).split(':').map(Number);
        if ([ey, emo, ed, eh, emin].some((n) => Number.isNaN(n))) {
            throw new Error('Invalid event date or time');
        }
        // Absolute epoch of the pickup, where (ey-emo-ed eh:emin) is an IST wall-clock time.
        const pickupMs = Date.UTC(ey, emo - 1, ed, eh, emin, 0) - IST_OFFSET_MS;

        // Is the pickup for today (IST)?
        const isToday = ey === nowIST.getUTCFullYear()
            && (emo - 1) === nowIST.getUTCMonth()
            && ed === nowIST.getUTCDate();

        // 1) Same-day cutoff — checked FIRST so the right message wins for today's
        //    orders. Only applies to today; future dates are never blocked by it.
        if (isToday && earliestCutoff) {
            const [ch, cm] = String(earliestCutoff).split(':').map(Number);
            const nowMins = nowIST.getUTCHours() * 60 + nowIST.getUTCMinutes();
            if (nowMins > (ch * 60 + cm)) {
                throw new Error(`Same-day orders for these items closed at ${String(earliestCutoff).slice(0, 5)}. Please pick another day.`);
            }
        }

        // 2) Only a TODAY pickup can be "in the past". A future date is always valid
        //    date-wise (the lead-time rule below still enforces minimum notice).
        if (isToday && pickupMs <= nowMs) {
            throw new Error('Pickup time must be in the future.');
        }

        // 3) Lead time: pickup must be at least `maxLeadTime` minutes from now.
        if (maxLeadTime > 0 && pickupMs < nowMs + maxLeadTime * 60 * 1000) {
            const h = Math.floor(maxLeadTime / 60);
            const m = maxLeadTime % 60;
            const leadLabel = h > 0 ? `${h} hour${h !== 1 ? 's' : ''}${m ? ` ${m} min` : ''}` : `${m} min`;
            throw new Error(`These items need at least ${leadLabel} of advance notice. Please pick a later time.`);
        }

        // Wallet is only charged for itemised orders. A pure custom order has no
        // price yet — the team quotes it later — so we skip the wallet entirely.
        if (totalAmount > 0) {
            const currentBalance = Number(wallet_balance);
            if (currentBalance < totalAmount) {
                throw new Error(`Insufficient wallet balance. Need ₹${totalAmount.toFixed(2)}, have ₹${currentBalance.toFixed(2)}`);
            }
            await client.query(
                'UPDATE users SET wallet_balance = wallet_balance - $1 WHERE id = $2',
                [totalAmount, userId]
            );
        }

        // Create event pre-order
        const orderResult = await client.query(
            `INSERT INTO event_pre_orders (user_id, university_id, event_name, event_date, event_time, member_count, staff_name, staff_email, total_amount, special_requirements)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             RETURNING *`,
            [userId, university_id, event_name, event_date, event_time, member_count, staff_name, staff_email, totalAmount, (special_requirements?.trim() || null)]
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

        // Record wallet debit transaction (only when an amount was actually charged)
        if (totalAmount > 0) {
            await client.query(
                `INSERT INTO wallet_transactions (user_id, amount, type, description, reference_id)
                 VALUES ($1, $2, 'debit', $3, $4)`,
                [userId, totalAmount, `Catering: ${event_name}`, eventOrder.id]
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
             ORDER BY e.created_at DESC
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

/** Cancel an event pre-order (by the requester) with an optional reason */
export const cancelEventPreOrder = async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const { id } = req.params;
    const { reason } = req.body;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const sel = await client.query(
            `SELECT * FROM event_pre_orders WHERE id = $1 AND user_id = $2 FOR UPDATE`,
            [id, userId]
        );
        if (sel.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Event order not found' });
        }
        const order = sel.rows[0];

        // Cancellable before it's prepared/completed. Includes on_hold (quoted custom orders).
        if (!['upcoming', 'pending', 'on_hold'].includes(order.status)) {
            await client.query('ROLLBACK');
            return res.status(409).json({ message: `This order can no longer be cancelled (status: ${order.status}).` });
        }

        // Refund only money that was actually charged. A custom/on-hold order has been
        // quoted but not paid yet, so there is nothing to refund.
        const wasCharged = order.status !== 'on_hold' && Number(order.total_amount) > 0;
        const refundAmount = wasCharged ? Number(order.total_amount) : 0;

        await client.query(
            `UPDATE event_pre_orders SET status = 'cancelled', cancellation_reason = $1 WHERE id = $2`,
            [(typeof reason === 'string' && reason.trim()) ? reason.trim() : null, id]
        );

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

        auditLog({
            userId,
            action: 'EVENT_PRE_ORDER_CANCELLED',
            resource: `event:${id}`,
            details: refundAmount > 0 ? `Refunded ₹${refundAmount}` : 'No refund (unpaid)',
            ip: getRequestIp(req),
        });

        res.json({
            message: refundAmount > 0 ? 'Order cancelled and refunded' : 'Order cancelled',
            refunded: refundAmount,
        });
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
    const { status, rejection_reason, total_amount } = req.body;

    const validStatuses = ['pending', 'upcoming', 'confirmed', 'preparing', 'completed', 'cancelled', 'approved', 'rejected', 'on_hold'];
    if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({ message: `Status must be one of: ${validStatuses.join(', ')}` });
    }

    if (status === 'rejected' && !rejection_reason) {
        return res.status(400).json({ message: 'Rejection reason is required' });
    }

    // Putting a (custom) order on hold = quoting it: a positive total is mandatory.
    const holdAmount = Number(total_amount);
    if (status === 'on_hold' && (!holdAmount || holdAmount <= 0)) {
        return res.status(400).json({ message: 'A total amount is required to put an order on hold' });
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
        } else if (status === 'on_hold') {
            result = await client.query(
                `UPDATE event_pre_orders SET status = $1::"EventStatus", total_amount = $2, rejection_reason = NULL WHERE id = $3 RETURNING *`,
                [status, holdAmount, id]
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

        auditLog({
            userId: req.user?.id,
            action: 'EVENT_STATUS_UPDATED',
            resource: `event:${id}`,
            details: `status=${status}${total_amount ? `, quoted=₹${total_amount}` : ''}${rejection_reason ? `, reason=${rejection_reason}` : ''}`,
            ip: getRequestIp(req),
        });

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

/** Pay for an on-hold (custom) catering order from the wallet */
export const payEventPreOrder = async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const { id } = req.params;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const orderRes = await client.query(
            'SELECT * FROM event_pre_orders WHERE id = $1 AND user_id = $2 FOR UPDATE',
            [id, userId]
        );
        if (orderRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Catering order not found' });
        }

        const order = orderRes.rows[0];
        if (order.status !== 'on_hold') {
            await client.query('ROLLBACK');
            return res.status(409).json({ message: 'This order is not awaiting payment.' });
        }

        const amount = Number(order.total_amount);
        if (!(amount > 0)) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'This order has no amount to pay yet.' });
        }

        const userRes = await client.query('SELECT wallet_balance FROM users WHERE id = $1 FOR UPDATE', [userId]);
        const balance = Number(userRes.rows[0].wallet_balance);
        if (balance < amount) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                message: `Insufficient wallet balance. Need ₹${amount.toFixed(2)}, have ₹${balance.toFixed(2)}. Redeem a voucher or top up to continue.`,
            });
        }

        await client.query('UPDATE users SET wallet_balance = wallet_balance - $1 WHERE id = $2', [amount, userId]);
        await client.query(
            `INSERT INTO wallet_transactions (user_id, amount, type, description, reference_id)
             VALUES ($1, $2, 'debit', $3, $4)`,
            [userId, amount, `Catering payment: ${order.event_name}`, order.id]
        );
        const updated = await client.query(
            `UPDATE event_pre_orders SET status = 'confirmed'::"EventStatus" WHERE id = $1 RETURNING *`,
            [id]
        );

        await client.query('COMMIT');

        auditLog({ userId, action: 'EVENT_PRE_ORDER', resource: `event:${id}`, details: `Paid ₹${amount.toFixed(2)} for custom catering`, ip: getRequestIp(req) });

        res.json({ ...updated.rows[0], total_amount: Number(updated.rows[0].total_amount) });
    } catch (error: any) {
        await client.query('ROLLBACK');
        console.error('[EventOrder] payEventPreOrder error:', error.message);
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
            `SELECT mi.id, mi.name, mi.description, mi.price, mi.category, mi.image_url,
                    mi.is_available, mi.stock_quantity, mi.category_id, mi.is_veg,
                    c.name as category_name, c.cutoff_time as category_cutoff_time, c.lead_time as category_lead_time
             FROM menu_items mi
             LEFT JOIN categories c ON mi.category_id = c.id
             WHERE mi.restaurant_id = ANY($1) AND mi.is_available = true
             ORDER BY c.name, mi.name`,
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
