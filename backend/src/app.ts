import express from 'express';
import cors from 'cors';
import path from 'path';
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
app.use('/admin', express.static(adminDist));

// Serve index.html for /admin and all /admin/* routes (SPA catch-all)
app.get('/admin', (req, res) => {
    res.sendFile(path.join(adminDist, 'index.html'));
});
app.get('/admin/*', (req, res) => {
    res.sendFile(path.join(adminDist, 'index.html'));
});

export default app;
