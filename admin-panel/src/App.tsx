import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import Login from './pages/Login';
import LiveOrders from './pages/LiveOrders';
import OrderHistory from './pages/OrderHistory';
import Restaurants from './pages/Restaurants';
import MenuItems from './pages/MenuItems';
import Statistics from './pages/Statistics';
import Sidebar from './components/Sidebar';

function ProtectedLayout() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return (
    <SocketProvider>
      <div className="flex min-h-screen bg-slate-900">
        <Sidebar />
        <main className="flex-1 ml-64 min-h-screen">
          <Outlet />
        </main>
      </div>
    </SocketProvider>
  );
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter basename="/admin">
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedLayout />}>
            <Route path="/" element={<LiveOrders />} />
            <Route path="/orders" element={<AdminRoute><OrderHistory /></AdminRoute>} />
            <Route path="/restaurants" element={<AdminRoute><Restaurants /></AdminRoute>} />
            <Route path="/menu" element={<AdminRoute><MenuItems /></AdminRoute>} />
            <Route path="/statistics" element={<AdminRoute><Statistics /></AdminRoute>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
