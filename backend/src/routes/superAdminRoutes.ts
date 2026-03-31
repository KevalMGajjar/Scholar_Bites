import { Router } from 'express';
import { authenticateJWT, authorizeRole } from '../middlewares/authMiddleware';
import { getSystemHealth, getStaffMembers, getStaffAnalytics, addStaffMember, getAuditLogs, getLockedAccountsList, unlockAccountHandler } from '../controllers/superAdminController';

const router = Router();

// Protect all superadmin routes
router.use(authenticateJWT);
router.use(authorizeRole(['super_admin']));

router.get('/system-health', getSystemHealth);
router.get('/staff', getStaffMembers);
router.post('/staff', addStaffMember);
router.get('/staff/:id/analytics', getStaffAnalytics);
router.get('/audit-logs', getAuditLogs);

// ─── Account Lockout Management ───
router.get('/locked-accounts', getLockedAccountsList);
router.post('/unlock-account', unlockAccountHandler);

export default router;
