import http from 'http';
import app from './app';
import { initSocket } from './services/socketService';
import { startNotificationScheduler } from './services/notificationScheduler';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);

// Initialize Socket.io
initSocket(server);

// Start cron jobs
startNotificationScheduler();

server.listen(PORT as number, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT} at 0.0.0.0`);
});
