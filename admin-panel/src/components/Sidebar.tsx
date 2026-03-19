import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { Radio, ClipboardList, Store, UtensilsCrossed, BarChart3, LogOut } from 'lucide-react';

const navItems = [
  { path: '/', label: 'Live Orders', icon: <Radio size={20} />, roles: ['staff', 'admin', 'super_admin'] },
  { path: '/orders', label: 'Order History', icon: <ClipboardList size={20} />, roles: ['admin', 'super_admin'] },
  { path: '/restaurants', label: 'Restaurants', icon: <Store size={20} />, roles: ['admin', 'super_admin'] },
  { path: '/menu', label: 'Menu Items', icon: <UtensilsCrossed size={20} />, roles: ['admin', 'super_admin'] },
  { path: '/statistics', label: 'Statistics', icon: <BarChart3 size={20} />, roles: ['admin', 'super_admin'] },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const { isConnected } = useSocket();

  return (
    <aside className="w-64 h-screen bg-slate-950/80 backdrop-blur-3xl border-r border-white/5 flex flex-col fixed left-0 top-0 z-40">
      {/* Brand */}
      <div className="p-6 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
            <span className="text-white font-bold text-lg">S</span>
          </div>
          <div>
            <h1 className="text-white font-bold text-lg leading-tight">Scholar Bites</h1>
            <p className="text-slate-500 text-xs">Admin Panel</p>
          </div>
        </div>
      </div>

      {/* Connection Status */}
      <div className="px-6 py-4 border-b border-white/5 bg-slate-900/40">
        <div className="flex items-center gap-3">
          <div className="relative flex h-3 w-3">
            {isConnected && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
            <span className={`relative inline-flex rounded-full h-3 w-3 ${isConnected ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
          </div>
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            {isConnected ? 'System Online' : 'System Offline'}
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems
          .filter((item) => item.roles.includes(user?.role || ''))
          .map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-indigo-500/10 text-indigo-400 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] border border-indigo-500/20'
                    : 'text-slate-400 border border-transparent hover:text-slate-200 hover:bg-slate-800/50'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`transition-colors ${isActive ? 'text-indigo-400' : 'text-slate-500'}`}>{item.icon}</span>
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
      </nav>

      {/* User Info */}
      <div className="p-4 border-t border-white/5 bg-slate-900/40">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center">
            <span className="text-white font-medium text-sm">
              {user?.name?.charAt(0)?.toUpperCase() || '?'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">{user?.name}</p>
            <p className="text-slate-500 text-xs capitalize">{user?.role?.replace('_', ' ')}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex justify-center items-center gap-2 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 text-slate-400 text-sm hover:bg-slate-800 hover:text-white hover:border-slate-600 transition"
        >
          <LogOut size={16} />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
