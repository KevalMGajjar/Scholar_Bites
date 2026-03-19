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
  pending: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  preparing: 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20',
  ready: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  completed: 'bg-slate-500/10 text-slate-400 border border-slate-500/20',
  cancelled: 'bg-red-500/10 text-red-400 border border-red-500/20',
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
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const refundOrder = async (orderId: string) => {
    if (!confirm('Are you sure you want to refund this order?')) return;
    try {
      await api.post(`/admin/orders/${orderId}/refund`, { reason: 'Admin refund' });
      fetchOrders();
    } catch (err) {
      console.error(err);
    }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Order History</h1>
          <p className="text-slate-400 text-sm mt-1">{total} total orders</p>
        </div>
        <div className="flex gap-2">
          {['', 'pending', 'preparing', 'ready', 'completed', 'cancelled'].map((s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`px-4 py-2 rounded-xl text-xs font-bold tracking-wide transition-all shadow-sm ${
                statusFilter === s
                  ? 'bg-indigo-500 text-white shadow-indigo-500/20'
                  : 'bg-slate-900/50 border border-slate-700/50 text-slate-400 hover:bg-slate-800 hover:text-slate-200 backdrop-blur-sm'
              }`}
            >
              {s ? s.charAt(0).toUpperCase() + s.slice(1) : 'All Orders'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full" />
        </div>
      ) : (
        <>
          <div className="bg-slate-900/40 backdrop-blur-md border border-slate-700/50 rounded-2xl overflow-hidden shadow-xl">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700/50 bg-slate-800/20">
                  <th className="text-left text-xs text-slate-400 font-semibold px-6 py-4 uppercase tracking-wider">Order ID</th>
                  <th className="text-left text-xs text-slate-400 font-semibold px-6 py-4 uppercase tracking-wider">Customer</th>
                  <th className="text-left text-xs text-slate-400 font-semibold px-6 py-4 uppercase tracking-wider">Restaurant</th>
                  <th className="text-left text-xs text-slate-400 font-semibold px-6 py-4 uppercase tracking-wider">Items</th>
                  <th className="text-left text-xs text-slate-400 font-semibold px-6 py-4 uppercase tracking-wider">Total</th>
                  <th className="text-left text-xs text-slate-400 font-semibold px-6 py-4 uppercase tracking-wider">Status</th>
                  <th className="text-left text-xs text-slate-400 font-semibold px-6 py-4 uppercase tracking-wider">Date</th>
                  <th className="text-left text-xs text-slate-400 font-semibold px-6 py-4 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/30">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-800/40 transition-colors group">
                    <td className="px-6 py-4">
                      <span className="text-indigo-400 font-mono text-xs font-bold bg-indigo-500/10 px-2 py-1 rounded-md border border-indigo-500/20">
                        #{order.id.slice(-6).toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-slate-200 text-sm font-semibold">{order.user_name}</p>
                      <p className="text-slate-500 text-[10px] font-medium tracking-wide">{order.user_phone}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-slate-300 text-sm font-medium">{order.restaurant_name}</span>
                    </td>
                    <td className="px-6 py-4 text-slate-400 text-xs max-w-[200px] leading-relaxed">
                      {order.items?.filter(i => i.item_name).map((i) => (
                        <span key={i.item_name} className="block mb-0.5">
                          <span className="text-indigo-400 font-bold">{i.quantity}x</span> {i.item_name}
                        </span>
                      ))}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-white text-sm font-bold tracking-tight">
                        ₹{parseFloat(order.total_amount).toFixed(0)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${STATUS_COLORS[order.status] || ''}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-400 text-xs font-medium">
                      {formatDate(order.created_at)}
                    </td>
                    <td className="px-6 py-4">
                      {order.status !== 'cancelled' && order.status !== 'completed' && (
                        <button
                          onClick={() => refundOrder(order.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold hover:bg-red-500/20 hover:text-red-300 transition-all opacity-0 group-hover:opacity-100"
                        >
                          <RotateCcw size={12} />
                          Refund
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="flex items-center gap-1 px-4 py-2 rounded-xl bg-slate-900/50 border border-slate-700/50 text-slate-300 text-sm disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-800 hover:text-white transition-all backdrop-blur-sm shadow-sm"
              >
                <ChevronLeft size={16} />
                Previous
              </button>
              <span className="text-slate-400 text-sm font-medium px-2">
                Page {page} of {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="flex items-center gap-1 px-4 py-2 rounded-xl bg-slate-900/50 border border-slate-700/50 text-slate-300 text-sm disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-800 hover:text-white transition-all backdrop-blur-sm shadow-sm"
              >
                Next
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
