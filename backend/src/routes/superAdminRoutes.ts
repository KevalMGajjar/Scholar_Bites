import { Router } from 'express';
import { authenticateJWT, authorizeRole } from '../middlewares/authMiddleware';
import { getSystemHealth, getStaffMembers, getStaffAnalytics, addStaffMember, updateStaffMember, deleteStaffMember, getAuditLogs, getLockedAccountsList, unlockAccountHandler, getRestaurantsForLimits, updateRestaurantPrepLimit } from '../controllers/superAdminController';
import { getUniversityStaff, createUniversityStaff, bulkCreateUniversityStaff, deleteUniversityStaff, getDeansList, updateUniversityStaff } from '../controllers/universityStaffController';
import { getServiceHealth, getStuckOrders, resolveStuckOrder, sendBroadcast } from '../controllers/systemOpsController';
import { validateUuidParams } from '../middlewares/security';

const router = Router();

// Protect all superadmin routes
router.use(authenticateJWT);
router.use(authorizeRole(['super_admin']));

router.get('/system-health', getSystemHealth);
router.get('/staff', getStaffMembers);
router.post('/staff', addStaffMember);
router.put('/staff/:id', validateUuidParams('id'), updateStaffMember);
router.delete('/staff/:id', deleteStaffMember);
router.get('/staff/:id/analytics', getStaffAnalytics);
router.get('/audit-logs', getAuditLogs);

// ─── Account Lockout Management ───
router.get('/locked-accounts', getLockedAccountsList);
router.post('/unlock-account', unlockAccountHandler);

// ─── System Operations (fix-it-fast tooling) ───
router.get('/service-health', getServiceHealth);
router.get('/stuck-orders', getStuckOrders);
router.post('/stuck-orders/:id/resolve', validateUuidParams('id'), resolveStuckOrder);
router.post('/broadcast', sendBroadcast);

// ─── Per-restaurant preparing limits ───
router.get('/restaurants', getRestaurantsForLimits);
router.patch('/restaurants/:id/prep-limit', validateUuidParams('id'), updateRestaurantPrepLimit);

// ─── University Staff Management ───
router.get('/university-staff', getUniversityStaff);
router.post('/university-staff', createUniversityStaff);
router.post('/university-staff/bulk', bulkCreateUniversityStaff);
router.delete('/university-staff/:id', deleteUniversityStaff);
router.put('/university-staff/:id', updateUniversityStaff);
router.get('/deans-list', getDeansList);

export default router;
