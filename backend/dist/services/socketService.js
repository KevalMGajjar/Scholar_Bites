"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emitGroupUpdate = exports.emitStatusUpdate = exports.emitNewOrder = exports.getIO = exports.initSocket = void 0;
const socket_io_1 = require("socket.io");
let io;
const initSocket = (httpServer) => {
    io = new socket_io_1.Server(httpServer, {
        cors: {
            origin: '*', // Allow all origins for now
            methods: ['GET', 'POST'],
        },
    });
    io.on('connection', (socket) => {
        console.log('Client connected:', socket.id);
        socket.on('join_room', (room) => {
            socket.join(room);
            console.log(`Socket ${socket.id} joined room ${room}`);
        });
        socket.on('disconnect', () => {
            console.log('Client disconnected:', socket.id);
        });
    });
    return io;
};
exports.initSocket = initSocket;
const getIO = () => {
    if (!io) {
        throw new Error('Socket.io not initialized!');
    }
    return io;
};
exports.getIO = getIO;
// Helper methods to emit specific events
const emitNewOrder = (universityId, order) => {
    // Emit to staff room of that university
    (0, exports.getIO)().to(`staff_${universityId}`).emit('new_order', order);
};
exports.emitNewOrder = emitNewOrder;
const emitStatusUpdate = (userId, order) => {
    // Emit to user specific room (or just use user_id room)
    (0, exports.getIO)().to(`user_${userId}`).emit('status_update', order);
};
exports.emitStatusUpdate = emitStatusUpdate;
const emitGroupUpdate = (groupCode, event, data) => {
    (0, exports.getIO)().to(`group_${groupCode}`).emit(event, data);
};
exports.emitGroupUpdate = emitGroupUpdate;
