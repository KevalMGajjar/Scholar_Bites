import { Router } from 'express';
import { loginOtp, registerOtp, updateUniversity, logout } from '../controllers/authController';
import { verifyStaffCode, loginOtpStaff, registerOtpStaff } from '../controllers/staffAuthController';
import { authenticateJWT } from '../middlewares/authMiddleware';

const router = Router();

// ─── Student Auth (Phone OTP) ───
router.post('/login-otp', loginOtp);
router.post('/register-otp', registerOtp);
router.post('/update-university', authenticateJWT, updateUniversity);
router.post('/logout', authenticateJWT, logout);

// ─── University Staff Auth (Code + Phone OTP) ───
router.post('/verify-staff-code', verifyStaffCode);
router.post('/login-otp-staff', loginOtpStaff);
router.post('/register-otp-staff', registerOtpStaff);

export default router;
