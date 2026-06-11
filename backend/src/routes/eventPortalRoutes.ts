import { Router } from 'express';
import { authenticateJWT, authorizeRole } from '../middlewares/authMiddleware';
import rateLimit from 'express-rate-limit';
import { deanLogin, getDeanProfile, generateCoupon, getDeanCoupons, revokeCoupon, getFundDistribution, exportFundDistributionCSV } from '../controllers/deanPortalController';

const router = Router();

// Rate limiting for dean login
const deanLoginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    message: { message: 'Too many login attempts. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// ─── Dean Auth ───
router.post('/login', deanLoginLimiter, deanLogin);

// ─── Dean JWT middleware (validates dean role) ───
const authenticateDean = async (req: any, res: any, next: any) => {
    // Reuse the standard JWT middleware
    authenticateJWT(req, res, () => {
        if (req.user?.role !== 'dean') {
            return res.status(403).json({ message: 'Access denied. Dean role required.' });
        }
        next();
    });
};

// ─── Protected Dean Routes ───
router.get('/profile', authenticateDean, getDeanProfile);
router.post('/coupons', authenticateDean, generateCoupon);
router.get('/coupons', authenticateDean, getDeanCoupons);
router.patch('/coupons/:id/revoke', authenticateDean, revokeCoupon);
router.get('/fund-distribution', authenticateDean, getFundDistribution);
router.get('/fund-distribution/export', authenticateDean, exportFundDistributionCSV);

export default router;
