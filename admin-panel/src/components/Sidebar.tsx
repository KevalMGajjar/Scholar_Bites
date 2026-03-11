import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

const navItems = [
  { path: '/', label: 'Live Orders', icon: '📡', roles: ['staff', 'admin', 'super_admin'] },
  { path: '/orders', label: 'Order History', icon: '📋', roles: ['admin', 'super_admin'] },
  { path: '/restaurants', label: 'Restaurants', icon: '🍽️', roles: ['admin', 'super_admin'] },
  { path: '/menu', label: 'Menu Items', icon: '🍔', roles: ['admin', 'super_admin'] },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const { isConnected } = useSocket();

  return (
    <aside className="w-64 h-screen bg-slate-900 border-r border-slate-800 flex flex-col fixed left-0 top-0 z-40">
      {/* Brand */}
      <div className="p-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <span className="text-white font-bold text-lg">S</span>
          </div>
          <div>
            <h1 className="text-white font-bold text-lg leading-tight">Scholar Bites</h1>
            <p className="text-slate-500 text-xs">Admin Panel</p>
          </div>
        </div>
      </div>

      {/* Connection Status */}
      <div className="px-6 py-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
          <span className="text-xs text-slate-400">
            {isConnected ? 'Live Connected' : 'Disconnected'}
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
                    ? 'bg-amber-500/10 text-amber-400 shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`
              }
            >
              <span className="text-lg">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
      </nav>

      {/* User Info */}
      <div className="p-4 border-t border-slate-800">
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
          className="w-full py-2 rounded-lg bg-slate-800 text-slate-400 text-sm hover:bg-slate-700 hover:text-white transition"
        >
          Sign Out
        </button>
      </div>
    </aside>
  );
}
