import { Router } from 'express';
import { authenticateJWT, authorizeRole } from '../middlewares/authMiddleware';
import { staffLogin, registerStaff } from '../controllers/authController';
import { getAllOrders, getOrderDetails, refundOrder, getPendingOrders, updateOrderStatus, scanOrderByToken } from '../controllers/orderController';
import { createRestaurant, getAllRestaurants, updateRestaurant, deleteRestaurant } from '../controllers/restaurantController';
import { addMenuItem, updateMenuItem, deleteMenuItem } from '../controllers/menuController';

const router = Router();

// ─── Auth (no middleware for login) ───
router.post('/login', staffLogin);

// ─── All routes below require staff/admin JWT ───
router.use(authenticateJWT);

// ─── Orders (Staff + Admin) ───
router.get('/orders/pending', authorizeRole(['staff', 'admin', 'super_admin']), getPendingOrders);
router.get('/orders/scan/:token', authorizeRole(['staff', 'admin', 'super_admin']), scanOrderByToken);
router.patch('/orders/:id/status', authorizeRole(['staff', 'admin', 'super_admin']), updateOrderStatus);

// ─── Orders (Admin only) ───
router.get('/orders', authorizeRole(['admin', 'super_admin']), getAllOrders);
router.get('/orders/:id', authorizeRole(['admin', 'super_admin']), getOrderDetails);
router.post('/orders/:id/refund', authorizeRole(['admin', 'super_admin']), refundOrder);

// ─── Restaurants (Admin only) ───
router.get('/restaurants/:university_id', authorizeRole(['admin', 'super_admin']), getAllRestaurants);
router.post('/restaurants', authorizeRole(['admin', 'super_admin']), createRestaurant);
router.patch('/restaurants/:id', authorizeRole(['admin', 'super_admin']), updateRestaurant);
router.delete('/restaurants/:id', authorizeRole(['admin', 'super_admin']), deleteRestaurant);

// ─── Menu Items (Admin only) ───
router.post('/menu', authorizeRole(['admin', 'super_admin']), addMenuItem);
router.patch('/menu/:id', authorizeRole(['admin', 'super_admin']), updateMenuItem);
router.delete('/menu/:id', authorizeRole(['admin', 'super_admin']), deleteMenuItem);

// ─── Staff Management (Super Admin only) ───
router.post('/staff', authorizeRole(['super_admin']), registerStaff);

export default router;
