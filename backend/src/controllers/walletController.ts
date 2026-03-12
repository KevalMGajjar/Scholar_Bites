import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import crypto from 'crypto';
import razorpay from '../config/razorpay';
import pool from '../config/db';

// 1. Get Wallet Balance and History
export const getWalletData = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;

        const userResult = await pool.query(
            'SELECT wallet_balance FROM users WHERE id = $1',
            [userId]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        const txResult = await pool.query(
            'SELECT * FROM wallet_transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
            [userId]
        );

        res.json({
            balance: Number(userResult.rows[0].wallet_balance),
            transactions: txResult.rows.map(tx => ({
                ...tx,
                amount: Number(tx.amount)
            }))
        });
    } catch (error) {
        console.error('getWalletData Error:', error);
        res.status(500).json({ message: 'Server error retrieving wallet data' });
    }
};

// 2. Create Razorpay Top-up Order
export const createTopUpOrder = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const { amount } = req.body; // Amount in rupees
        const parsedAmount = Number(amount);

        if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
            return res.status(400).json({ message: 'Invalid amount' });
        }

        const userResult = await pool.query('SELECT id FROM users WHERE id = $1', [userId]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        const amountInPaise = Math.round(parsedAmount * 100);

        // Generate Razorpay Order
        let razorpayOrderId = `mock_topup_${Date.now()}`;

        if (process.env.RAZORPAY_KEY_ID && !process.env.RAZORPAY_KEY_ID.includes('placeholder')) {
            const options = {
                amount: amountInPaise,
                currency: "INR",
                receipt: `wallet_rcpt_${Date.now()}`,
                payment_capture: 1
            };
            const rzpOrder = await razorpay.orders.create(options);
            razorpayOrderId = rzpOrder.id;
        }

        res.status(200).json({
            payment_id: razorpayOrderId,
            amount: parsedAmount,
            amount_in_paise: amountInPaise,
            currency: 'INR'
        });

    } catch (error: any) {
        console.error('createTopUpOrder Error:', error);
        res.status(500).json({ message: error.message || 'Error generating top-up order' });
    }
};

// 3. Verify Payment and Credit Wallet
export const verifyTopUp = async (req: AuthRequest, res: Response) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount } = req.body;
    const userId = req.user?.id;
    const parsedAmount = Number(amount);

    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ status: 'failure', message: 'Invalid amount' });
    }

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

        if (isValid) {
            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                // Check if reference already exists to prevent double-crediting
                const existingResult = await client.query(
                    'SELECT id FROM wallet_transactions WHERE reference_id = $1',
                    [razorpay_order_id]
                );
                
                if (existingResult.rows.length > 0) {
                    throw new Error('Transaction already processed');
                }

                // Credit User
                const updatedUserResult = await client.query(
                    'UPDATE users SET wallet_balance = wallet_balance + $1 WHERE id = $2 RETURNING wallet_balance',
                    [parsedAmount, userId]
                );
                
                if (updatedUserResult.rows.length === 0) {
                    throw new Error('User not found');
                }

                const updatedBalance = updatedUserResult.rows[0].wallet_balance;

                // Record Transaction
                const txResult = await client.query(
                    `INSERT INTO wallet_transactions (user_id, amount, type, description, reference_id) 
                     VALUES ($1, $2, 'credit', 'Wallet Top-up', $3) RETURNING *`,
                    [userId, parsedAmount, razorpay_order_id]
                );

                await client.query('COMMIT');

                res.json({
                    status: 'success',
                    balance: Number(updatedBalance),
                    transaction: {
                        ...txResult.rows[0],
                        amount: Number(txResult.rows[0].amount)
                    }
                });
            } catch (err: any) {
                await client.query('ROLLBACK');
                throw err;
            } finally {
                client.release();
            }
        } else {
            res.status(400).json({ status: 'failure', message: 'Invalid signature' });
        }
    } catch (error: any) {
        console.error('verifyTopUp Error:', error);
        res.status(500).json({ status: 'failure', message: error.message || 'Payment verification failed' });
    }
};

// 4. Pay for an Order Using Wallet Balance
export const payOrderWithWallet = async (req: AuthRequest, res: Response) => {
    const { order_id } = req.body;
    const userId = req.user?.id;

    if (!order_id) {
        return res.status(400).json({ status: 'failure', message: 'Order ID is required' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Fetch the order and validate ownership + status
        const orderResult = await client.query(
            'SELECT id, total_amount, status, payment_id, user_id, university_id, order_token FROM orders WHERE id = $1',
            [order_id]
        );

        if (orderResult.rows.length === 0) {
            throw new Error('Order not found');
        }

        const order = orderResult.rows[0];

        if (order.user_id !== userId) {
            throw new Error('Unauthorized: This order does not belong to you');
        }

        if (order.status !== 'pending') {
            throw new Error('Order has already been processed');
        }

        const orderAmount = Number(order.total_amount);

        // 2. Check wallet balance
        const userResult = await client.query(
            'SELECT wallet_balance FROM users WHERE id = $1 FOR UPDATE',
            [userId]
        );

        if (userResult.rows.length === 0) {
            throw new Error('User not found');
        }

        const currentBalance = Number(userResult.rows[0].wallet_balance);

        if (currentBalance < orderAmount) {
            throw new Error(`Insufficient wallet balance. You need ₹${orderAmount.toFixed(2)} but have ₹${currentBalance.toFixed(2)}`);
        }

        // 3. Deduct from wallet
        const updatedUserResult = await client.query(
            'UPDATE users SET wallet_balance = wallet_balance - $1 WHERE id = $2 RETURNING wallet_balance',
            [orderAmount, userId]
        );

        const newBalance = Number(updatedUserResult.rows[0].wallet_balance);

        // 4. Record the debit transaction
        await client.query(
            `INSERT INTO wallet_transactions (user_id, amount, type, description, reference_id) 
             VALUES ($1, $2, 'debit', $3, $4)`,
            [userId, orderAmount, `Order Payment #${(order.order_token || order_id).toString().substring(0, 8)}`, order_id]
        );

        // 5. Mark order as preparing (payment complete)
        await client.query(
            "UPDATE orders SET status = 'preparing', updated_at = NOW() WHERE id = $1",
            [order_id]
        );

        await client.query('COMMIT');

        // 6. Emit to staff (import at top if needed)
        try {
            const { emitNewOrder } = require('../services/socketService');
            emitNewOrder(order.university_id, { ...order, status: 'preparing' });
        } catch (_) {
            // Socket service may not be available, ignore
        }

        res.json({
            status: 'success',
            balance: newBalance,
            order_token: order.order_token,
            message: 'Order paid successfully via wallet'
        });

    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error('payOrderWithWallet Error:', err);
        const statusCode = err.message?.includes('Insufficient') ? 400 : 500;
        res.status(statusCode).json({ status: 'failure', message: err.message || 'Wallet payment failed' });
    } finally {
        client.release();
    }
};
