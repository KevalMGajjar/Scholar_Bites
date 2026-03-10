import express from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes';
import universityRoutes from './routes/universityRoutes';
import menuRoutes from './routes/menuRoutes';
import orderRoutes from './routes/orderRoutes';
import lobbyRoutes from './routes/lobbyRoutes';
import restaurantRoutes from './routes/restaurantRoutes';

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/university', universityRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/lobby', lobbyRoutes);
app.use('/api/restaurants', restaurantRoutes);

app.get('/', (req, res) => {
    res.send('University Canteen API is running');
});

export default app;
