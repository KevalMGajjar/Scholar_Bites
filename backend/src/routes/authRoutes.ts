import { Router } from 'express';
import { loginOtp, registerOtp, updateUniversity, logout } from '../controllers/authController';
import { authenticateJWT } from '../middlewares/authMiddleware';
import { validate, loginOtpSchema, registerOtpSchema, updateUniversitySchema } from '../middlewares/validators';

const router = Router();

// ─── Phone OTP Auth (Students + Staff — unified) ───
router.post('/login-otp', validate(loginOtpSchema), loginOtp);
router.post('/register-otp', validate(registerOtpSchema), registerOtp);
router.post('/update-university', authenticateJWT, validate(updateUniversitySchema), updateUniversity);
router.post('/logout', authenticateJWT, logout);

export default router;
