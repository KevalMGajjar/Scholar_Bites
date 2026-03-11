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
const adminExists = fs.existsSync(adminIndex);

if (adminExists) {
    console.log('✅ Admin panel found at:', adminDist);
    app.use('/admin', express.static(adminDist));
    // SPA catch-all using middleware (compatible with all Express versions)
    app.use('/admin', (req, res) => {
        res.sendFile(adminIndex);
    });
} else {
    console.log('⚠️ Admin panel not built yet. Run: cd admin-panel && npm run build');
    app.use('/admin', (req, res) => {
        res.status(503).send('Admin panel not built. Run: cd admin-panel && npm run build');
    });
}

export default app;
