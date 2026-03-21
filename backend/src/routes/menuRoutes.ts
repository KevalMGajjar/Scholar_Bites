import { Router } from 'express';
import { getMenu, addMenuItem, updateStock, getTrendingItems, checkAvailability } from '../controllers/menuController';
import { submitReview, getItemRating } from '../controllers/reviewController';
import { authenticateJWT, authorizeRole } from '../middlewares/authMiddleware';

const router = Router();

router.get('/', getMenu);
router.get('/trending/:university_id', getTrendingItems);
router.post('/check-availability', checkAvailability);
router.post('/', authenticateJWT, authorizeRole(['admin', 'staff', 'super_admin']), addMenuItem);
router.patch('/:id/stock', authenticateJWT, authorizeRole(['admin', 'staff', 'super_admin']), updateStock);

// ─── Reviews ───
router.post('/reviews', authenticateJWT, submitReview);
router.get('/reviews/:menu_item_id', authenticateJWT, getItemRating);

export default router;
