import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';

let io: SocketIOServer;

export const initSocket = (httpServer: HttpServer) => {
    io = new SocketIOServer(httpServer, {
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

export const getIO = () => {
    if (!io) {
        throw new Error('Socket.io not initialized!');
    }
    return io;
};

// Helper methods to emit specific events
export const emitNewOrder = (universityId: string, order: any) => {
    // Emit to staff room of that university
    getIO().to(`staff_${universityId}`).emit('new_order', order);
};

export const emitStatusUpdate = (userId: string, order: any) => {
    // Emit to user specific room (or just use user_id room)
    getIO().to(`user_${userId}`).emit('status_update', order);
};

// Broadcast an order status change to all staff/admins of a university so their
// Live Orders board updates instantly (move between columns / remove when done).
export const emitOrderBoardUpdate = (universityId: string, order: any) => {
    getIO().to(`staff_${universityId}`).emit('order_updated', order);
};

export const emitGroupUpdate = (groupCode: string, event: string, data: any) => {
    getIO().to(`group_${groupCode}`).emit(event, data);
};
