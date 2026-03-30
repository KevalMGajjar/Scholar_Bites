import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';
import { ChevronLeft, ChevronRight, RotateCcw, Clock, X, AlertTriangle, Search } from 'lucide-react';

interface OrderItem {
  item_name: string;
  quantity: number;
  price_at_time: string;
}

interface Order {
  id: string;
  status: string;
  total_amount: string;
  user_name: string;
  user_phone: string;
  restaurant_name: string;
  items: OrderItem[];
  created_at: string;
  payment_id: string;
  order_token?: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-500/8 text-amber-400 border border-amber-500/15',
  preparing: 'bg-indigo-500/8 text-indigo-400 border border-indigo-500/15',
  ready: 'bg-emerald-500/8 text-emerald-400 border border-emerald-500/15',
  completed: 'bg-white/[0.04] text-slate-400 border border-white/[0.06]',
  cancelled: 'bg-red-500/8 text-red-400 border border-red-500/15',
};

const FILTER_OPTIONS = ['', 'pending', 'preparing', 'ready', 'completed', 'cancelled'] as const;
const PAGE_SIZE = 20;

export default function OrderHistory() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  // Refund request modal
  const [refundModalOrder, setRefundModalOrder] = useState<Order | null>(null);
  const [refundReason, setRefundReason] = useState('');
  const [refundSubmitting, setRefundSubmitting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // ── Debounce search input by 400ms ─────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
      setPage(1); // Reset to first page on new search
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // ── Fetch orders from API ──────────────────────────
  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: String(PAGE_SIZE) };
      if (statusFilter) params.status = statusFilter;
      if (debouncedSearch) params.search = debouncedSearch;
      const res = await api.get('/admin/orders', { params });
      setOrders(res.data.orders);
      setTotal(res.data.total);
    } catch (err) {
      console.error('Failed to fetch order history:', err);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, debouncedSearch]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // ── Toast auto-dismiss ─────────────────────────────
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // ── Handle filter chip click ───────────────────────
  const handleFilterChange = (filter: string) => {
    setStatusFilter(filter);
    setPage(1);
  };

  // ── Submit refund ──────────────────────────────────
  const submitRefundRequest = async () => {
    if (!refundModalOrder || !refundReason.trim()) return;
    setRefundSubmitting(true);
    try {
      await api.post(`/admin/orders/${refundModalOrder.id}/request-refund`, { reason: refundReason.trim() });
      setToast({ msg: 'Refund request submitted for super admin approval ✓', type: 'success' });
      setRefundModalOrder(null);
      setRefundReason('');
      fetchOrders();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to submit refund request';
      setToast({ msg, type: 'error' });
    } finally {
      setRefundSubmitting(false);
    }
  };

  // ── Helpers ────────────────────────────────────────
  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const hasActiveSearch = debouncedSearch.length > 0;

  return (
    <div className="p-8 animate-fade-in">
      {/* ── Toast ── */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-xl text-[13px] font-semibold shadow-2xl animate-fade-up flex items-center gap-2 ${
          toast.type === 'success' ? 'bg-emerald-500/15 border border-emerald-500/20 text-emerald-400' : 'bg-red-500/15 border border-red-500/20 text-red-400'
        }`}>
          {toast.msg}
          <button onClick={() => setToast(null)} className="ml-2 opacity-60 hover:opacity-100"><X size={14} /></button>
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex items-end justify-between mb-6 animate-fade-up">
        <div className="space-y-1.5">
          <h1 className="text-[28px] font-extrabold text-white tracking-[-0.03em]">Order History</h1>
          <p className="text-slate-500 text-[14px] font-medium">
            <span className="text-white font-bold">{total}</span> total order{total !== 1 ? 's' : ''}
            {hasActiveSearch && <span className="text-indigo-400 ml-1">matching "{debouncedSearch}"</span>}
          </p>
        </div>
      </div>

      {/* ── Search + Filters Row ── */}
      <div className="flex items-center gap-4 mb-8 animate-fade-up" style={{ animationDelay: '50ms' }}>
        {/* Search Bar */}
        <div className="relative flex-1 max-w-md group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 group-focus-within:text-indigo-400 transition-colors" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search by token, name, phone, restaurant…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-10 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white text-[13px] placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500/30 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(''); searchInputRef.current?.focus(); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-white transition-colors p-0.5"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filter Chips */}
        <div className="flex gap-1.5">
          {FILTER_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => handleFilterChange(s)}
              className={`px-4 py-2 rounded-xl text-[11px] font-bold tracking-wider uppercase transition-all btn-press ${
                statusFilter === s
                  ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                  : 'bg-white/[0.03] border border-white/[0.06] text-slate-500 hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              {s || 'All'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin w-6 h-6 border-2 border-indigo-500/40 border-t-indigo-500 rounded-full" />
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 animate-fade-up">
          <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-4">
            <Search size={24} className="text-slate-600" />
          </div>
          <p className="text-white font-bold text-lg">No orders found</p>
          <p className="text-slate-600 text-sm mt-1">
            {hasActiveSearch
              ? `No results for "${debouncedSearch}"${statusFilter ? ` in ${statusFilter} orders` : ''}`
              : statusFilter
                ? `No ${statusFilter} orders yet`
                : 'No orders to display'}
          </p>
          {(hasActiveSearch || statusFilter) && (
            <button
              onClick={() => { setSearchQuery(''); setStatusFilter(''); }}
              className="mt-4 px-4 py-2 rounded-xl bg-indigo-500/10 border border-indigo-500/15 text-indigo-400 text-[12px] font-bold hover:bg-indigo-500/20 transition-all btn-press"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <>
          {/* ── Table ── */}
          <div className="bg-white/[0.015] border border-white/[0.04] rounded-2xl overflow-hidden animate-fade-up" style={{ animationDelay: '100ms' }}>
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.04]">
                  {['Order', 'Customer', 'Restaurant', 'Items', 'Total', 'Status', 'Date', ''].map((h) => (
                    <th key={h} className="text-left text-[10px] text-slate-600 font-bold px-6 py-4 uppercase tracking-[0.15em]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {orders.map((order, idx) => (
                  <tr key={order.id} className="hover:bg-white/[0.02] transition-colors duration-200 group animate-fade-up" style={{ animationDelay: `${idx * 30}ms` }}>
                    <td className="px-6 py-4">
                      <span className="text-indigo-400 font-mono text-[11px] font-bold bg-indigo-500/8 px-2 py-1 rounded-lg">
                        #{order.order_token || order.id.slice(-6).toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-white text-[13px] font-semibold">{order.user_name}</p>
                      {order.user_phone && (
                        <p className="text-slate-600 text-[11px] mt-0.5">{order.user_phone}</p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-slate-400 text-[13px]">{order.restaurant_name}</span>
                    </td>
                    <td className="px-6 py-4 max-w-[200px]">
                      {order.items?.filter(i => i.item_name).map((i, iIdx) => (
                        <span key={`${order.id}-item-${iIdx}`} className="block text-slate-500 text-[12px] leading-relaxed">
                          <span className="text-indigo-400 font-bold">{i.quantity}x</span> {i.item_name}
                        </span>
                      ))}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-white text-[14px] font-extrabold tracking-[-0.01em]">₹{parseFloat(order.total_amount).toFixed(0)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest ${STATUS_COLORS[order.status] || ''}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600 text-[12px] font-medium whitespace-nowrap">{formatDate(order.created_at)}</td>
                    <td className="px-6 py-4">
                      {order.status === 'completed' && (
                        <button onClick={() => { setRefundModalOrder(order); setRefundReason(''); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/6 border border-red-500/12 text-red-400 text-[11px] font-bold hover:bg-red-500/15 transition-all opacity-0 group-hover:opacity-100 btn-press">
                          <RotateCcw size={11} /> Request Refund
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Pagination ── */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-8 animate-fade-up" style={{ animationDelay: '200ms' }}>
              <button disabled={page <= 1} onClick={() => setPage(page - 1)}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-slate-400 text-[13px] font-semibold disabled:opacity-20 hover:bg-white/[0.06] hover:text-white transition-all btn-press">
                <ChevronLeft size={15} /> Previous
              </button>
              <span className="text-slate-600 text-[13px] font-medium px-3">
                <span className="text-white font-bold">{page}</span> of {totalPages}
              </span>
              <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-slate-400 text-[13px] font-semibold disabled:opacity-20 hover:bg-white/[0.06] hover:text-white transition-all btn-press">
                Next <ChevronRight size={15} />
              </button>
            </div>
          )}
        </>
      )}

      {/* ── Refund Request Modal ── */}
      {refundModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setRefundModalOrder(null)}>
          <div className="bg-[#0c0e16] border border-white/[0.06] rounded-2xl p-8 w-full max-w-lg shadow-2xl animate-fade-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                <AlertTriangle size={20} className="text-red-400" />
              </div>
              <div>
                <h3 className="text-white text-[18px] font-extrabold">Request Refund</h3>
                <p className="text-slate-500 text-[12px] mt-0.5">This will be sent to super admin for approval</p>
              </div>
            </div>

            {/* Order summary */}
            <div className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-4 mb-5">
              <div className="flex justify-between items-center mb-2">
                <span className="text-indigo-400 font-mono text-[12px] font-bold">#{refundModalOrder.order_token || refundModalOrder.id.slice(-6).toUpperCase()}</span>
                <span className="text-white text-[16px] font-extrabold">₹{parseFloat(refundModalOrder.total_amount).toFixed(0)}</span>
              </div>
              <p className="text-slate-500 text-[12px]">{refundModalOrder.user_name} • {refundModalOrder.restaurant_name}</p>
              <div className="mt-2 space-y-0.5">
                {refundModalOrder.items?.filter(i => i.item_name).map((i, iIdx) => (
                  <span key={`refund-item-${iIdx}`} className="block text-slate-600 text-[11px]">
                    <span className="text-indigo-400 font-bold">{i.quantity}x</span> {i.item_name}
                  </span>
                ))}
              </div>
            </div>

            {/* Reason input */}
            <label className="block text-slate-400 text-[12px] font-bold uppercase tracking-wider mb-2">
              Reason for refund <span className="text-red-400">*</span>
            </label>
            <textarea
              value={refundReason}
              onChange={e => setRefundReason(e.target.value)}
              placeholder="e.g. Student received wrong order, food quality issue..."
              rows={3}
              className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3 text-white text-[13px] placeholder-slate-600 focus:outline-none focus:border-indigo-500/30 resize-none transition-colors"
            />

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <button onClick={() => setRefundModalOrder(null)}
                className="flex-1 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-slate-400 text-[13px] font-semibold hover:bg-white/[0.06] transition-all btn-press">
                Cancel
              </button>
              <button
                onClick={submitRefundRequest}
                disabled={!refundReason.trim() || refundSubmitting}
                className="flex-1 py-3 rounded-xl bg-red-500/15 border border-red-500/20 text-red-400 text-[13px] font-bold hover:bg-red-500/25 transition-all disabled:opacity-30 btn-press flex items-center justify-center gap-2">
                {refundSubmitting ? (
                  <div className="w-4 h-4 border-2 border-red-400/40 border-t-red-400 rounded-full animate-spin" />
                ) : (
                  <><Clock size={14} /> Submit for Approval</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
