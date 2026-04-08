import http from 'http';
import dotenv from 'dotenv';

// Load env FIRST, before anything else
dotenv.config();

import { validateEnv } from './utils/validateEnv';

// Validate all required env vars before starting
validateEnv();

import app from './app';
import { initSocket } from './services/socketService';
import { startNotificationScheduler } from './services/notificationScheduler';
import { startPendingOrderCleanup } from './controllers/orderController';
// Staff code rotation removed — staff are now pre-created by admin

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);

// Initialize Socket.io
initSocket(server);

// Start cron jobs
startNotificationScheduler();
startPendingOrderCleanup();
// startStaffCodeRotation(); — removed, staff codes deprecated

server.listen(PORT as number, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT} at 0.0.0.0`);
});
