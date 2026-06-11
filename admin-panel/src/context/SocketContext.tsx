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

    // In production the panel and the Socket.io server are the SAME backend,
    // reached through the same origin (nginx proxies /socket.io to the backend).
    // Connecting to a hard-coded :3000 fails because that port isn't exposed
    // publicly — so we must use the page origin as-is.
    // In dev, use VITE_SOCKET_URL or localhost:3000.
    const getSocketUrl = () => {
      if (import.meta.env.VITE_SOCKET_URL) return import.meta.env.VITE_SOCKET_URL;
      if (import.meta.env.DEV) return 'http://localhost:3000';
      // Production: same origin as the served panel.
      return window.location.origin;
    };

    const SOCKET_URL = getSocketUrl();
    const newSocket = io(SOCKET_URL, {
      // Default path '/socket.io' — nginx must proxy this to the backend with
      // WebSocket upgrade headers. Polling is kept as a fallback.
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
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
