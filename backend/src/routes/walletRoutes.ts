import express from 'express';
import { getWalletData, createTopUpOrder, verifyTopUp } from '../controllers/walletController';
import { authenticateJWT } from '../middlewares/authMiddleware';

const router = express.Router();

router.get('/balance', authenticateJWT, getWalletData);
router.post('/topup/create-order', authenticateJWT, createTopUpOrder);
router.post('/topup/verify', authenticateJWT, verifyTopUp);

export default router;
