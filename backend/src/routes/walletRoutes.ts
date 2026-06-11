import express from 'express';
import { getWalletData, createTopUpOrder, verifyTopUp, payOrderWithWallet, redeemCoupon } from '../controllers/walletController';
import { authenticateJWT } from '../middlewares/authMiddleware';
import { validate, topUpSchema, payOrderSchema } from '../middlewares/validators';

const router = express.Router();

router.get('/balance', authenticateJWT, getWalletData);
router.post('/topup/create-order', authenticateJWT, validate(topUpSchema), createTopUpOrder);
router.post('/topup/verify', authenticateJWT, verifyTopUp);
router.post('/pay-order', authenticateJWT, validate(payOrderSchema), payOrderWithWallet);
router.post('/redeem-coupon', authenticateJWT, redeemCoupon);

export default router;
