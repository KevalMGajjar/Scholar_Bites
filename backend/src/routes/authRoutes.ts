import { Router } from 'express';
import { loginOtp, registerOtp, updateUniversity, logout } from '../controllers/authController';
import { authenticateJWT } from '../middlewares/authMiddleware';

const router = Router();

router.post('/login-otp', loginOtp);
router.post('/register-otp', registerOtp);
router.post('/update-university', updateUniversity);
router.post('/logout', authenticateJWT, logout);

export default router;
