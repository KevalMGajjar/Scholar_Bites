import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({ socket: null, isConnected: false });

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }: { children: ReactNode }) => {
  const { user, token } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!user || !token) return;

    // In production, derive socket URL from the page origin (remove /admin path)
    // In dev, use VITE_SOCKET_URL or localhost:3000
    const getSocketUrl = () => {
      if (import.meta.env.VITE_SOCKET_URL) return import.meta.env.VITE_SOCKET_URL;
      if (import.meta.env.DEV) return 'http://localhost:3000';
      // Production: admin panel is served from the backend, use its origin
      return window.location.origin.replace(/:\d+$/, ':3000');
    };

    const SOCKET_URL = getSocketUrl();
    const newSocket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    newSocket.on('connect', () => {
      setIsConnected(true);
      // Join the staff room for this university
      newSocket.emit('join_room', `staff_${user.university_id}`);
      // Also join restaurant-specific room if staff is assigned
      if ((user as any).restaurant_id) {
        newSocket.emit('join_room', `restaurant_${(user as any).restaurant_id}`);
      }
    });

    newSocket.on('disconnect', () => setIsConnected(false));

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [user, token]);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};
