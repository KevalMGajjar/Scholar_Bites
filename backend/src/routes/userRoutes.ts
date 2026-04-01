import { Router } from 'express';
import { getFavorites, syncFavorites, toggleFavorite } from '../controllers/userController';
import { authenticateJWT } from '../middlewares/authMiddleware';

const router = Router();

// All user routes require authentication
router.use(authenticateJWT);

// ─── Favorites ───
router.get('/favorites', getFavorites);
router.post('/favorites/sync', syncFavorites);
router.post('/favorites/toggle', toggleFavorite);

export default router;
