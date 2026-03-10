import { Router } from 'express';
import { loginOtp, registerOtp, updateUniversity } from '../controllers/authController';

const router = Router();

router.post('/login-otp', loginOtp);
router.post('/register-otp', registerOtp);
router.post('/update-university', updateUniversity);

export default router;
