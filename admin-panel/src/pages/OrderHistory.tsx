import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';

interface Order {
  id: string;
  status: string;
  total_amount: string;
  user_name: string;
  user_phone: string;
  restaurant_name: string;
  items: { item_name: string; quantity: number; price_at_time: string }[];
  created_at: string;
  payment_id: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-500/8 text-amber-400 border border-amber-500/15',
  preparing: 'bg-indigo-500/8 text-indigo-400 border border-indigo-500/15',
  ready: 'bg-emerald-500/8 text-emerald-400 border border-emerald-500/15',
  completed: 'bg-white/[0.04] text-slate-400 border border-white/[0.06]',
  cancelled: 'bg-red-500/8 text-red-400 border border-red-500/15',
};

export default function OrderHistory() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: '20' };
      if (statusFilter) params.status = statusFilter;
      const res = await api.get('/admin/orders', { params });
      setOrders(res.data.orders);
      setTotal(res.data.total);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [page, statusFilter]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const refundOrder = async (orderId: string) => {
    if (!confirm('Are you sure you want to refund this order?')) return;
    try { await api.post(`/admin/orders/${orderId}/refund`, { reason: 'Admin refund' }); fetchOrders(); }
    catch (err) { console.error(err); }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="p-8 animate-fade-in">
      {/* ── Header ── */}
      <div className="flex items-end justify-between mb-10 animate-fade-up">
        <div className="space-y-1.5">
          <h1 className="text-[28px] font-extrabold text-white tracking-[-0.03em]">Order History</h1>
          <p className="text-slate-500 text-[14px] font-medium">
            <span className="text-white font-bold">{total}</span> total orders
          </p>
        </div>
        <div className="flex gap-1.5">
          {['', 'pending', 'preparing', 'ready', 'completed', 'cancelled'].map((s) => (
            <button key={s}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`px-4 py-2 rounded-xl text-[11px] font-bold tracking-wider uppercase transition-all btn-press ${
                statusFilter === s
                  ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                  : 'bg-white/[0.03] border border-white/[0.06] text-slate-500 hover:text-white hover:bg-white/[0.06]'
              }`}>
              {s || 'All'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin w-6 h-6 border-2 border-indigo-500/40 border-t-indigo-500 rounded-full" />
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
                        #{order.id.slice(-6).toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-white text-[13px] font-semibold">{order.user_name}</p>
                      <p className="text-slate-600 text-[11px] mt-0.5">{order.user_phone}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-slate-400 text-[13px]">{order.restaurant_name}</span>
                    </td>
                    <td className="px-6 py-4 max-w-[200px]">
                      {order.items?.filter(i => i.item_name).map((i) => (
                        <span key={i.item_name} className="block text-slate-500 text-[12px] leading-relaxed">
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
                      {order.status !== 'cancelled' && order.status !== 'completed' && (
                        <button onClick={() => refundOrder(order.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/6 border border-red-500/12 text-red-400 text-[11px] font-bold hover:bg-red-500/15 transition-all opacity-0 group-hover:opacity-100 btn-press">
                          <RotateCcw size={11} /> Refund
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
    </div>
  );
}
