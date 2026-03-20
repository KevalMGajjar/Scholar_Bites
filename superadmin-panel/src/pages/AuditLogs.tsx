import { useEffect, useState, useCallback } from 'react';
import api from '../services/api';
import {
  Search, ChevronLeft, ChevronRight, Shield, ShieldAlert, LogIn, LogOut,
  UserPlus, UserMinus, Key, Edit, Trash2, CreditCard, Wallet, Filter, X,
  Clock, Globe, User, AlertTriangle
} from 'lucide-react';

interface AuditLog {
  id: string;
  action: string;
  resource: string | null;
  details: string | null;
  ip_address: string | null;
  created_at: string;
  user_id: string | null;
  user_name: string;
  user_identifier: string;
  user_role: string;
}

const ACTION_CONFIG: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  LOGIN_SUCCESS: { label: 'Login Success', icon: LogIn, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  LOGIN_FAILED: { label: 'Login Failed', icon: ShieldAlert, color: 'text-red-400', bg: 'bg-red-500/10' },
  LOGIN_LOCKED: { label: 'Account Locked', icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  LOGOUT: { label: 'Logout', icon: LogOut, color: 'text-slate-400', bg: 'bg-slate-500/10' },
  PASSWORD_CHANGE: { label: 'Password Changed', icon: Key, color: 'text-purple-400', bg: 'bg-purple-500/10' },
  OTP_REQUESTED: { label: 'OTP Requested', icon: Key, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  STAFF_CREATED: { label: 'Staff Created', icon: UserPlus, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  STAFF_DELETED: { label: 'Staff Deleted', icon: UserMinus, color: 'text-red-400', bg: 'bg-red-500/10' },
  MENU_CREATED: { label: 'Menu Item Created', icon: Edit, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
  MENU_UPDATED: { label: 'Menu Item Updated', icon: Edit, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  MENU_DELETED: { label: 'Menu Item Deleted', icon: Trash2, color: 'text-red-400', bg: 'bg-red-500/10' },
  RESTAURANT_CREATED: { label: 'Restaurant Created', icon: Edit, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  RESTAURANT_UPDATED: { label: 'Restaurant Updated', icon: Edit, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  RESTAURANT_DELETED: { label: 'Restaurant Deleted', icon: Trash2, color: 'text-red-400', bg: 'bg-red-500/10' },
  ORDER_STATUS_CHANGED: { label: 'Order Status', icon: CreditCard, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  ORDER_REFUNDED: { label: 'Order Refunded', icon: CreditCard, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  PAYMENT_VERIFIED: { label: 'Payment Verified', icon: CreditCard, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  WALLET_TOPUP: { label: 'Wallet Top-up', icon: Wallet, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  WALLET_PAYMENT: { label: 'Wallet Payment', icon: Wallet, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  UNIVERSITY_UPDATED: { label: 'University Updated', icon: Edit, color: 'text-blue-400', bg: 'bg-blue-500/10' },
};

const ACTION_CATEGORIES = [
  { label: 'All Actions', value: '' },
  { label: '── Authentication ──', value: '', disabled: true },
  { label: 'Login Success', value: 'LOGIN_SUCCESS' },
  { label: 'Login Failed', value: 'LOGIN_FAILED' },
  { label: 'Account Locked', value: 'LOGIN_LOCKED' },
  { label: 'Password Change', value: 'PASSWORD_CHANGE' },
  { label: '── Staff ──', value: '', disabled: true },
  { label: 'Staff Created', value: 'STAFF_CREATED' },
  { label: 'Staff Deleted', value: 'STAFF_DELETED' },
  { label: '── Menu ──', value: '', disabled: true },
  { label: 'Menu Updated', value: 'MENU_UPDATED' },
  { label: 'Menu Deleted', value: 'MENU_DELETED' },
  { label: '── Restaurant ──', value: '', disabled: true },
  { label: 'Restaurant Updated', value: 'RESTAURANT_UPDATED' },
  { label: 'Restaurant Deleted', value: 'RESTAURANT_DELETED' },
  { label: '── Orders & Payments ──', value: '', disabled: true },
  { label: 'Order Status', value: 'ORDER_STATUS_CHANGED' },
  { label: 'Wallet Top-up', value: 'WALLET_TOPUP' },
];

function timeAgo(dateStr: string) {
  const now = new Date();
  const d = new Date(dateStr);
  const sec = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (sec < 60) return 'just now';
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  if (sec < 604800) return `${Math.floor(sec / 86400)}d ago`;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page, limit: 30 };
      if (actionFilter) params.action = actionFilter;
      if (search) params.search = search;
      const { data } = await api.get('/superadmin/audit-logs', { params });
      setLogs(data.logs);
      setTotalPages(data.totalPages);
      setTotal(data.total);
    } catch (err) {
      console.error('Failed to fetch audit logs', err);
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter, search]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  };

  const clearFilters = () => {
    setSearch('');
    setSearchInput('');
    setActionFilter('');
    setPage(1);
  };

  const getActionConfig = (action: string) => {
    return ACTION_CONFIG[action] || { label: action, icon: Shield, color: 'text-slate-400', bg: 'bg-slate-500/10' };
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Audit Logs</h1>
        <p className="text-slate-400 text-sm">Security event log — track all actions across the platform</p>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap gap-3 items-center">
        <form onSubmit={handleSearch} className="flex-1 min-w-[260px] relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by user, resource, or details..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all"
          />
        </form>

        <div className="relative">
          <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <select
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
            className="pl-9 pr-8 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white appearance-none cursor-pointer focus:outline-none focus:border-indigo-500/50 transition-all"
          >
            {ACTION_CATEGORIES.map((cat, i) => (
              <option key={i} value={cat.value} disabled={cat.disabled}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>

        {(search || actionFilter) && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-800/50 border border-slate-700 rounded-xl text-xs text-slate-400 hover:text-white hover:border-slate-600 transition-all"
          >
            <X size={14} /> Clear
          </button>
        )}

        <div className="ml-auto text-xs text-slate-500">
          {total.toLocaleString()} events
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full" />
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500">
            <Shield size={40} className="mb-3 opacity-30" />
            <p className="font-medium">No audit logs found</p>
            <p className="text-xs mt-1">Events will appear here as actions are performed</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {logs.map((log) => {
              const config = getActionConfig(log.action);
              const Icon = config.icon;
              return (
                <div key={log.id} className="flex items-start gap-4 px-5 py-4 hover:bg-slate-800/20 transition-colors">
                  {/* Icon */}
                  <div className={`mt-0.5 w-9 h-9 rounded-xl ${config.bg} flex items-center justify-center flex-shrink-0`}>
                    <Icon size={16} className={config.color} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-sm font-medium ${config.color}`}>
                        {config.label}
                      </span>
                      {log.resource && (
                        <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-md font-mono truncate max-w-[200px]">
                          {log.resource}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      {log.user_name !== 'System' && (
                        <span className="flex items-center gap-1">
                          <User size={11} />
                          <span className="text-slate-400">{log.user_name}</span>
                          {log.user_identifier && (
                            <span className="text-slate-600">({log.user_identifier})</span>
                          )}
                        </span>
                      )}
                      {log.details && (
                        <span className="truncate max-w-[300px]">{log.details}</span>
                      )}
                    </div>
                  </div>

                  {/* Meta */}
                  <div className="flex flex-col items-end gap-1 flex-shrink-0 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Clock size={11} />
                      {timeAgo(log.created_at)}
                    </span>
                    {log.ip_address && (
                      <span className="flex items-center gap-1">
                        <Globe size={11} />
                        {log.ip_address}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-800 bg-slate-900/30">
            <span className="text-xs text-slate-500">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="p-2 rounded-lg bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-lg bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
