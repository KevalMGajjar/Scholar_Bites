import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import Login from './pages/Login';
import LiveOrders from './pages/LiveOrders';
import OrderHistory from './pages/OrderHistory';
import RefundQueue from './pages/RefundQueue';
import Restaurants from './pages/Restaurants';
import MenuItems from './pages/MenuItems';
import Statistics from './pages/Statistics';
import Settings from './pages/Settings';
import Sidebar from './components/Sidebar';

function ProtectedLayout() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#060810] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 animate-fade-up">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-xl shadow-indigo-500/20 p-2 overflow-hidden">
            <img src="/admin/logo.png" alt="" className="w-full h-full object-contain" />
          </div>
          <div className="w-6 h-6 border-2 border-indigo-500/40 border-t-indigo-500 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return (
    <SocketProvider>
      <div className="flex min-h-screen bg-[#060810] text-slate-200 selection:bg-indigo-500/30 overflow-hidden relative">
        {/* Ambient light effects – deep, subtle */}
        <div className="fixed top-[-30%] left-[-15%] w-[60%] h-[60%] bg-indigo-500/[0.04] rounded-full blur-[160px] pointer-events-none" />
        <div className="fixed bottom-[-30%] right-[-15%] w-[60%] h-[60%] bg-purple-500/[0.03] rounded-full blur-[160px] pointer-events-none" />

        <Sidebar />
        <main className="flex-1 ml-[260px] min-h-screen relative z-10 overflow-y-auto">
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

function SuperAdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user?.role !== 'super_admin') return <Navigate to="/" replace />;
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
            <Route path="/refunds" element={<SuperAdminRoute><RefundQueue /></SuperAdminRoute>} />
            <Route path="/restaurants" element={<AdminRoute><Restaurants /></AdminRoute>} />
            <Route path="/menu" element={<AdminRoute><MenuItems /></AdminRoute>} />
            <Route path="/statistics" element={<AdminRoute><Statistics /></AdminRoute>} />
            <Route path="/settings" element={<AdminRoute><Settings /></AdminRoute>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
