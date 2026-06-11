import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, LogOut, ShieldCheck, Undo2, Settings, Users, Activity, AlertTriangle, Megaphone } from 'lucide-react';

export default function Sidebar() {
  const { user, logout } = useAuth();

  const getNavLinkClass = (isActive: boolean) => {
    return `relative flex items-center gap-3 px-6 py-3.5 text-[0.9rem] font-medium transition-all duration-300 ${
      isActive
        ? 'text-[#e5e2e1] bg-[#1c1b1b]/50 before:absolute before:left-0 before:top-0 before:h-full before:w-[2px] before:bg-[#eac34a] before:rounded-r-full before:shadow-[0_0_8px_rgba(234,195,74,0.6)]'
        : 'text-[#dcc0bd] hover:text-[#e5e2e1] hover:bg-[#1c1b1b]/30'
    }`;
  };

  return (
    <aside className="w-64 h-screen bg-[#0e0e0e] border-r border-[#554240]/15 flex flex-col fixed left-0 top-0 z-40">
      <div className="p-6 border-b border-[#554240]/15">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#f0513e] to-[#ffb4a8] flex items-center justify-center shadow-xl shadow-[#f0513e]/20 p-2.5 overflow-hidden animate-pulse-glow">
            <img src="/superadmin/logo.png" alt="Platform Logo" className="w-full h-full object-contain filter brightness-110" />
          </div>
          <div>
            <h1 className="text-[13px] font-extrabold text-[#e5e2e1] tracking-[-0.01em] leading-tight">Ahmedabad University Canteen</h1>
            <p className="text-[11px] font-semibold text-[#a38b88] tracking-widest uppercase mt-0.5">Super Admin</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 py-4 space-y-1 overflow-y-auto">
        <NavLink to="/" className={({ isActive }) => getNavLinkClass(isActive)}>
          <LayoutDashboard size={20} className="opacity-80" />
          System Health
        </NavLink>

        <NavLink to="/staff" className={({ isActive }) => getNavLinkClass(isActive)}>
          <ShieldCheck size={20} className="opacity-80" />
          Access Control
        </NavLink>

        <NavLink to="/university-staff" className={({ isActive }) => getNavLinkClass(isActive)}>
          <Users size={20} className="opacity-80" />
          Delegates
        </NavLink>

        <NavLink to="/audit-logs" className={({ isActive }) => getNavLinkClass(isActive)}>
          <ShieldCheck size={20} className="opacity-80" />
          Audit Logs
        </NavLink>

        <NavLink to="/refunds" className={({ isActive }) => getNavLinkClass(isActive)}>
          <Undo2 size={20} className="opacity-80" />
          Refund Queue
        </NavLink>

        <NavLink to="/service-status" className={({ isActive }) => getNavLinkClass(isActive)}>
          <Activity size={20} className="opacity-80" />
          Service Status
        </NavLink>

        <NavLink to="/stuck-orders" className={({ isActive }) => getNavLinkClass(isActive)}>
          <AlertTriangle size={20} className="opacity-80" />
          Stuck Orders
        </NavLink>

        <NavLink to="/broadcast" className={({ isActive }) => getNavLinkClass(isActive)}>
          <Megaphone size={20} className="opacity-80" />
          Broadcast
        </NavLink>

        <NavLink to="/settings" className={({ isActive }) => getNavLinkClass(isActive)}>
          <Settings size={20} className="opacity-80" />
          Settings
        </NavLink>
      </nav>

      <div className="p-5 border-t border-[#554240]/15 bg-[#131313]/30">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-[#1c1b1b] border border-[#554240]/20 flex items-center justify-center shrink-0">
             <span className="text-[#e5e2e1] font-medium font-display">{user?.name?.charAt(0) || 'A'}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[#e5e2e1] text-sm font-medium truncate font-display">{user?.name}</p>
            <p className="text-[#a38b88] text-xs truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-[#554240]/20 bg-[#1c1b1b]/50 text-[#dcc0bd] text-sm font-medium hover:bg-[#1c1b1b] hover:text-[#eac34a] transition-colors"
        >
          <LogOut size={16} />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
