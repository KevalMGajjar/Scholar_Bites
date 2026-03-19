import { useState, useEffect, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';
import api from '../services/api';
import QrScannerModal from '../components/QrScannerModal';
import { Bell, ChefHat, CheckCircle2, Search, QrCode, RefreshCcw, X, Clock } from 'lucide-react';

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
  { key: 'pending', label: 'New Orders', color: 'amber', icon: <Bell size={18} /> },
  { key: 'preparing', label: 'Preparing', color: 'indigo', icon: <ChefHat size={18} /> },
  { key: 'ready', label: 'Ready', color: 'emerald', icon: <CheckCircle2 size={18} /> },
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
  const [showScanner, setShowScanner] = useState(false);

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
          <div className="relative group">
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
              className="w-56 px-4 py-2 pl-10 rounded-xl bg-slate-900/50 border border-slate-700/50 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all backdrop-blur-sm"
            />
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
            {searchError && (
              <span className="absolute -bottom-5 left-0 text-red-400 text-xs font-medium">{searchError}</span>
            )}
          </div>
          <button
            onClick={() => setShowScanner(true)}
            className="px-4 py-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-sm hover:bg-indigo-500/20 hover:border-indigo-500/30 transition-all flex items-center gap-2 font-semibold shadow-lg shadow-indigo-500/5"
          >
            <QrCode size={16} />
            Scan QR
          </button>
          <button
            onClick={fetchOrders}
            className="px-4 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-300 text-sm hover:bg-slate-700 hover:text-white transition-all flex items-center gap-2 shadow-sm"
          >
            <RefreshCcw size={16} />
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
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center">
                  <span className="text-indigo-400 font-black text-lg">#{scannedOrder.order_token}</span>
                </div>
                <div>
                  <p className="text-white font-bold text-lg">Order Found</p>
                  <p className="text-slate-400 text-sm">{scannedOrder.restaurant_name}</p>
                </div>
              </div>
              <button onClick={() => setScannedOrder(null)} className="text-slate-500 hover:text-white transition-colors bg-slate-800/50 p-2 rounded-full"><X size={20} /></button>
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
      {/* QR Camera Scanner */}
      {showScanner && (
        <QrScannerModal
          onClose={() => setShowScanner(false)}
          onScan={async (token) => {
            setShowScanner(false);
            try {
              const res = await api.get(`/admin/orders/scan/${token}`);
              setScannedOrder(res.data);
            } catch {
              setSearchError('Order not found for scanned token');
            }
          }}
        />
      )}

      {/* Kanban Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100%-5rem)]">
        {STATUS_COLUMNS.map((col) => {
          const colOrders = orders.filter((o) => o.status === col.key);
          return (
            <div key={col.key} className="flex flex-col min-h-0">
              {/* Column Header */}
              <div className="flex items-center gap-2.5 mb-5 px-1">
                <div className={`w-8 h-8 rounded-lg bg-${col.color}-500/10 border border-${col.color}-500/20 flex items-center justify-center text-${col.color}-400 shadow-lg shadow-${col.color}-500/5`}>
                  {col.icon}
                </div>
                <h2 className="text-slate-200 font-semibold">{col.label}</h2>
                <div className={`ml-auto px-2.5 py-0.5 rounded-md text-xs font-bold bg-${col.color}-500/15 text-${col.color}-400 border border-${col.color}-500/20`}>
                  {colOrders.length}
                </div>
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
                      className="bg-slate-900/60 border border-slate-700/50 rounded-2xl p-5 backdrop-blur-md hover:border-slate-600/80 hover:bg-slate-800/80 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-0.5 group"
                    >
                      {/* Order Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <div className="flex items-center gap-2.5 mb-1">
                            {order.order_token && (
                              <span className="px-2.5 py-1 rounded-md bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 text-xs font-bold tracking-widest shadow-sm">
                                {order.order_token}
                              </span>
                            )}
                            <p className="text-slate-300 font-mono text-xs opacity-70">
                              #{order.id.slice(-6).toUpperCase()}
                            </p>
                          </div>
                          <p className="text-slate-400 text-xs font-medium">{order.restaurant_name}</p>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-500 bg-slate-950/50 px-2.5 py-1 rounded-full border border-white/5">
                          <Clock size={12} className="text-amber-400/80" />
                          <span className="text-xs font-medium">
                            {getTimeAgo(order.created_at)}
                          </span>
                        </div>
                      </div>

                      {/* Customer */}
                      <div className="flex items-center gap-3 mb-4 p-3 bg-slate-950/40 rounded-xl border border-white/5">
                        <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center shadow-inner">
                          <span className="text-slate-300 text-xs font-bold">
                            {order.user_name?.charAt(0)?.toUpperCase() || '?'}
                          </span>
                        </div>
                        <div>
                          <p className="text-slate-200 text-xs font-semibold">{order.user_name}</p>
                          <p className="text-slate-500 text-[10px] font-medium tracking-wide">{order.user_phone}</p>
                        </div>
                      </div>

                      {/* Items */}
                      <div className="space-y-2.5 mb-4">
                        {order.items?.filter(i => i.item_name).map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between group-hover:bg-white/[0.02] p-1.5 -mx-1.5 rounded-lg transition-colors">
                            <div className="flex items-center gap-3">
                              <span className="text-indigo-400 text-xs font-bold bg-indigo-500/10 px-2 py-0.5 rounded-md min-w-[28px] text-center">
                                {item.quantity}x
                              </span>
                              <span className="text-slate-300 text-sm font-medium">{item.item_name}</span>
                            </div>
                            <span className="text-slate-500 text-sm font-semibold">
                              ₹{(parseFloat(item.price_at_time) * item.quantity).toFixed(0)}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Total */}
                      <div className="flex items-center justify-between pt-4 border-t border-slate-700/50 mb-4">
                        <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Total</span>
                        <span className="text-white font-bold text-lg tracking-tight">
                          ₹{parseFloat(order.total_amount).toFixed(0)}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => updateStatus(order.id, order.status)}
                          className={`flex-1 py-2.5 rounded-xl text-xs font-bold tracking-wide transition-all shadow-lg ${
                            col.key === 'pending'
                              ? 'bg-amber-500 text-slate-900 hover:bg-amber-400 shadow-amber-500/20'
                              : col.key === 'preparing'
                              ? 'bg-indigo-500 text-white hover:bg-indigo-400 shadow-indigo-500/20'
                              : 'bg-emerald-500 text-slate-900 hover:bg-emerald-400 shadow-emerald-500/20'
                          }`}
                        >
                          {ACTION_LABELS[order.status]}
                        </button>
                        {col.key === 'pending' && (
                          <button
                            onClick={() => cancelOrder(order.id)}
                            className="px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold tracking-wide hover:bg-red-500/20 hover:text-red-300 transition-all"
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
