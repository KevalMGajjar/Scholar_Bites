import { Router } from 'express';
import { authenticateJWT, authorizeRole } from '../middlewares/authMiddleware';
import { getAllUniversitiesWithStats, getUniversityDetailedStats } from '../controllers/superAdminController';

const router = Router();

// Protect all superadmin routes
router.use(authenticateJWT);
router.use(authorizeRole(['super_admin']));

router.get('/universities', getAllUniversitiesWithStats);
router.get('/universities/:id/statistics', getUniversityDetailedStats);

export default router;
