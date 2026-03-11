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

const app = express();

app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/university', universityRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/lobby', lobbyRoutes);
app.use('/api/restaurants', restaurantRoutes);
app.use('/api/admin', adminRoutes);

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

export default app;
