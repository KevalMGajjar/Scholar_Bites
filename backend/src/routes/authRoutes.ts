import { Router } from 'express';
import { register, login, loginOtp, registerOtp, updateUniversity } from '../controllers/authController';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/login-otp', loginOtp);
router.post('/register-otp', registerOtp);
router.post('/update-university', updateUniversity);

export default router;
