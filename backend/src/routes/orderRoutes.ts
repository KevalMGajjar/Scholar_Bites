import { Router } from 'express';
import { 
    createOrder, verifyPayment, cancelPendingOrder, getMyOrders, 
    getPendingOrders, updateOrderStatus, scanOrderByToken,
    createMultiRestaurantOrder, verifyBatchPayment, getQrToken,
    getSubOrdersByBatch, generateInvoice
} from '../controllers/orderController';
import { authenticateJWT, authorizeRole } from '../middlewares/authMiddleware';

const router = Router();

// ─── Student Endpoints ───
router.post('/', authenticateJWT, createOrder);
router.post('/multi', authenticateJWT, createMultiRestaurantOrder);
router.post('/verify', authenticateJWT, verifyPayment);
router.post('/verify-batch', authenticateJWT, verifyBatchPayment);
router.post('/:id/cancel', authenticateJWT, cancelPendingOrder);
router.get('/my-history', authenticateJWT, getMyOrders);
router.get('/batch/:batchId', authenticateJWT, getSubOrdersByBatch);
router.get('/:id/qr-token', authenticateJWT, getQrToken);
router.get('/:id/invoice', authenticateJWT, generateInvoice);

// ─── Staff/Admin Endpoints ───
router.get('/pending', authenticateJWT, authorizeRole(['staff', 'admin', 'super_admin']), getPendingOrders);
router.patch('/:id/status', authenticateJWT, authorizeRole(['staff', 'admin', 'super_admin']), updateOrderStatus);

export default router;
