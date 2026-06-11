import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { securityHeaders, generalLimiter, authLimiter, otpLimiter } from './middlewares/security';
import { globalErrorHandler } from './middlewares/errorHandler';
import authRoutes from './routes/authRoutes';
import universityRoutes from './routes/universityRoutes';
import menuRoutes from './routes/menuRoutes';
import orderRoutes from './routes/orderRoutes';
import lobbyRoutes from './routes/lobbyRoutes';
import restaurantRoutes from './routes/restaurantRoutes';
import adminRoutes from './routes/adminRoutes';
import walletRoutes from './routes/walletRoutes';
import notificationRoutes from './routes/notificationRoutes';
import superAdminRoutes from './routes/superAdminRoutes';
import userRoutes from './routes/userRoutes';
import staffRoutes from './routes/staffRoutes';
import eventPortalRoutes from './routes/eventPortalRoutes';

const app = express();

// ─── Security Headers ───
app.use(securityHeaders);

// ─── CORS (whitelist, not wide-open) ───
const allowedOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, server-to-server, curl)
        if (!origin) return callback(null, true);
        // In development, allow all origins
        if (process.env.NODE_ENV !== 'production') return callback(null, true);
        // In production, check whitelist
        if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
}));

// ─── Body Parsing with size limit ───
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ─── Global Rate Limiter ───
app.use('/api/', generalLimiter);

// ─── Stricter Rate Limiting on Auth Endpoints ───
app.use('/api/auth/login-otp', authLimiter);
app.use('/api/auth/register-otp', authLimiter);
app.use('/api/admin/login', authLimiter);
app.use('/api/admin/login/verify-otp', authLimiter);
app.use('/api/admin/login/google', authLimiter);
app.use('/api/admin/password/request-otp', otpLimiter);

// ─── Staff Auth Rate Limiting ───
// Staff code verification removed — staff are now pre-created by admin
app.use('/api/auth/login-otp-staff', authLimiter);
app.use('/api/auth/register-otp-staff', authLimiter);
app.use('/api/event/login', authLimiter);

// Serve uploaded images
app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/university', universityRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/lobby', lobbyRoutes);
app.use('/api/restaurants', restaurantRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/superadmin', superAdminRoutes);
app.use('/api/user', userRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/event', eventPortalRoutes);

app.get('/api', (req, res) => {
    res.send('University Canteen API is running');
});

// ─── Serve Admin Panel (built static files) ───
const adminDist = path.resolve(__dirname, '../../admin-panel/dist');
const adminIndex = path.join(adminDist, 'index.html');

app.use((req, res, next) => {
    if (!req.path.startsWith('/admin')) {
        return next();
    }

    if (!fs.existsSync(adminIndex)) {
        res.status(503).send('Admin panel not built. Run: cd admin-panel && npm run build');
        return;
    }

    const filePath = req.path.replace('/admin', '');
    const fullPath = path.join(adminDist, filePath);

    if (filePath && filePath !== '/' && fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
        res.sendFile(fullPath);
    } else {
        res.sendFile(adminIndex);
    }
});

// ─── Serve Super Admin Panel (built static files) ───
const superAdminDist = path.resolve(__dirname, '../../superadmin-panel/dist');
const superAdminIndex = path.join(superAdminDist, 'index.html');

app.use((req, res, next) => {
    if (!req.path.startsWith('/superadmin') || req.path.startsWith('/api/superadmin')) {
        return next();
    }

    if (!fs.existsSync(superAdminIndex)) {
        res.status(503).send('Super Admin panel not built. Run: cd superadmin-panel && npm run build');
        return;
    }

    let filePath = req.path.replace('/superadmin', '');
    if (filePath === '') filePath = '/';

    const fullPath = path.join(superAdminDist, filePath);

    if (filePath !== '/' && fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
        res.sendFile(fullPath);
    } else {
        res.sendFile(superAdminIndex);
    }
});

// ─── Serve Event Portal (built static files) ───
const eventPortalDist = path.resolve(__dirname, '../../event-portal/dist');
const eventPortalIndex = path.join(eventPortalDist, 'index.html');

app.use((req, res, next) => {
    if (!req.path.startsWith('/event') || req.path.startsWith('/api/event')) {
        return next();
    }

    if (!fs.existsSync(eventPortalIndex)) {
        res.status(503).send('Event portal not built. Run: cd event-portal && npm run build');
        return;
    }

    let filePath = req.path.replace('/event', '');
    if (filePath === '') filePath = '/';

    const fullPath = path.join(eventPortalDist, filePath);

    if (filePath !== '/' && fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
        res.sendFile(fullPath);
    } else {
        res.sendFile(eventPortalIndex);
    }
});

// ─── Centralized Error Handler (must be last) ───
app.use(globalErrorHandler);

export default app;
