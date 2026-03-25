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
  const [fetchError, setFetchError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setFetchError('');
    try {
      const params: any = { page, limit: 30 };
      if (actionFilter) params.action = actionFilter;
      if (search) params.search = search;
      const { data } = await api.get('/superadmin/audit-logs', { params });
      setLogs(data.logs || []);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || 0);
    } catch (err: any) {
      console.error('Failed to fetch audit logs', err);
      const msg = err.response?.data?.message || err.message || 'Failed to load audit logs';
      setFetchError(msg);
      setLogs([]);
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
    <div className="p-8 lg:p-12 max-w-7xl mx-auto space-y-8 animate-fade-up font-body">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-display font-bold text-[#e5e2e1] mb-1 tracking-tight">Audit Logs</h1>
        <p className="text-[#a38b88] text-sm">Security event log — track all actions across the platform</p>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap gap-4 items-center bg-[#1c1b1b] p-4 rounded-2xl border border-[#554240]/15 shadow-inner">
        <form onSubmit={handleSearch} className="flex-1 min-w-[260px] relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#a38b88]" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by user, resource, or details..."
            className="w-full pl-11 pr-4 py-2.5 bg-[#131313] border border-[#554240]/20 rounded-xl text-sm text-[#e5e2e1] placeholder-[#a38b88]/60 focus:outline-none focus:border-[#f0513e]/50 focus:ring-1 focus:ring-[#f0513e]/20 transition-all font-body"
          />
        </form>

        <div className="relative">
          <Filter size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#a38b88] pointer-events-none" />
          <select
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
            className="pl-10 pr-10 py-2.5 bg-[#131313] border border-[#554240]/20 rounded-xl text-sm text-[#e5e2e1] appearance-none cursor-pointer focus:outline-none focus:border-[#f0513e]/50 transition-all font-body font-medium"
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
            className="flex items-center gap-1.5 px-4 py-2.5 bg-[#131313] border border-[#554240]/20 rounded-xl text-xs text-[#dcc0bd] hover:text-[#e5e2e1] hover:border-[#f0513e]/30 transition-all font-medium uppercase tracking-wider"
          >
            <X size={14} /> Clear
          </button>
        )}

        <div className="ml-auto text-xs font-medium text-[#eac34a] bg-[#eac34a]/10 px-3 py-1.5 rounded-lg border border-[#eac34a]/20">
          {total.toLocaleString()} records
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-[#1c1b1b] border border-[#554240]/15 rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="animate-spin w-8 h-8 border-2 border-[#f0513e] border-t-transparent rounded-full" />
          </div>
        ) : fetchError ? (
          <div className="flex flex-col items-center justify-center py-24 text-[#ffb4ab]">
            <AlertTriangle size={48} className="mb-4 opacity-70" />
            <p className="font-display font-bold text-lg">System Integrity Error</p>
            <p className="text-sm mt-1 text-[#dcc0bd] max-w-md text-center">{fetchError}</p>
            <button
              onClick={fetchLogs}
              className="mt-6 px-6 py-2.5 bg-[#93000a]/20 border border-[#93000a]/50 text-[#ffb4ab] text-sm font-medium rounded-lg hover:bg-[#93000a]/40 transition-all"
            >
              Initialize Retry Protocol
            </button>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-[#554240]">
            <Shield size={64} className="mb-4 opacity-20" />
            <p className="font-display font-medium text-lg">No audit events recorded</p>
            <p className="text-sm mt-1">System monitoring is active. Events will populate here.</p>
          </div>
        ) : (
          <div className="divide-y divide-[#554240]/15">
            {logs.map((log) => {
              const config = getActionConfig(log.action);
              const Icon = config.icon;
              return (
                <div key={log.id} className="flex items-start gap-4 px-6 p-5 hover-ember bg-[#1c1b1b] hover:bg-[#201f1f] transition-all cursor-default">
                  {/* Icon */}
                  <div className={`mt-0.5 w-10 h-10 rounded-xl ${config.bg} flex items-center justify-center flex-shrink-0 shadow-inner border border-white/5`}>
                    <Icon size={18} className={config.color} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className={`text-sm font-display font-bold tracking-wide ${config.color}`}>
                        {config.label}
                      </span>
                      {log.resource && (
                        <span className="text-xs text-[#dcc0bd] bg-[#131313] border border-[#554240]/30 px-2.5 py-0.5 rounded flex items-center shadow-inner tracking-wide uppercase">
                          {log.resource}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[#a38b88]">
                      {log.user_name !== 'System' && (
                        <span className="flex items-center gap-1.5 text-[#e5e2e1] font-medium bg-[#131313]/60 px-2 py-0.5 rounded-md">
                          <User size={13} className="text-[#554240]" />
                          {log.user_name}
                          {log.user_identifier && (
                            <span className="text-[#554240] font-normal text-xs ml-1">({log.user_identifier})</span>
                          )}
                        </span>
                      )}
                      {log.details && (
                        <span className="truncate max-w-[400px] text-[13px]">{log.details}</span>
                      )}
                    </div>
                  </div>

                  {/* Meta */}
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0 text-xs text-[#554240] font-medium font-mono">
                    <span className="flex items-center gap-1.5">
                      <Clock size={12} className="opacity-70" />
                      {timeAgo(log.created_at)}
                    </span>
                    {log.ip_address && (
                      <span className="flex items-center gap-1.5 text-[11px] bg-[#131313] px-2 py-0.5 rounded border border-[#554240]/20">
                        <Globe size={11} className="opacity-60" />
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
          <div className="flex items-center justify-between px-6 py-4 border-t border-[#554240]/15 bg-[#131313]/60">
            <span className="text-xs font-semibold tracking-widest uppercase text-[#554240]">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="p-2 rounded-xl bg-[#1c1b1b] border border-[#554240]/20 text-[#a38b88] hover:text-[#e5e2e1] hover:border-[#f0513e]/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-inner"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-xl bg-[#1c1b1b] border border-[#554240]/20 text-[#a38b88] hover:text-[#e5e2e1] hover:border-[#f0513e]/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-inner"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
