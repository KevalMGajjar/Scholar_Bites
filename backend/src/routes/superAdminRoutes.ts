import { Router } from 'express';
import { authenticateJWT, authorizeRole } from '../middlewares/authMiddleware';
import { getSystemHealth, getStaffMembers, getStaffAnalytics, addStaffMember, deleteStaffMember, getAuditLogs, getLockedAccountsList, unlockAccountHandler } from '../controllers/superAdminController';
import { getUniversityStaff, createUniversityStaff, bulkCreateUniversityStaff, deleteUniversityStaff } from '../controllers/universityStaffController';

const router = Router();

// Protect all superadmin routes
router.use(authenticateJWT);
router.use(authorizeRole(['super_admin']));

router.get('/system-health', getSystemHealth);
router.get('/staff', getStaffMembers);
router.post('/staff', addStaffMember);
router.delete('/staff/:id', deleteStaffMember);
router.get('/staff/:id/analytics', getStaffAnalytics);
router.get('/audit-logs', getAuditLogs);

// ─── Account Lockout Management ───
router.get('/locked-accounts', getLockedAccountsList);
router.post('/unlock-account', unlockAccountHandler);

// ─── University Staff Management ───
router.get('/university-staff', getUniversityStaff);
router.post('/university-staff', createUniversityStaff);
router.post('/university-staff/bulk', bulkCreateUniversityStaff);
router.delete('/university-staff/:id', deleteUniversityStaff);

export default router;
