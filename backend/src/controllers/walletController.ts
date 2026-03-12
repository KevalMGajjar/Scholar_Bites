import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import crypto from 'crypto';
import razorpay from '../config/razorpay';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 1. Get Wallet Balance and History
export const getWalletData = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { wallet_balance: true }
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const transactions = await prisma.walletTransaction.findMany({
            where: { user_id: userId },
            orderBy: { created_at: 'desc' },
            take: 50
        });

        res.json({
            balance: user.wallet_balance,
            transactions: transactions
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

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return res.status(404).json({ message: 'User not found' });

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
            // Use transaction to ensure balance and history add atomically
            const result = await prisma.$transaction(async (tx) => {
                // Check if reference already exists to prevent double-crediting
                const existing = await tx.walletTransaction.findFirst({
                    where: { reference_id: razorpay_order_id }
                });
                
                if (existing) {
                    throw new Error('Transaction already processed');
                }

                // Credit User
                const updatedUser = await tx.user.update({
                    where: { id: userId },
                    data: {
                        wallet_balance: {
                            increment: parsedAmount
                        }
                    }
                });

                // Record Transaction
                const transaction = await tx.walletTransaction.create({
                    data: {
                        user_id: userId!,
                        amount: parsedAmount,
                        type: 'credit',
                        description: 'Wallet Top-up',
                        reference_id: razorpay_order_id
                    }
                });

                return { updatedUser, transaction };
            });

            res.json({
                status: 'success',
                balance: result.updatedUser.wallet_balance,
                transaction: result.transaction
            });
        } else {
            res.status(400).json({ status: 'failure', message: 'Invalid signature' });
        }
    } catch (error: any) {
        console.error('verifyTopUp Error:', error);
        res.status(500).json({ status: 'failure', message: error.message || 'Payment verification failed' });
    }
};
