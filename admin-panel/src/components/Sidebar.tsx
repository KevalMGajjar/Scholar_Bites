import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { Radio, ClipboardList, Store, UtensilsCrossed, BarChart3, Settings, LogOut } from 'lucide-react';

const navItems = [
  { path: '/', label: 'Live Orders', icon: <Radio size={18} />, roles: ['staff', 'admin', 'super_admin'] },
  { path: '/orders', label: 'Order History', icon: <ClipboardList size={18} />, roles: ['admin', 'super_admin'] },
  { path: '/restaurants', label: 'Restaurants', icon: <Store size={18} />, roles: ['admin', 'super_admin'] },
  { path: '/menu', label: 'Menu Items', icon: <UtensilsCrossed size={18} />, roles: ['admin', 'super_admin'] },
  { path: '/statistics', label: 'Statistics', icon: <BarChart3 size={18} />, roles: ['admin', 'super_admin'] },
  { path: '/settings', label: 'Settings', icon: <Settings size={18} />, roles: ['admin', 'super_admin'] },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const { isConnected } = useSocket();

  return (
    <aside className="w-[260px] h-screen bg-[#080a10]/95 backdrop-blur-2xl border-r border-white/[0.04] flex flex-col fixed left-0 top-0 z-40 animate-slide-left">
      {/* ── Brand ── */}
      <div className="px-7 pt-8 pb-6">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-xl shadow-indigo-500/20 p-2 overflow-hidden animate-pulse-glow">
            <img src="/admin/logo.png" alt="Logo" className="w-full h-full object-contain filter brightness-110" />
          </div>
          <div>
            <h1 className="text-[13px] font-extrabold text-white tracking-[-0.01em] leading-tight">Ahmedabad University Canteen</h1>
            <p className="text-[11px] font-semibold text-slate-500 tracking-widest uppercase mt-0.5">Admin</p>
          </div>
        </div>
      </div>

      {/* ── System Status ── */}
      <div className="mx-5 mb-6">
        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
          <div className="relative flex h-2 w-2">
            {isConnected && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60"></span>}
            <span className={`relative inline-flex rounded-full h-2 w-2 ${isConnected ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
          </div>
          <span className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
            {isConnected ? 'Online' : 'Offline'}
          </span>
        </div>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 px-4 space-y-0.5 overflow-y-auto stagger-children">
        {navItems
          .filter((item) => item.roles.includes(user?.role || ''))
          .map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 group relative btn-press ${
                  isActive
                    ? 'bg-indigo-500/10 text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]'
                    : 'text-slate-500 hover:text-slate-200 hover:bg-white/[0.03]'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-indigo-500 shadow-lg shadow-indigo-500/50" />
                  )}
                  <span className={`transition-colors ${isActive ? 'text-indigo-400' : 'text-slate-600 group-hover:text-slate-400'}`}>
                    {item.icon}
                  </span>
                  <span className="tracking-[-0.01em]">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
      </nav>

      {/* ── User Section ── */}
      <div className="p-4 mt-auto">
        <div className="rounded-2xl bg-white/[0.02] border border-white/[0.04] p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center shadow-inner ring-1 ring-white/5">
              <span className="text-white font-bold text-xs">
                {user?.name?.charAt(0)?.toUpperCase() || '?'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-[13px] font-semibold truncate">{user?.name}</p>
              <p className="text-slate-600 text-[11px] capitalize font-medium">{user?.role?.replace('_', ' ')}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex justify-center items-center gap-2 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] text-slate-500 text-[12px] font-semibold hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 transition-all duration-200 btn-press"
          >
            <LogOut size={14} />
            Sign Out
          </button>
        </div>
      </div>
    </aside>
  );
}
