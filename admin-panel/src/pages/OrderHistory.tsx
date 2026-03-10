import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

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
  pending: 'bg-amber-500/15 text-amber-400',
  preparing: 'bg-blue-500/15 text-blue-400',
  ready: 'bg-emerald-500/15 text-emerald-400',
  completed: 'bg-slate-500/15 text-slate-400',
  cancelled: 'bg-red-500/15 text-red-400',
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
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                statusFilter === s
                  ? 'bg-amber-500 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {s || 'All'}
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
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700/50">
                  <th className="text-left text-xs text-slate-400 font-medium px-4 py-3">Order ID</th>
                  <th className="text-left text-xs text-slate-400 font-medium px-4 py-3">Customer</th>
                  <th className="text-left text-xs text-slate-400 font-medium px-4 py-3">Restaurant</th>
                  <th className="text-left text-xs text-slate-400 font-medium px-4 py-3">Items</th>
                  <th className="text-left text-xs text-slate-400 font-medium px-4 py-3">Total</th>
                  <th className="text-left text-xs text-slate-400 font-medium px-4 py-3">Status</th>
                  <th className="text-left text-xs text-slate-400 font-medium px-4 py-3">Date</th>
                  <th className="text-left text-xs text-slate-400 font-medium px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-b border-slate-700/30 hover:bg-slate-700/20 transition">
                    <td className="px-4 py-3 text-white text-sm font-mono">
                      #{order.id.slice(-6).toUpperCase()}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-white text-sm">{order.user_name}</p>
                      <p className="text-slate-500 text-xs">{order.user_phone}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-300 text-sm">{order.restaurant_name}</td>
                    <td className="px-4 py-3 text-slate-300 text-xs max-w-[200px]">
                      {order.items?.filter(i => i.item_name).map((i) => `${i.quantity}x ${i.item_name}`).join(', ')}
                    </td>
                    <td className="px-4 py-3 text-white text-sm font-semibold">
                      ₹{parseFloat(order.total_amount).toFixed(0)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-md text-xs font-medium capitalize ${STATUS_COLORS[order.status] || ''}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{formatDate(order.created_at)}</td>
                    <td className="px-4 py-3">
                      {order.status !== 'cancelled' && order.status !== 'completed' && (
                        <button
                          onClick={() => refundOrder(order.id)}
                          className="px-2 py-1 rounded-md bg-red-500/10 text-red-400 text-xs hover:bg-red-500/20 transition"
                        >
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
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-400 text-sm disabled:opacity-30 hover:bg-slate-700 transition"
              >
                Previous
              </button>
              <span className="text-slate-400 text-sm">
                Page {page} of {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-400 text-sm disabled:opacity-30 hover:bg-slate-700 transition"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
