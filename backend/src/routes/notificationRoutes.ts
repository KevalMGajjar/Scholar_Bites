import { Router } from 'express';
import {
    getNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    registerFcmToken,
} from '../controllers/notificationController';
import { authenticateJWT } from '../middlewares/authMiddleware';
import { validate, registerFcmTokenSchema } from '../middlewares/validators';

const router = Router();

// All notification routes require authentication
router.use(authenticateJWT);

router.get('/', getNotifications);
router.get('/unread-count', getUnreadCount);
router.post('/:id/read', markAsRead);
router.post('/read-all', markAllAsRead);
router.post('/register-token', validate(registerFcmTokenSchema), registerFcmToken);

export default router;
