import { Router } from 'express';
import { createUniversity, getUniversities, getUniversityById, searchUniversities, updateUniversity, getDefaultUniversity } from '../controllers/universityController';
import { authenticateJWT, authorizeRole } from '../middlewares/authMiddleware';
import { upload } from '../controllers/uploadController';

const router = Router();

router.get('/', getUniversities);
router.get('/search', searchUniversities);
router.get('/default', getDefaultUniversity);
router.get('/:id', getUniversityById);
router.post('/', authenticateJWT, authorizeRole(['super_admin']), upload.single('logo'), createUniversity);
router.patch('/:id', authenticateJWT, authorizeRole(['admin', 'super_admin']), upload.single('logo'), updateUniversity);

export default router;
