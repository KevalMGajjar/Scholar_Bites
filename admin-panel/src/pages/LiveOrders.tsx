import { useState, useEffect, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';
import api from '../services/api';

interface OrderItem {
  id: string;
  item_name: string;
  item_image: string;
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
  order_token?: string;
  items: OrderItem[];
  created_at: string;
  payment_id: string;
}

const STATUS_COLUMNS = [
  { key: 'pending', label: 'New Orders', color: 'amber', icon: '🔔' },
  { key: 'preparing', label: 'Preparing', color: 'blue', icon: '👨‍🍳' },
  { key: 'ready', label: 'Ready', color: 'emerald', icon: '✅' },
];

const STATUS_FLOW: Record<string, string> = {
  pending: 'preparing',
  preparing: 'ready',
  ready: 'completed',
};

const ACTION_LABELS: Record<string, string> = {
  pending: 'Accept Order',
  preparing: 'Mark Ready',
  ready: 'Complete',
};

export default function LiveOrders() {
  const { socket } = useSocket();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [tokenSearch, setTokenSearch] = useState('');
  const [scannedOrder, setScannedOrder] = useState<Order | null>(null);
  const [searchError, setSearchError] = useState('');

  const fetchOrders = useCallback(async () => {
    try {
      const res = await api.get('/admin/orders/pending');
      setOrders(res.data);
    } catch (err) {
      console.error('Failed to fetch orders', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Listen for real-time new orders
  useEffect(() => {
    if (!socket) return;

    const handleNewOrder = (order: Order) => {
      setOrders((prev) => {
        if (prev.find((o) => o.id === order.id)) return prev;
        return [order, ...prev];
      });
    };

    socket.on('new_order', handleNewOrder);
    return () => { socket.off('new_order', handleNewOrder); };
  }, [socket]);

  const updateStatus = async (orderId: string, currentStatus: string) => {
    const nextStatus = STATUS_FLOW[currentStatus];
    if (!nextStatus) return;

    try {
      await api.patch(`/admin/orders/${orderId}/status`, { status: nextStatus });
      if (nextStatus === 'completed') {
        setOrders((prev) => prev.filter((o) => o.id !== orderId));
      } else {
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, status: nextStatus } : o))
        );
      }
    } catch (err) {
      console.error('Failed to update status', err);
    }
  };

  const cancelOrder = async (orderId: string) => {
    try {
      await api.post(`/admin/orders/${orderId}/refund`, { reason: 'Cancelled by staff' });
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
    } catch (err) {
      console.error('Failed to cancel order', err);
    }
  };

  const getTimeAgo = (dateStr: string) => {
    const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-6 h-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Live Orders</h1>
          <p className="text-slate-400 text-sm mt-1">
            {orders.length} active order{orders.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Token Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search token (e.g. A7F3)"
              value={tokenSearch}
              onChange={(e) => {
                setTokenSearch(e.target.value.toUpperCase());
                setSearchError('');
              }}
              onKeyDown={async (e) => {
                if (e.key === 'Enter' && tokenSearch.trim()) {
                  try {
                    setSearchError('');
                    const res = await api.get(`/admin/orders/scan/${tokenSearch.trim()}`);
                    setScannedOrder(res.data);
                    setTokenSearch('');
                  } catch {
                    setSearchError('Not found');
                  }
                }
              }}
              className="w-48 px-3 py-2 pl-9 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-amber-500/50 transition"
            />
            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {searchError && (
              <span className="absolute -bottom-5 left-0 text-red-400 text-xs">{searchError}</span>
            )}
          </div>
          <button
            onClick={fetchOrders}
            className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-sm hover:bg-slate-700 transition flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Scanned Order Popup */}
      {scannedOrder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setScannedOrder(null)}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-amber-500/15 flex items-center justify-center">
                  <span className="text-amber-400 font-black text-lg">#{scannedOrder.order_token}</span>
                </div>
                <div>
                  <p className="text-white font-bold">Order Found</p>
                  <p className="text-slate-400 text-xs">{scannedOrder.restaurant_name}</p>
                </div>
              </div>
              <button onClick={() => setScannedOrder(null)} className="text-slate-500 hover:text-white">✕</button>
            </div>

            <div className="bg-slate-800/50 rounded-xl p-4 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
                  <span className="text-white text-sm font-medium">{scannedOrder.user_name?.charAt(0)?.toUpperCase() || '?'}</span>
                </div>
                <div>
                  <p className="text-white text-sm font-medium">{scannedOrder.user_name}</p>
                  <p className="text-slate-500 text-xs">{scannedOrder.user_phone}</p>
                </div>
              </div>
              <div className="space-y-2">
                {scannedOrder.items?.filter(i => i.item_name).map((item, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span className="text-slate-300 text-sm"><span className="text-amber-400 font-bold">{item.quantity}x</span> {item.item_name}</span>
                    <span className="text-slate-500 text-sm">₹{(parseFloat(item.price_at_time) * item.quantity).toFixed(0)}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-3 pt-3 border-t border-slate-700">
                <span className="text-slate-400 text-sm font-medium">Total</span>
                <span className="text-white font-bold">₹{parseFloat(scannedOrder.total_amount).toFixed(0)}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={async () => {
                  const next = STATUS_FLOW[scannedOrder.status];
                  if (next) {
                    await updateStatus(scannedOrder.id, scannedOrder.status);
                    setScannedOrder(null);
                  }
                }}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white font-semibold text-sm hover:bg-amber-600 transition"
              >
                {ACTION_LABELS[scannedOrder.status] || 'Done'}
              </button>
              <button
                onClick={() => setScannedOrder(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-sm hover:bg-slate-700 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Kanban Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100%-5rem)]">
        {STATUS_COLUMNS.map((col) => {
          const colOrders = orders.filter((o) => o.status === col.key);
          return (
            <div key={col.key} className="flex flex-col min-h-0">
              {/* Column Header */}
              <div className="flex items-center gap-2 mb-4">
                <span className="text-lg">{col.icon}</span>
                <h2 className="text-white font-semibold">{col.label}</h2>
                <span className={`ml-auto px-2 py-0.5 rounded-full text-xs font-bold bg-${col.color}-500/15 text-${col.color}-400`}>
                  {colOrders.length}
                </span>
              </div>

              {/* Orders List */}
              <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                {colOrders.length === 0 ? (
                  <div className="flex items-center justify-center h-32 border border-dashed border-slate-700 rounded-xl">
                    <p className="text-slate-600 text-sm">No orders</p>
                  </div>
                ) : (
                  colOrders.map((order) => (
                    <div
                      key={order.id}
                      className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 backdrop-blur-sm hover:border-slate-600/50 transition-all"
                    >
                      {/* Order Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-white font-semibold text-sm">
                              #{order.id.slice(-6).toUpperCase()}
                            </p>
                            {order.order_token && (
                              <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-400 text-xs font-bold tracking-wider">
                                {order.order_token}
                              </span>
                            )}
                          </div>
                          <p className="text-slate-400 text-xs mt-0.5">{order.restaurant_name}</p>
                        </div>
                        <span className="text-amber-400 text-xs font-medium">
                          {getTimeAgo(order.created_at)}
                        </span>
                      </div>

                      {/* Customer */}
                      <div className="flex items-center gap-2 mb-3 pb-3 border-b border-slate-700/50">
                        <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center">
                          <span className="text-white text-xs font-medium">
                            {order.user_name?.charAt(0)?.toUpperCase() || '?'}
                          </span>
                        </div>
                        <div>
                          <p className="text-white text-xs font-medium">{order.user_name}</p>
                          <p className="text-slate-500 text-xs">{order.user_phone}</p>
                        </div>
                      </div>

                      {/* Items */}
                      <div className="space-y-2 mb-3">
                        {order.items?.filter(i => i.item_name).map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-amber-400 text-xs font-bold">{item.quantity}x</span>
                              <span className="text-slate-300 text-xs">{item.item_name}</span>
                            </div>
                            <span className="text-slate-500 text-xs">
                              ₹{(parseFloat(item.price_at_time) * item.quantity).toFixed(0)}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Total */}
                      <div className="flex items-center justify-between pt-3 border-t border-slate-700/50 mb-3">
                        <span className="text-slate-400 text-xs font-medium">Total</span>
                        <span className="text-white font-bold text-sm">
                          ₹{parseFloat(order.total_amount).toFixed(0)}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => updateStatus(order.id, order.status)}
                          className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                            col.key === 'pending'
                              ? 'bg-amber-500 text-white hover:bg-amber-600'
                              : col.key === 'preparing'
                              ? 'bg-blue-500 text-white hover:bg-blue-600'
                              : 'bg-emerald-500 text-white hover:bg-emerald-600'
                          }`}
                        >
                          {ACTION_LABELS[order.status]}
                        </button>
                        {col.key === 'pending' && (
                          <button
                            onClick={() => cancelOrder(order.id)}
                            className="px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-xs font-semibold hover:bg-red-500/20 transition"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
