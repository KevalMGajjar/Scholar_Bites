import { Router } from 'express';
import { createOrder, verifyPayment, getMyOrders, getPendingOrders, updateOrderStatus, scanOrderByToken } from '../controllers/orderController';
import { authenticateJWT, authorizeRole } from '../middlewares/authMiddleware';

const router = Router();

router.post('/', authenticateJWT, createOrder);
router.post('/verify', authenticateJWT, verifyPayment);
router.get('/my-history', authenticateJWT, getMyOrders);
router.get('/pending', authenticateJWT, authorizeRole(['staff', 'admin', 'super_admin']), getPendingOrders);
router.patch('/:id/status', authenticateJWT, authorizeRole(['staff', 'admin', 'super_admin']), updateOrderStatus);

export default router;
