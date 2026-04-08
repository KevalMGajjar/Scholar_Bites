import { Router } from 'express';
import { authenticateJWT, authorizeRole } from '../middlewares/authMiddleware';
import { staffLogin, verifyLoginOtp, googleLogin, registerStaff, requestPasswordOtp, verifyOtpAndChangePassword, getStaffByUniversity, deleteStaff } from '../controllers/authController';
import { getAllOrders, getOrderDetails, requestRefund, getRefundRequests, approveRefund, rejectRefund, getPendingOrders, updateOrderStatus, scanOrderByToken, generateInvoice } from '../controllers/orderController';
import { createRestaurant, getAllRestaurants, updateRestaurant, deleteRestaurant } from '../controllers/restaurantController';
import { addMenuItem, updateMenuItem, deleteMenuItem } from '../controllers/menuController';
import { upload } from '../controllers/uploadController';
import { getStatistics } from '../controllers/statisticsController';
import { createDean, getAllDeans, updateDeanBudget, updateDeanDetails, deleteDean, getAllEvents, getEventsCalendar, exportEventsCSV, getDeanFundDistribution, exportFundDistributionCSV } from '../controllers/deanController';
import { getTodayPreOrders, updatePreOrderStatus } from '../controllers/preOrderController';
import { updateEventStatus } from '../controllers/eventPreOrderController';
import { getUniversitySettings, updateUniversitySettings } from '../controllers/staffAuthController';

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
router.get('/orders/:id/invoice', authorizeRole(['staff', 'admin', 'super_admin']), generateInvoice);

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
router.get('/statistics', authorizeRole(['staff', 'admin', 'super_admin']), getStatistics);

// ─── Staff Management (Admin + Super Admin) ───
router.get('/staff/:university_id', authorizeRole(['admin', 'super_admin']), getStaffByUniversity);
router.post('/staff', authorizeRole(['admin', 'super_admin']), registerStaff);
router.delete('/staff/:id', authorizeRole(['admin', 'super_admin']), deleteStaff);

// ─── Password Change via OTP (Self-service for any authenticated staff) ───
router.post('/password/request-otp', requestPasswordOtp);
router.post('/password/verify-and-change', verifyOtpAndChangePassword);

// ─── University Settings (Admin + Super Admin) ───
router.get('/settings/:university_id', authorizeRole(['admin', 'super_admin']), getUniversitySettings);
router.patch('/settings/:university_id', authorizeRole(['admin', 'super_admin']), updateUniversitySettings);

// ─── Dean Management (Admin only) ───
router.post('/deans', authorizeRole(['admin', 'super_admin']), createDean);
router.get('/deans', authorizeRole(['admin', 'super_admin']), getAllDeans);
router.patch('/deans/:id/budget', authorizeRole(['admin', 'super_admin']), updateDeanBudget);
router.put('/deans/:id', authorizeRole(['admin', 'super_admin']), updateDeanDetails);
router.delete('/deans/:id', authorizeRole(['admin', 'super_admin']), deleteDean);
router.get('/deans/:id/fund-distribution', authorizeRole(['admin', 'super_admin']), getDeanFundDistribution);
router.get('/deans/:id/fund-distribution/export', authorizeRole(['admin', 'super_admin']), exportFundDistributionCSV);

// ─── Event Management (Admin only) ───
router.get('/events', authorizeRole(['admin', 'super_admin']), getAllEvents);
router.get('/events/calendar', authorizeRole(['admin', 'super_admin']), getEventsCalendar);
router.get('/events/export', authorizeRole(['admin', 'super_admin']), exportEventsCSV);
router.patch('/events/:id/status', authorizeRole(['admin', 'super_admin']), updateEventStatus);

// ─── Pre-Order Management (Admin only) ───
router.get('/pre-orders/today', authorizeRole(['admin', 'super_admin']), getTodayPreOrders);
router.patch('/pre-orders/:id/status', authorizeRole(['admin', 'super_admin']), updatePreOrderStatus);

export default router;
