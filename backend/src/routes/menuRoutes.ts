import { Router } from 'express';
import { getMenu, addMenuItem, updateStock } from '../controllers/menuController';
import { authenticateJWT, authorizeRole } from '../middlewares/authMiddleware';

const router = Router();

router.get('/', getMenu);
router.post('/', authenticateJWT, authorizeRole(['admin', 'staff', 'super_admin']), addMenuItem);
router.patch('/:id/stock', authenticateJWT, authorizeRole(['admin', 'staff', 'super_admin']), updateStock);

export default router;
