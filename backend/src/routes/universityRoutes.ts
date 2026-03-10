import { Router } from 'express';
import { createUniversity, getUniversities, searchUniversities } from '../controllers/universityController';
import { authenticateJWT, authorizeRole } from '../middlewares/authMiddleware';

const router = Router();

router.get('/', getUniversities);
router.get('/search', searchUniversities);
router.post('/', authenticateJWT, authorizeRole(['super_admin']), createUniversity);

export default router;
