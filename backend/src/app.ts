import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
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

const app = express();

app.use(cors());
app.use(express.json());

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

app.get('/api', (req, res) => {
    res.send('University Canteen API is running');
});

// ─── Serve Admin Panel (built static files) ───
const adminDist = path.resolve(__dirname, '../../admin-panel/dist');
const adminIndex = path.join(adminDist, 'index.html');

// Use raw middleware — no Express route patterns, fully compatible with Express 5
app.use((req, res, next) => {
    // Only handle /admin routes
    if (!req.path.startsWith('/admin')) {
        return next();
    }

    // Check if admin panel is built
    if (!fs.existsSync(adminIndex)) {
        res.status(503).send('Admin panel not built. Run: cd admin-panel && npm run build');
        return;
    }

    // Try to serve static file (JS, CSS, images, etc.)
    const filePath = req.path.replace('/admin', '');
    const fullPath = path.join(adminDist, filePath);

    if (filePath && filePath !== '/' && fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
        res.sendFile(fullPath);
    } else {
        // SPA fallback — serve index.html for all other /admin routes
        res.sendFile(adminIndex);
    }
});

// ─── Serve Super Admin Panel (built static files) ───
const superAdminDist = path.resolve(__dirname, '../../superadmin-panel/dist');
const superAdminIndex = path.join(superAdminDist, 'index.html');

app.use((req, res, next) => {
    // Only handle /superadmin routes. Ignore /api/superadmin which is the REST API namespace.
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

export default app;
