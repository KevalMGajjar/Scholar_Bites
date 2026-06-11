import { useState, useEffect, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';
import { useRestaurant } from '../context/RestaurantContext';
import api from '../services/api';
import QrScannerModal from '../components/QrScannerModal';
import RestaurantFilter from '../components/RestaurantFilter';
import { Bell, ChefHat, CheckCircle2, Search, QrCode, RefreshCcw, X, Clock, ShieldAlert } from 'lucide-react';

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

// "New orders" are 'placed' for paid live orders, but 'pending' for staff pre-orders.
const STATUS_COLUMNS = [
  { key: 'new', statuses: { live: 'placed', preorders: 'pending' } as Record<string, string>, label: 'New Orders', color: 'amber', icon: <Bell size={16} /> },
  { key: 'preparing', statuses: { live: 'preparing', preorders: 'preparing' } as Record<string, string>, label: 'Preparing', color: 'indigo', icon: <ChefHat size={16} /> },
  { key: 'ready', statuses: { live: 'ready', preorders: 'ready' } as Record<string, string>, label: 'Ready', color: 'emerald', icon: <CheckCircle2 size={16} /> },
];

const STATUS_FLOW: Record<string, string> = {
  placed: 'preparing',
  pending: 'preparing',
  preparing: 'ready',
  ready: 'completed',
};

const ACTION_LABELS: Record<string, string> = {
  placed: 'Accept Order',
  pending: 'Accept Order',
  preparing: 'Mark Ready',
  ready: 'Complete',
};

export default function LiveOrders() {
  const { socket } = useSocket();
  const { selectedRestaurantId } = useRestaurant();
  const [orders, setOrders] = useState<Order[]>([]);
  const [preOrders, setPreOrders] = useState<any[]>([]); // Added for Pre-Orders
  const [viewMode, setViewMode] = useState<'live' | 'preorders'>('live'); // Added toggle
  const [loading, setLoading] = useState(true);
  const [tokenSearch, setTokenSearch] = useState('');
  const [scannedOrder, setScannedOrder] = useState<Order | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [scanWarning, setScanWarning] = useState<{ message: string; scanned_at?: string; token?: string } | null>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      if (viewMode === 'live') {
        const params: any = {};
        if (selectedRestaurantId) params.restaurant_id = selectedRestaurantId;
        const res = await api.get('/admin/orders/pending', { params });
        setOrders(res.data);
      } else {
        const res = await api.get('/admin/pre-orders/today');
        setPreOrders(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch orders', err);
    } finally {
      setLoading(false);
    }
  }, [selectedRestaurantId, viewMode]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  useEffect(() => {
    if (!socket) return;
    const handleNewOrder = (order: any) => {
      // Filter by selected restaurant if applicable
      if (selectedRestaurantId && order.restaurant_id && order.restaurant_id !== selectedRestaurantId) return;
      setOrders((prev) => {
        if (prev.find((o) => o.id === order.id)) return prev;
        return [order, ...prev];
      });
    };
    socket.on('new_order', handleNewOrder);
    return () => { socket.off('new_order', handleNewOrder); };
  }, [socket, selectedRestaurantId]);

  // Live status changes from any staff member → update/move/remove on every board
  useEffect(() => {
    if (!socket) return;
    const handleOrderUpdated = (order: any) => {
      if (selectedRestaurantId && order.restaurant_id && order.restaurant_id !== selectedRestaurantId) return;
      setOrders((prev) => {
        if (order.status === 'completed' || order.status === 'cancelled') {
          return prev.filter((o) => o.id !== order.id);
        }
        return prev.map((o) => (o.id === order.id ? { ...o, status: order.status } : o));
      });
    };
    socket.on('order_updated', handleOrderUpdated);
    return () => { socket.off('order_updated', handleOrderUpdated); };
  }, [socket, selectedRestaurantId]);

  const updateStatus = async (orderId: string, currentStatus: string) => {
    const nextStatus = STATUS_FLOW[currentStatus];
    if (!nextStatus) return;
    try {
      await api.patch(`/admin/orders/${orderId}/status`, { status: nextStatus });
      if (nextStatus === 'completed') {
        setOrders((prev) => prev.filter((o) => o.id !== orderId));
      } else {
        setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: nextStatus } : o)));
      }
    } catch (err: any) {
      // e.g. prep-limit reached (409) — keep the order in New Orders and tell the staff why
      alert(err?.response?.data?.message || 'Failed to update status');
    }
  };

  const updatePreOrderStatus = async (preOrderId: string, currentStatus: string) => {
    const nextStatus = STATUS_FLOW[currentStatus];
    if (!nextStatus) return;
    try {
      await api.patch(`/admin/pre-orders/${preOrderId}/status`, { status: nextStatus });
      if (nextStatus === 'completed') {
        setPreOrders((prev) => prev.filter((o) => o.id !== preOrderId));
      } else {
        setPreOrders((prev) => prev.map((o) => (o.id === preOrderId ? { ...o, status: nextStatus } : o)));
      }
    } catch (err) { console.error('Failed to update pre-order status', err); }
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
        <div className="animate-spin w-6 h-6 border-2 border-indigo-500/40 border-t-indigo-500 rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-8 h-full animate-fade-in">
      {/* ── Header ── */}
      <div className="flex items-end justify-between mb-10 animate-fade-up">
        <div className="space-y-1.5">
          <div className="flex items-center gap-4">
            <h1 className="text-[28px] font-extrabold text-white tracking-[-0.03em]">Live Orders</h1>
            <div className="flex bg-[#0a0c14] p-1 rounded-xl border border-white/5 shadow-inner">
              <button onClick={() => setViewMode('live')} className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${viewMode === 'live' ? 'bg-indigo-500 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}>Live</button>
              <button onClick={() => setViewMode('preorders')} className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${viewMode === 'preorders' ? 'bg-indigo-500 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}>Staff Pre-Orders</button>
            </div>
          </div>
          <p className="text-slate-500 text-[14px] font-medium">
            <span className="text-white font-bold">{viewMode === 'live' ? orders.length : preOrders.length}</span> active order{orders.length !== 1 ? 's' : ''} across all restaurants
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <RestaurantFilter />
          <div className="relative group">
            <input
              type="text"
              placeholder="Search code…"
              value={tokenSearch}
              onChange={(e) => setTokenSearch(e.target.value.toUpperCase())}
              className="w-48 px-4 py-2.5 pl-10 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-white text-[13px] placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all"
            />
            <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-indigo-400 transition-colors" />
            {tokenSearch && (
              <button onClick={() => setTokenSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-300" title="Clear">
                <X size={13} />
              </button>
            )}
          </div>
          <button onClick={() => setShowScanner(true)}
            className="px-4 py-2.5 rounded-2xl bg-indigo-500/8 border border-indigo-500/15 text-indigo-400 text-[12px] font-bold hover:bg-indigo-500/15 transition-all flex items-center gap-2 btn-press">
            <QrCode size={14} /> Scan QR
          </button>
          <button onClick={fetchOrders}
            className="p-2.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-slate-500 hover:text-white hover:bg-white/[0.06] transition-all btn-press">
            <RefreshCcw size={15} />
          </button>
        </div>
      </div>

      {/* ── Scanned Order Modal ── */}
      {scannedOrder && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in" onClick={() => setScannedOrder(null)}>
          <div className="bg-[#0c0f18] border border-white/[0.06] rounded-3xl p-8 max-w-md w-full shadow-2xl animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500/15 to-purple-500/15 border border-indigo-500/20 flex items-center justify-center">
                  <span className="text-indigo-400 font-black text-xl">#{scannedOrder.order_token}</span>
                </div>
                <div>
                  <p className="text-white font-bold text-lg tracking-[-0.02em]">Order Found</p>
                  <p className="text-slate-500 text-sm">{scannedOrder.restaurant_name}</p>
                </div>
              </div>
              <button onClick={() => setScannedOrder(null)} className="text-slate-600 hover:text-white transition-colors p-2 rounded-xl hover:bg-white/5"><X size={18} /></button>
            </div>
            <div className="bg-white/[0.02] rounded-2xl p-5 mb-6 border border-white/[0.04]">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center"><span className="text-white text-sm font-bold">{scannedOrder.user_name?.charAt(0)?.toUpperCase() || '?'}</span></div>
                <div><p className="text-white text-sm font-semibold">{scannedOrder.user_name}</p><p className="text-slate-600 text-xs">{scannedOrder.user_phone}</p></div>
              </div>
              <div className="space-y-2.5">
                {scannedOrder.items?.filter(i => i.item_name).map((item, idx) => (
                  <div key={idx} className="flex justify-between"><span className="text-slate-400 text-sm"><span className="text-indigo-400 font-bold">{item.quantity}x</span> {item.item_name}</span><span className="text-slate-600 text-sm">₹{(parseFloat(item.price_at_time) * item.quantity).toFixed(0)}</span></div>
                ))}
              </div>
              <div className="flex justify-between mt-4 pt-4 border-t border-white/[0.06]"><span className="text-slate-500 text-sm font-medium">Total</span><span className="text-white font-bold text-lg">₹{parseFloat(scannedOrder.total_amount).toFixed(0)}</span></div>
            </div>
            <div className="flex gap-2.5">
              <button onClick={async () => { const next = STATUS_FLOW[scannedOrder.status]; if (next) { await updateStatus(scannedOrder.id, scannedOrder.status); setScannedOrder(null); } }}
                className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-bold text-sm hover:shadow-lg hover:shadow-indigo-500/20 transition-all btn-press">
                {ACTION_LABELS[scannedOrder.status] || 'Done'}
              </button>
              <button onClick={() => setScannedOrder(null)} className="px-5 py-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-slate-400 text-sm font-semibold hover:bg-white/[0.06] transition-all btn-press">Close</button>
            </div>
          </div>
        </div>
      )}

      {showScanner && (
        <QrScannerModal
          onClose={() => setShowScanner(false)}
          onScan={async (token) => {
            setShowScanner(false);
            setScanWarning(null);
            try {
              const res = await api.get(`/admin/orders/scan/${token}`);
              setScannedOrder(res.data);
            } catch (err: any) {
              if (err?.response?.status === 409) {
                const data = err.response.data;
                setScanWarning({ message: data.message, scanned_at: data.scanned_at, token: data.order_token });
              } else { alert('Order not found for scanned token'); }
            }
          }}
        />
      )}

      {/* ── Already Scanned Warning Modal ── */}
      {scanWarning && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in" onClick={() => setScanWarning(null)}>
          <div className="bg-[#0c0f18] border border-red-500/20 rounded-3xl p-8 max-w-sm w-full shadow-2xl animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <ShieldAlert size={32} className="text-red-400" />
              </div>
              <div>
                <h3 className="text-white font-extrabold text-xl tracking-[-0.02em] mb-1">Already Scanned</h3>
                {scanWarning.token && <p className="text-red-400 font-mono font-bold text-lg">#{scanWarning.token}</p>}
              </div>
              <p className="text-slate-400 text-sm leading-relaxed">{scanWarning.message}</p>
              {scanWarning.scanned_at && (
                <div className="bg-white/[0.03] rounded-xl px-4 py-3 w-full border border-white/[0.06]">
                  <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest mb-1">First Scanned At</p>
                  <p className="text-white font-semibold text-sm">{new Date(scanWarning.scanned_at).toLocaleString()}</p>
                </div>
              )}
              <p className="text-red-400/60 text-xs font-medium">⚠️ This may indicate a duplicate pickup attempt</p>
              <button onClick={() => setScanWarning(null)}
                className="w-full py-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-slate-400 font-bold text-sm hover:bg-white/[0.06] transition-all btn-press mt-2">
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Kanban Columns ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-[calc(100%-7rem)]">
        {STATUS_COLUMNS.map((col, colIdx) => {
          const wantStatus = col.statuses[viewMode];
          // Live token filter: match the stable order_token. The scanned QR is
          // `TOKEN:rotating-hmac`, so strip anything after ':' before comparing.
          const rawSearch = tokenSearch.trim().toUpperCase();
          const searchTerm = rawSearch.includes(':') ? rawSearch.split(':')[0] : rawSearch;
          const colOrders = (viewMode === 'live' ? orders : preOrders)
            .filter((o) => o.status === wantStatus)
            .filter((o) => !searchTerm || (o.order_token || '').toUpperCase().includes(searchTerm));
          return (
            <div key={col.key} className="flex flex-col min-h-0 animate-fade-up" style={{ animationDelay: `${colIdx * 100}ms` }}>
              {/* Column Header */}
              <div className="flex items-center gap-3 mb-6">
                <div className={`w-8 h-8 rounded-xl bg-${col.color}-500/10 flex items-center justify-center text-${col.color}-400`}>
                  {col.icon}
                </div>
                <h2 className="text-[14px] font-bold text-white tracking-[-0.01em]">{col.label}</h2>
                <div className={`ml-auto text-[12px] font-bold text-${col.color}-400 bg-${col.color}-500/10 px-2.5 py-0.5 rounded-lg`}>
                  {colOrders.length}
                </div>
              </div>

              {/* Orders */}
              <div className="flex-1 space-y-3 overflow-y-auto pr-1 stagger-children">
                {colOrders.length === 0 ? (
                  <div className="flex items-center justify-center h-32 border border-dashed border-white/[0.06] rounded-2xl">
                    <p className="text-slate-700 text-[13px] font-medium">No orders</p>
                  </div>
                ) : (
                  colOrders.map((order) => (
                    <div key={order.id}
                      className="bg-white/[0.02] border border-white/[0.04] rounded-2xl p-5 hover:bg-white/[0.04] hover:border-white/[0.08] transition-all duration-300 hover-lift group">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-3.5">
                        <div className="flex items-center gap-2">
                          {order.order_token && (
                            <span className="px-2 py-0.5 rounded-lg bg-indigo-500/10 text-indigo-400 text-[11px] font-bold tracking-widest">{order.order_token}</span>
                          )}
                          <span className="text-slate-600 font-mono text-[10px]">#{order.id.slice(-6).toUpperCase()}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-600">
                          <Clock size={11} className="text-amber-400/60" />
                          <span className="text-[11px] font-medium">{getTimeAgo(order.created_at)}</span>
                        </div>
                      </div>

                      {/* Restaurant & Order Type */}
                      <div className="flex justify-between items-center mb-3">
                        <p className="text-slate-500 text-[11px] font-semibold uppercase tracking-wider">{order.restaurant_name}</p>
                        {viewMode === 'preorders' && (
                          <span className="px-2 py-0.5 rounded-lg bg-orange-500/10 text-orange-400 text-[10px] font-bold tracking-widest uppercase">Pre-Order ({new Date(order.pre_order_date).toLocaleTimeString([], {hour: '2-digit'})})</span>
                        )}
                      </div>

                      {/* Customer */}
                      <div className="flex items-center gap-2.5 mb-3.5 pb-3.5 border-b border-white/[0.04]">
                        <div className="w-7 h-7 rounded-lg bg-white/[0.04] flex items-center justify-center">
                          <span className="text-slate-400 text-[10px] font-bold">{order.user_name?.charAt(0)?.toUpperCase() || '?'}</span>
                        </div>
                        <div>
                          <p className="text-white text-[12px] font-semibold">{order.user_name}</p>
                          <p className="text-slate-600 text-[10px]">{order.user_phone}</p>
                        </div>
                      </div>

                      {/* Items */}
                      <div className="space-y-2 mb-3.5">
                        {order.items?.filter((i: any) => i.item_name || i.food_name).map((item: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-indigo-400 text-[11px] font-bold bg-indigo-500/8 px-1.5 py-0.5 rounded-md min-w-[24px] text-center">{item.quantity}x</span>
                              <span className="text-slate-300 text-[13px]">{item.item_name || item.food_name}</span>
                            </div>
                            <span className="text-slate-600 text-[13px] font-medium">₹{(parseFloat(item.price_at_time || item.price) * item.quantity).toFixed(0)}</span>
                          </div>
                        ))}
                      </div>

                      {/* Total */}
                      <div className="flex items-center justify-between pt-3 border-t border-white/[0.04] mb-4">
                        <span className="text-slate-600 text-[10px] font-bold uppercase tracking-widest">Total</span>
                        <span className="text-white font-extrabold text-[18px] tracking-[-0.02em]">₹{parseFloat(order.total_amount).toFixed(0)}</span>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <button onClick={() => viewMode === 'live' ? updateStatus(order.id, order.status) : updatePreOrderStatus(order.id, order.status)}
                          className={`flex-1 py-2.5 rounded-xl text-[12px] font-bold tracking-wide transition-all btn-press ${
                            col.key === 'new' ? 'bg-amber-500 text-slate-900 hover:shadow-lg hover:shadow-amber-500/20'
                            : col.key === 'preparing' ? 'bg-indigo-500 text-white hover:shadow-lg hover:shadow-indigo-500/20'
                            : 'bg-emerald-500 text-slate-900 hover:shadow-lg hover:shadow-emerald-500/20'
                          }`}>
                          {ACTION_LABELS[order.status]}
                        </button>
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
