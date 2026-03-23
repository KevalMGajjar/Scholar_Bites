import { Router } from 'express';
import { authenticateJWT, authorizeRole } from '../middlewares/authMiddleware';
import { staffLogin, verifyLoginOtp, googleLogin, registerStaff, requestPasswordOtp, verifyOtpAndChangePassword, getStaffByUniversity, deleteStaff } from '../controllers/authController';
import { getAllOrders, getOrderDetails, requestRefund, getRefundRequests, approveRefund, rejectRefund, getPendingOrders, updateOrderStatus, scanOrderByToken } from '../controllers/orderController';
import { createRestaurant, getAllRestaurants, updateRestaurant, deleteRestaurant } from '../controllers/restaurantController';
import { addMenuItem, updateMenuItem, deleteMenuItem } from '../controllers/menuController';
import { upload } from '../controllers/uploadController';
import { getStatistics } from '../controllers/statisticsController';

const router = Router();

// ─── Auth (no middleware for login) ───
router.post('/login', staffLogin);
router.post('/login/verify-otp', verifyLoginOtp);
router.post('/login/google', googleLogin);

// ─── All routes below require staff/admin JWT ───
router.use(authenticateJWT);

// ─── Orders (Staff + Admin) ───
router.get('/orders/pending', authorizeRole(['staff', 'admin', 'super_admin']), getPendingOrders);
router.get('/orders/scan/:token', authorizeRole(['staff', 'admin', 'super_admin']), scanOrderByToken);
router.patch('/orders/:id/status', authorizeRole(['staff', 'admin', 'super_admin']), updateOrderStatus);

// ─── Orders (Admin only) ───
router.get('/orders', authorizeRole(['admin', 'super_admin']), getAllOrders);
router.get('/orders/:id', authorizeRole(['admin', 'super_admin']), getOrderDetails);

// ─── Refund Workflow ───
router.post('/orders/:id/request-refund', authorizeRole(['staff', 'admin', 'super_admin']), requestRefund);
router.get('/refund-requests', authorizeRole(['super_admin']), getRefundRequests);
router.post('/refund-requests/:id/approve', authorizeRole(['super_admin']), approveRefund);
router.post('/refund-requests/:id/reject', authorizeRole(['super_admin']), rejectRefund);

// ─── Restaurants (Admin only) ───
router.get('/restaurants/:university_id', authorizeRole(['admin', 'super_admin']), getAllRestaurants);
router.post('/restaurants', authorizeRole(['admin', 'super_admin']), upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'cover', maxCount: 1 }]), createRestaurant);
router.patch('/restaurants/:id', authorizeRole(['admin', 'super_admin']), upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'cover', maxCount: 1 }]), updateRestaurant);
router.delete('/restaurants/:id', authorizeRole(['admin', 'super_admin']), deleteRestaurant);

// ─── Menu Items (Admin only) ───
router.post('/menu', authorizeRole(['admin', 'super_admin']), upload.single('image'), addMenuItem);
router.patch('/menu/:id', authorizeRole(['admin', 'super_admin']), upload.single('image'), updateMenuItem);
router.delete('/menu/:id', authorizeRole(['admin', 'super_admin']), deleteMenuItem);

// ─── Statistics (Admin only) ───
router.get('/statistics', authorizeRole(['admin', 'super_admin']), getStatistics);

// ─── Staff Management (Admin + Super Admin) ───
router.get('/staff/:university_id', authorizeRole(['admin', 'super_admin']), getStaffByUniversity);
router.post('/staff', authorizeRole(['admin', 'super_admin']), registerStaff);
router.delete('/staff/:id', authorizeRole(['admin', 'super_admin']), deleteStaff);

// ─── Password Change via OTP (Self-service for any authenticated staff) ───
router.post('/password/request-otp', requestPasswordOtp);
router.post('/password/verify-and-change', verifyOtpAndChangePassword);

export default router;
