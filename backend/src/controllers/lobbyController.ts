import { Request, Response } from 'express';
import pool from '../config/db';
import { AuthRequest } from '../middlewares/authMiddleware';
import { v4 as uuidv4 } from 'uuid';
import { emitGroupUpdate, emitNewOrder } from '../services/socketService';
import razorpay from '../config/razorpay';
import crypto from 'crypto';

// Helper to generate 6-char code
const generateCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
};

// ─── Create Group ───
export const createLobby = async (req: AuthRequest, res: Response) => {
    const userId = req.user.id;
    const { nickname } = req.body;

    try {
        const code = generateCode();
        const result = await pool.query(
            "INSERT INTO group_orders (code, creator_id, status) VALUES ($1, $2, 'open') RETURNING *",
            [code, userId]
        );
        const groupOrder = result.rows[0];

        // Add creator as member with nickname
        await pool.query(
            "INSERT INTO group_order_members (group_order_id, user_id, nickname, share_amount, payment_status) VALUES ($1, $2, $3, 0, 'pending')",
            [groupOrder.id, userId, nickname || 'Leader']
        );

        res.status(201).json(groupOrder);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// ─── Join Group ───
export const joinLobby = async (req: AuthRequest, res: Response) => {
    const { code, nickname } = req.body;
    const userId = req.user.id;

    try {
        const groupRes = await pool.query("SELECT * FROM group_orders WHERE code = $1 AND status = 'open'", [code]);
        if (groupRes.rows.length === 0) return res.status(404).json({ message: 'Group not found or locked' });
        const groupOrder = groupRes.rows[0];

        // Check if already joined
        const memberCheck = await pool.query(
            'SELECT * FROM group_order_members WHERE group_order_id = $1 AND user_id = $2',
            [groupOrder.id, userId]
        );

        if (memberCheck.rows.length === 0) {
            await pool.query(
                "INSERT INTO group_order_members (group_order_id, user_id, nickname, share_amount, payment_status) VALUES ($1, $2, $3, 0, 'pending')",
                [groupOrder.id, userId, nickname || 'Member']
            );
            emitGroupUpdate(code, 'member_joined', { userId, nickname: nickname || 'Member' });
        }

        res.json({ message: 'Joined group', groupOrder });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// ─── Get Full Group State ───
export const getLobbyState = async (req: AuthRequest, res: Response) => {
    const { code } = req.params;

    try {
        // Get group order
        const groupRes = await pool.query('SELECT * FROM group_orders WHERE code = $1', [code]);
        if (groupRes.rows.length === 0) return res.status(404).json({ message: 'Group not found' });
        const groupOrder = groupRes.rows[0];

        // Get members with nicknames
        const membersRes = await pool.query(
            `SELECT gom.user_id, gom.nickname, gom.share_amount, gom.payment_status, gom.joined_at
             FROM group_order_members gom
             WHERE gom.group_order_id = $1
             ORDER BY gom.joined_at ASC`,
            [groupOrder.id]
        );

        // Get all items added to this group (across all temp orders)
        const itemsRes = await pool.query(
            `SELECT oi.menu_item_id, oi.quantity, oi.price_at_time,
                    mi.name as item_name, mi.image_url as item_image, mi.category,
                    o.user_id as added_by,
                    r.name as restaurant_name, r.id as restaurant_id
             FROM order_items oi
             JOIN orders o ON oi.order_id = o.id
             JOIN menu_items mi ON oi.menu_item_id = mi.id
             JOIN restaurants r ON mi.restaurant_id = r.id
             WHERE o.group_order_id = $1
             ORDER BY o.created_at ASC`,
            [groupOrder.id]
        );

        res.json({
            id: groupOrder.id,
            code: groupOrder.code,
            creator_id: groupOrder.creator_id,
            status: groupOrder.status,
            total_amount: groupOrder.total_amount,
            created_at: groupOrder.created_at,
            members: membersRes.rows,
            items: itemsRes.rows,
        });
    } catch (error) {
        console.error('getLobbyState error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// ─── Add Item to Group ───
export const addItemToLobby = async (req: AuthRequest, res: Response) => {
    const { code, menu_item_id, quantity } = req.body;
    const userId = req.user.id;

    try {
        const groupRes = await pool.query('SELECT * FROM group_orders WHERE code = $1', [code]);
        if (groupRes.rows.length === 0) return res.status(404).json({ message: 'Group not found' });
        const groupOrder = groupRes.rows[0];

        if (groupOrder.status !== 'open') return res.status(400).json({ message: 'Group is locked' });

        // Get Price + item details
        const itemRes = await pool.query(
            'SELECT mi.price, mi.name, mi.image_url, mi.restaurant_id, r.university_id FROM menu_items mi JOIN restaurants r ON mi.restaurant_id = r.id WHERE mi.id = $1',
            [menu_item_id]
        );
        if (itemRes.rows.length === 0) return res.status(404).json({ message: 'Item not found' });
        const menuItem = itemRes.rows[0];
        const price = parseFloat(menuItem.price);

        // Find existing temp order for this user in this group
        let orderRes = await pool.query(
            "SELECT id FROM orders WHERE group_order_id = $1 AND user_id = $2 AND status = 'pending'",
            [groupOrder.id, userId]
        );

        let orderId;
        if (orderRes.rows.length === 0) {
            // Create new temp order
            const paymentId = `GROUP_${uuidv4()}`;
            const insertRes = await pool.query(
                `INSERT INTO orders (user_id, university_id, restaurant_id, group_order_id, status, total_amount, payment_id)
                 VALUES ($1, $2, $3, $4, 'pending', 0, $5) RETURNING id`,
                [userId, menuItem.university_id, menuItem.restaurant_id, groupOrder.id, paymentId]
            );
            orderId = insertRes.rows[0].id;
        } else {
            orderId = orderRes.rows[0].id;
        }

        // Add item
        await pool.query(
            'INSERT INTO order_items (order_id, menu_item_id, quantity, price_at_time) VALUES ($1, $2, $3, $4)',
            [orderId, menu_item_id, quantity, price]
        );

        // Update order total
        await pool.query(
            'UPDATE orders SET total_amount = total_amount + $1 WHERE id = $2',
            [price * quantity, orderId]
        );

        // Get member nickname for the event
        const nickRes = await pool.query(
            'SELECT nickname FROM group_order_members WHERE group_order_id = $1 AND user_id = $2',
            [groupOrder.id, userId]
        );

        emitGroupUpdate(code, 'item_added', {
            userId,
            nickname: nickRes.rows[0]?.nickname || 'Member',
            menu_item_id,
            item_name: menuItem.name,
            item_image: menuItem.image_url,
            quantity,
            price,
        });

        res.json({ message: 'Item added', item_name: menuItem.name, price, quantity });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// ─── Lock Group (Leader Only) ───
export const lockLobby = async (req: AuthRequest, res: Response) => {
    const { code } = req.body;
    const userId = req.user.id;

    try {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const groupRes = await client.query('SELECT * FROM group_orders WHERE code = $1', [code]);
            if (groupRes.rows.length === 0) throw new Error('Group not found');
            const groupOrder = groupRes.rows[0];

            if (groupOrder.creator_id !== userId && req.user.role !== 'admin') {
                throw new Error('Only the leader can lock the group');
            }

            // Calculate each member's personal total
            const membersRes = await client.query(
                'SELECT user_id, nickname FROM group_order_members WHERE group_order_id = $1',
                [groupOrder.id]
            );
            const members = membersRes.rows;
            if (members.length === 0) throw new Error('No members');

            let totalGroupBill = 0;
            const memberShares: { user_id: string; nickname: string; share: number }[] = [];

            for (const member of members) {
                const personalRes = await client.query(
                    "SELECT COALESCE(SUM(total_amount), 0) as total FROM orders WHERE group_order_id = $1 AND user_id = $2",
                    [groupOrder.id, member.user_id]
                );
                const personalTotal = parseFloat(personalRes.rows[0].total);
                totalGroupBill += personalTotal;

                await client.query(
                    'UPDATE group_order_members SET share_amount = $1 WHERE group_order_id = $2 AND user_id = $3',
                    [personalTotal, groupOrder.id, member.user_id]
                );

                memberShares.push({ user_id: member.user_id, nickname: member.nickname, share: personalTotal });
            }

            // Update group order
            await client.query(
                "UPDATE group_orders SET status = 'locked', total_amount = $1 WHERE id = $2",
                [totalGroupBill, groupOrder.id]
            );

            await client.query('COMMIT');

            emitGroupUpdate(code, 'lobby_locked', { total: totalGroupBill, shares: memberShares });
            res.json({ message: 'Group locked', total: totalGroupBill, shares: memberShares });

        } catch (err: any) {
            await client.query('ROLLBACK');
            res.status(400).json({ message: err.message });
        } finally {
            client.release();
        }
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// ─── Pay Share (Razorpay or Wallet) ───
export const payShare = async (req: AuthRequest, res: Response) => {
    const { code, payment_method } = req.body; // payment_method: 'razorpay' | 'wallet'
    const userId = req.user.id;

    try {
        const groupRes = await pool.query('SELECT * FROM group_orders WHERE code = $1', [code]);
        if (groupRes.rows.length === 0) return res.status(404).json({ message: 'Group not found' });
        const groupOrder = groupRes.rows[0];

        const memberRes = await pool.query(
            'SELECT * FROM group_order_members WHERE group_order_id = $1 AND user_id = $2',
            [groupOrder.id, userId]
        );
        const member = memberRes.rows[0];

        if (!member) return res.status(403).json({ message: 'Not a member' });
        if (Number(member.share_amount) <= 0) return res.status(400).json({ message: 'Nothing to pay' });
        if (member.payment_status === 'paid') return res.status(400).json({ message: 'Already paid' });

        const shareAmount = Number(member.share_amount);

        // ─── Wallet Payment ───
        if (payment_method === 'wallet') {
            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                // Check wallet balance
                const userRes = await client.query('SELECT wallet_balance FROM users WHERE id = $1', [userId]);
                const balance = parseFloat(userRes.rows[0].wallet_balance);

                if (balance < shareAmount) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ message: 'Insufficient wallet balance' });
                }

                // Deduct wallet
                await client.query(
                    'UPDATE users SET wallet_balance = wallet_balance - $1 WHERE id = $2',
                    [shareAmount, userId]
                );

                // Record transaction
                await client.query(
                    "INSERT INTO wallet_transactions (user_id, amount, type, description, reference_id) VALUES ($1, $2, 'debit', $3, $4)",
                    [userId, shareAmount, `Group order share (${code})`, `group_${groupOrder.id}`]
                );

                // Mark as paid
                const walletPaymentId = `wallet_${uuidv4()}`;
                await client.query(
                    "UPDATE group_order_members SET payment_status = 'paid', payment_id = $1 WHERE group_order_id = $2 AND user_id = $3",
                    [walletPaymentId, groupOrder.id, userId]
                );

                await client.query('COMMIT');

                // Check if all paid
                await _checkAllPaid(groupOrder, code, userId);

                return res.json({ status: 'success', payment_method: 'wallet', amount: shareAmount });

            } catch (err: any) {
                await client.query('ROLLBACK');
                return res.status(500).json({ message: err.message });
            } finally {
                client.release();
            }
        }

        // ─── Razorpay Payment ───
        const amountPaise = Math.round(shareAmount * 100);
        let orderId = `mock_group_${crypto.randomBytes(4).toString('hex')}`;

        if (process.env.RAZORPAY_KEY_ID && !process.env.RAZORPAY_KEY_ID.includes('placeholder')) {
            const rzpOrder = await razorpay.orders.create({
                amount: amountPaise,
                currency: 'INR',
                receipt: `share_${member.id}`,
            });
            orderId = rzpOrder.id;
        }

        res.json({
            status: 'razorpay',
            key_id: process.env.RAZORPAY_KEY_ID,
            order_id: orderId,
            amount: shareAmount,
            amount_in_paise: amountPaise,
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// ─── Verify Share Payment (Razorpay callback) ───
export const verifyShare = async (req: AuthRequest, res: Response) => {
    const { code, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const userId = req.user.id;

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
            isValid = razorpay_order_id.startsWith('mock_') && razorpay_signature === 'mock_signature';
        }

        if (!isValid) return res.status(400).json({ status: 'failure', message: 'Invalid signature' });

        const groupRes = await pool.query('SELECT * FROM group_orders WHERE code = $1', [code]);
        const groupOrder = groupRes.rows[0];

        // Update member status
        await pool.query(
            "UPDATE group_order_members SET payment_status = 'paid', payment_id = $1 WHERE group_order_id = $2 AND user_id = $3",
            [razorpay_payment_id, groupOrder.id, userId]
        );

        // Check if all paid
        await _checkAllPaid(groupOrder, code, userId);

        res.json({ status: 'success' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// ─── Internal: Check if all members paid and finalize ───
async function _checkAllPaid(groupOrder: any, code: string, paidUserId: string) {
    const pendingRes = await pool.query(
        "SELECT COUNT(*) FROM group_order_members WHERE group_order_id = $1 AND payment_status != 'paid'",
        [groupOrder.id]
    );
    const pendingCount = parseInt(pendingRes.rows[0].count);

    if (pendingCount === 0) {
        // ALL PAID → Finalize
        await pool.query("UPDATE group_orders SET status = 'paid' WHERE id = $1", [groupOrder.id]);

        // Determine main restaurant (most items) for pickup
        const restaurantRes = await pool.query(
            `SELECT o.restaurant_id, r.name, COUNT(oi.id) as item_count
             FROM orders o
             JOIN order_items oi ON oi.order_id = o.id
             JOIN restaurants r ON o.restaurant_id = r.id
             WHERE o.group_order_id = $1
             GROUP BY o.restaurant_id, r.name
             ORDER BY item_count DESC
             LIMIT 1`,
            [groupOrder.id]
        );

        // Generate order tokens and set status to preparing
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let token = '';
        for (let i = 0; i < 4; i++) token += chars.charAt(Math.floor(Math.random() * chars.length));

        await pool.query(
            "UPDATE orders SET status = 'preparing', order_token = $1, updated_at = NOW() WHERE group_order_id = $2",
            [token, groupOrder.id]
        );

        // Notify kitchen
        const orderRes = await pool.query('SELECT university_id FROM orders WHERE group_order_id = $1 LIMIT 1', [groupOrder.id]);
        if (orderRes.rows.length > 0) {
            emitNewOrder(orderRes.rows[0].university_id, {
                type: 'group_order',
                group_order_id: groupOrder.id,
                total_amount: groupOrder.total_amount,
            });
        }

        const pickupRestaurant = restaurantRes.rows[0]?.name || 'Restaurant';

        emitGroupUpdate(code, 'order_completed', {
            message: 'All paid! Order sent to kitchen.',
            pickup_restaurant: pickupRestaurant,
            order_token: token,
        });
    } else {
        emitGroupUpdate(code, 'member_paid', { userId: paidUserId });
    }
}
