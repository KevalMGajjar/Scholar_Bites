import { Router } from 'express';
import { authenticateJWT } from '../middlewares/authMiddleware';
import { createPreOrder, getMyPreOrders, cancelPreOrder } from '../controllers/preOrderController';
import { createEventPreOrder, getMyEventPreOrders, cancelEventPreOrder, getEventMenuItems } from '../controllers/eventPreOrderController';
import { redeemCoupon } from '../controllers/walletController';

const router = Router();

// All routes require authentication
router.use(authenticateJWT);

// ─── Staff Pre-Orders (Daily Meals) ───
router.post('/pre-orders', createPreOrder);
router.get('/pre-orders/my', getMyPreOrders);
router.patch('/pre-orders/:id/cancel', cancelPreOrder);

// ─── Event Pre-Orders (Catering) ───
router.post('/event-orders', createEventPreOrder);
router.get('/event-orders/my', getMyEventPreOrders);
router.patch('/event-orders/:id/cancel', cancelEventPreOrder);
router.get('/event-menu/:university_id', getEventMenuItems);

export default router;
