import { useEffect, useState, useCallback } from 'react';
import api from '../services/api';
import { AlertTriangle, RefreshCw, CheckCircle2, Undo2, Clock, User } from 'lucide-react';

interface StuckOrder {
  id: string;
  order_token: string | null;
  status: string;
  total_amount: string;
  payment_id: string | null;
  created_at: string;
  user_id: string;
  user_name: string | null;
  user_phone: string | null;
  restaurant_name: string | null;
  minutes_stuck: number;
}

const THRESHOLDS = [15, 30, 60, 120];

export default function StuckOrders() {
  const [orders, setOrders] = useState<StuckOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [minutes, setMinutes] = useState(30);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [confirm, setConfirm] = useState<{ order: StuckOrder; action: 'complete' | 'cancel_refund' } | null>(null);

  const fetchOrders = useCallback(async (mins: number) => {
    setLoading(true);
    try {
      const res = await api.get(`/superadmin/stuck-orders?minutes=${mins}`);
      setOrders(res.data.orders || []);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchOrders(minutes); }, [fetchOrders, minutes]);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 5000);
    return () => clearTimeout(t);
  }, [message]);

  const resolve = async () => {
    if (!confirm) return;
    const { order, action } = confirm;
    setBusyId(order.id);
    setConfirm(null);
    try {
      const res = await api.post(`/superadmin/stuck-orders/${order.id}/resolve`, { action });
      setMessage({ type: 'success', text: res.data.message });
      setOrders((prev) => prev.filter((o) => o.id !== order.id));
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to resolve order' });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="p-8 lg:p-12 max-w-6xl mx-auto space-y-8 animate-fade-up font-body min-h-[calc(100vh-2rem)]">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-4xl font-display font-bold text-[#e5e2e1] mb-2 tracking-tight">Stuck Orders</h1>
          <p className="text-[#a38b88] text-sm">Orders hung in <span className="text-[#dcc0bd]">pending</span> or <span className="text-[#dcc0bd]">preparing</span> longer than the threshold.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-[#1c1b1b] border border-[#554240]/20 rounded-xl p-1">
            {THRESHOLDS.map((t) => (
              <button key={t} onClick={() => setMinutes(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${minutes === t ? 'bg-[#f0513e] text-white' : 'text-[#a38b88] hover:text-[#e5e2e1]'}`}>
                {t}m
              </button>
            ))}
          </div>
          <button onClick={() => fetchOrders(minutes)} disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1c1b1b] border border-[#554240]/20 text-[#dcc0bd] text-sm font-semibold hover:text-[#ffb4a8] transition disabled:opacity-50">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-xl text-sm font-medium ${message.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-[#93000a]/20 border border-[#93000a]/50 text-[#ffb4ab]'}`}>
          {message.text}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center p-20"><div className="animate-spin w-8 h-8 border-2 border-[#f0513e] border-t-transparent rounded-full" /></div>
      ) : orders.length === 0 ? (
        <div className="bg-[#1c1b1b] border border-[#554240]/15 rounded-2xl p-12 text-center">
          <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center mx-auto mb-3"><CheckCircle2 size={22} className="text-emerald-400" /></div>
          <p className="text-[#a38b88] text-sm font-medium">No stuck orders</p>
          <p className="text-[#554240] text-xs mt-1">Everything older than {minutes} minutes has been handled.</p>
        </div>
      ) : (
        <div className="bg-[#1c1b1b] border border-[#554240]/15 rounded-2xl overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#2a2828] text-[#a38b88] border-b border-[#554240]/20 text-xs font-semibold">
                <th className="p-4 font-display">Order</th>
                <th className="p-4 font-display">Customer</th>
                <th className="p-4 font-display">Restaurant</th>
                <th className="p-4 font-display">Status</th>
                <th className="p-4 font-display">Stuck For</th>
                <th className="p-4 font-display text-right">Amount</th>
                <th className="p-4 font-display text-right">Resolve</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#554240]/15">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-[#201f1f] transition">
                  <td className="p-4">
                    <span className="text-[#e5e2e1] text-sm font-mono font-bold">#{o.order_token || o.id.split('-')[0]}</span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-[#131313] border border-[#554240]/30 flex items-center justify-center"><User size={12} className="text-[#a38b88]" /></div>
                      <div>
                        <p className="text-[#e5e2e1] text-sm font-medium leading-tight">{o.user_name || 'Unknown'}</p>
                        <p className="text-[#a38b88] text-[11px] font-mono">{o.user_phone || '—'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-[#dcc0bd] text-sm">{o.restaurant_name || '—'}</td>
                  <td className="p-4">
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${o.status === 'pending' ? 'bg-[#eac34a]/10 text-[#eac34a] border-[#eac34a]/20' : 'bg-[#f0513e]/10 text-[#ffb4a8] border-[#f0513e]/20'}`}>
                      {o.status}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className="inline-flex items-center gap-1.5 text-[#ffb4ab] text-sm font-semibold">
                      <Clock size={13} /> {o.minutes_stuck}m
                    </span>
                  </td>
                  <td className="p-4 text-right text-[#e5e2e1] text-sm font-semibold">₹{Number(o.total_amount).toFixed(2)}</td>
                  <td className="p-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setConfirm({ order: o, action: 'complete' })}
                        disabled={busyId === o.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold rounded-lg hover:bg-emerald-500/20 transition disabled:opacity-50"
                      >
                        <CheckCircle2 size={13} /> Complete
                      </button>
                      <button
                        onClick={() => setConfirm({ order: o, action: 'cancel_refund' })}
                        disabled={busyId === o.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#93000a]/15 border border-[#93000a]/30 text-[#ffb4ab] text-xs font-semibold rounded-lg hover:bg-[#93000a]/30 transition disabled:opacity-50"
                      >
                        <Undo2 size={13} /> Cancel & Refund
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Confirm modal */}
      {confirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setConfirm(null)}>
          <div className="bg-[#1c1b1b] border border-[#554240]/20 w-full max-w-md rounded-2xl p-8 space-y-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-[#4c0000]/40 rounded-xl flex items-center justify-center shrink-0">
                <AlertTriangle size={22} className="text-[#ffb4a8]" />
              </div>
              <div>
                <h2 className="text-lg font-display font-bold text-[#e5e2e1]">
                  {confirm.action === 'complete' ? 'Force-complete order?' : 'Cancel & refund order?'}
                </h2>
                <p className="text-[#a38b88] text-xs mt-0.5">
                  Order #{confirm.order.order_token || confirm.order.id.split('-')[0]} · ₹{Number(confirm.order.total_amount).toFixed(2)}
                </p>
              </div>
            </div>
            <p className="text-[#dcc0bd] text-sm leading-relaxed">
              {confirm.action === 'complete'
                ? 'This marks the order as completed. Use this when the customer was actually served but the order never closed.'
                : "This cancels the order, refunds the full amount to the customer's wallet, restores stock, and notifies them."}
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setConfirm(null)} className="px-5 py-2.5 rounded-xl text-[#a38b88] hover:text-[#e5e2e1] text-sm font-semibold transition">Cancel</button>
              <button onClick={resolve}
                className={`px-5 py-2.5 rounded-xl text-sm font-bold transition flex items-center gap-2 ${confirm.action === 'complete' ? 'bg-emerald-500 text-[#06140c] hover:bg-emerald-400' : 'bg-[#93000a] text-white hover:bg-[#b31217]'}`}>
                {confirm.action === 'complete' ? <CheckCircle2 size={14} /> : <Undo2 size={14} />}
                {confirm.action === 'complete' ? 'Mark Completed' : 'Cancel & Refund'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
