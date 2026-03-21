import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { Check, X, RotateCcw, Clock, AlertTriangle, ShieldCheck } from 'lucide-react';

interface RefundRequest {
  id: string;
  order_id: string;
  order_token: string;
  order_status: string;
  reason: string;
  amount: string;
  status: string;
  admin_note: string | null;
  customer_name: string;
  customer_phone: string;
  restaurant_name: string;
  requested_by_name: string;
  requested_by_role: string;
  approved_by_name: string | null;
  order_items: { item_name: string; quantity: number; price_at_time: string }[];
  created_at: string;
  resolved_at: string | null;
}

const STATUS_PILL: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-400 border-amber-500/15',
  approved: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/15',
  rejected: 'bg-red-500/10 text-red-400 border-red-500/15',
};

export default function RefundQueue() {
  const [requests, setRequests] = useState<RefundRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [rejectModal, setRejectModal] = useState<RefundRequest | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [processing, setProcessing] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filter) params.status = filter;
      const res = await api.get('/admin/refund-requests', { params });
      setRequests(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); } }, [toast]);

  const handleApprove = async (req: RefundRequest) => {
    setProcessing(req.id);
    try {
      const res = await api.post(`/admin/refund-requests/${req.id}/approve`);
      setToast({ msg: res.data.message || 'Refund approved ✓', type: 'success' });
      fetchRequests();
    } catch (err: any) {
      setToast({ msg: err.response?.data?.message || 'Failed to approve', type: 'error' });
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    setProcessing(rejectModal.id);
    try {
      await api.post(`/admin/refund-requests/${rejectModal.id}/reject`, { note: rejectNote.trim() || undefined });
      setToast({ msg: 'Refund request rejected', type: 'success' });
      setRejectModal(null);
      setRejectNote('');
      fetchRequests();
    } catch (err: any) {
      setToast({ msg: err.response?.data?.message || 'Failed to reject', type: 'error' });
    } finally {
      setProcessing(null);
    }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const pendingCount = requests.filter(r => r.status === 'pending').length;

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
      <div className="flex items-end justify-between mb-10 animate-fade-up">
        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-red-500/20 flex items-center justify-center">
              <ShieldCheck size={20} className="text-amber-400" />
            </div>
            <div>
              <h1 className="text-[28px] font-extrabold text-white tracking-[-0.03em]">Refund Queue</h1>
              <p className="text-slate-500 text-[14px] font-medium">
                {filter === 'pending' && pendingCount > 0 ? (
                  <><span className="text-amber-400 font-bold">{pendingCount}</span> awaiting your approval</>
                ) : (
                  <><span className="text-white font-bold">{requests.length}</span> requests</>
                )}
              </p>
            </div>
          </div>
        </div>
        <div className="flex gap-1.5">
          {['pending', 'approved', 'rejected', ''].map((s) => (
            <button key={s}
              onClick={() => setFilter(s)}
              className={`px-4 py-2 rounded-xl text-[11px] font-bold tracking-wider uppercase transition-all btn-press ${
                filter === s
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
      ) : requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 animate-fade-up">
          <div className="w-16 h-16 rounded-2xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-center mb-4">
            <RotateCcw size={28} className="text-slate-600" />
          </div>
          <p className="text-slate-500 text-[15px] font-semibold">No refund requests</p>
          <p className="text-slate-600 text-[13px] mt-1">
            {filter === 'pending' ? 'All caught up! No pending approvals.' : 'No requests match this filter.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((req, idx) => (
            <div
              key={req.id}
              className="bg-white/[0.015] border border-white/[0.04] rounded-2xl p-6 hover:bg-white/[0.025] transition-all duration-200 animate-fade-up"
              style={{ animationDelay: `${idx * 50}ms` }}
            >
              <div className="flex items-start justify-between gap-6">
                {/* Left — Order Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-indigo-400 font-mono text-[12px] font-bold bg-indigo-500/8 px-2.5 py-1 rounded-lg">
                      #{req.order_token || req.order_id.slice(-6).toUpperCase()}
                    </span>
                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest border ${STATUS_PILL[req.status]}`}>
                      {req.status}
                    </span>
                    <span className="text-white text-[18px] font-extrabold ml-auto">₹{parseFloat(req.amount).toFixed(0)}</span>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-3">
                    <div>
                      <p className="text-slate-600 text-[10px] font-bold uppercase tracking-wider mb-0.5">Customer</p>
                      <p className="text-white text-[13px] font-semibold">{req.customer_name}</p>
                      <p className="text-slate-600 text-[11px]">{req.customer_phone}</p>
                    </div>
                    <div>
                      <p className="text-slate-600 text-[10px] font-bold uppercase tracking-wider mb-0.5">Restaurant</p>
                      <p className="text-slate-400 text-[13px]">{req.restaurant_name}</p>
                    </div>
                    <div>
                      <p className="text-slate-600 text-[10px] font-bold uppercase tracking-wider mb-0.5">Requested By</p>
                      <p className="text-slate-400 text-[13px]">{req.requested_by_name}</p>
                      <p className="text-slate-600 text-[11px] capitalize">{req.requested_by_role?.replace('_', ' ')}</p>
                    </div>
                  </div>

                  {/* Items */}
                  <div className="flex flex-wrap gap-2 mb-3">
                    {req.order_items?.filter(i => i.item_name).map(i => (
                      <span key={i.item_name} className="text-slate-500 text-[11px] bg-white/[0.03] px-2 py-0.5 rounded-lg">
                        <span className="text-indigo-400 font-bold">{i.quantity}x</span> {i.item_name}
                      </span>
                    ))}
                  </div>

                  {/* Reason */}
                  <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl px-4 py-3">
                    <p className="text-amber-300/60 text-[10px] font-bold uppercase tracking-wider mb-1">Reason</p>
                    <p className="text-slate-300 text-[13px] leading-relaxed">{req.reason}</p>
                  </div>

                  {/* Admin note (if rejected) */}
                  {req.admin_note && req.status === 'rejected' && (
                    <div className="bg-red-500/5 border border-red-500/10 rounded-xl px-4 py-3 mt-2">
                      <p className="text-red-300/60 text-[10px] font-bold uppercase tracking-wider mb-1">Rejection Note</p>
                      <p className="text-slate-300 text-[13px]">{req.admin_note}</p>
                    </div>
                  )}

                  {req.approved_by_name && (
                    <p className="text-slate-600 text-[11px] mt-2">
                      {req.status === 'approved' ? 'Approved' : 'Reviewed'} by <span className="text-slate-400 font-semibold">{req.approved_by_name}</span>
                      {req.resolved_at && <> on {formatDate(req.resolved_at)}</>}
                    </p>
                  )}

                  <p className="text-slate-700 text-[11px] mt-1 flex items-center gap-1">
                    <Clock size={11} /> {formatDate(req.created_at)}
                  </p>
                </div>

                {/* Right — Actions (only for pending) */}
                {req.status === 'pending' && (
                  <div className="flex flex-col gap-2 shrink-0">
                    <button
                      onClick={() => handleApprove(req)}
                      disabled={processing === req.id}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/15 text-emerald-400 text-[12px] font-bold hover:bg-emerald-500/20 transition-all disabled:opacity-30 btn-press"
                    >
                      {processing === req.id ? (
                        <div className="w-4 h-4 border-2 border-emerald-400/40 border-t-emerald-400 rounded-full animate-spin" />
                      ) : (
                        <Check size={15} />
                      )}
                      Approve & Refund
                    </button>
                    <button
                      onClick={() => { setRejectModal(req); setRejectNote(''); }}
                      disabled={processing === req.id}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-500/6 border border-red-500/12 text-red-400 text-[12px] font-bold hover:bg-red-500/15 transition-all disabled:opacity-30 btn-press"
                    >
                      <X size={15} /> Reject
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Reject Modal ── */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setRejectModal(null)}>
          <div className="bg-[#0c0e16] border border-white/[0.06] rounded-2xl p-8 w-full max-w-md shadow-2xl animate-fade-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                <AlertTriangle size={20} className="text-red-400" />
              </div>
              <div>
                <h3 className="text-white text-[18px] font-extrabold">Reject Refund</h3>
                <p className="text-slate-500 text-[12px] mt-0.5">Order #{rejectModal.order_token || rejectModal.order_id.slice(-6).toUpperCase()} • ₹{parseFloat(rejectModal.amount).toFixed(0)}</p>
              </div>
            </div>

            <label className="block text-slate-400 text-[12px] font-bold uppercase tracking-wider mb-2">
              Note (optional)
            </label>
            <textarea
              value={rejectNote}
              onChange={e => setRejectNote(e.target.value)}
              placeholder="e.g. Student already received the food, refund not applicable..."
              rows={3}
              className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3 text-white text-[13px] placeholder-slate-600 focus:outline-none focus:border-red-500/30 resize-none transition-colors"
            />

            <div className="flex gap-3 mt-6">
              <button onClick={() => setRejectModal(null)}
                className="flex-1 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-slate-400 text-[13px] font-semibold hover:bg-white/[0.06] transition-all btn-press">
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={processing === rejectModal.id}
                className="flex-1 py-3 rounded-xl bg-red-500/15 border border-red-500/20 text-red-400 text-[13px] font-bold hover:bg-red-500/25 transition-all disabled:opacity-30 btn-press flex items-center justify-center gap-2">
                {processing === rejectModal.id ? (
                  <div className="w-4 h-4 border-2 border-red-400/40 border-t-red-400 rounded-full animate-spin" />
                ) : (
                  <><X size={14} /> Confirm Reject</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
