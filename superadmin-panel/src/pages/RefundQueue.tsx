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
  pending: 'bg-[#eac34a]/10 text-[#eac34a] border-[#eac34a]/20',
  approved: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  rejected: 'bg-[#f0513e]/10 text-[#f0513e] border-[#f0513e]/20',
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
    <div className="p-8 lg:p-12 max-w-7xl mx-auto animate-fade-in font-body">
      {/* ── Toast ── */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-xl text-sm font-semibold shadow-2xl animate-fade-up flex items-center gap-3 backdrop-blur-md ${
          toast.type === 'success' ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400' : 'bg-[#93000a]/40 border border-[#f0513e]/30 text-[#ffb4ab]'
        }`}>
          {toast.msg}
          <button onClick={() => setToast(null)} className="ml-2 opacity-60 hover:opacity-100 transition-opacity"><X size={16} /></button>
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row items-start md:items-end justify-between mb-10 gap-6 animate-fade-up">
        <div className="space-y-2">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#eac34a]/20 to-[#f0513e]/20 border border-[#f0513e]/20 flex items-center justify-center shadow-inner">
              <ShieldCheck size={24} className="text-[#ffb4a8]" />
            </div>
            <div>
              <h1 className="text-4xl font-display font-bold text-[#e5e2e1] tracking-tight">Refund Queue</h1>
              <p className="text-[#a38b88] text-sm font-medium mt-1">
                {filter === 'pending' && pendingCount > 0 ? (
                  <><span className="text-[#eac34a] font-bold">{pendingCount}</span> awaiting your approval</>
                ) : (
                  <><span className="text-[#e5e2e1] font-bold">{requests.length}</span> requests</>
                )}
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {['pending', 'approved', 'rejected', ''].map((s) => (
            <button key={s}
              onClick={() => setFilter(s)}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold tracking-widest uppercase transition-all duration-300 ${
                filter === s
                  ? 'bg-[#4c0000] text-[#ffb4a8] border border-[#f0513e]/30 shadow-[0_4px_20px_rgba(240,81,62,0.2)] shadow-inner'
                  : 'bg-[#1c1b1b] border border-[#554240]/20 text-[#a38b88] hover:text-[#e5e2e1] hover:bg-[#201f1f]'
              }`}>
              {s || 'All'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin w-8 h-8 border-2 border-[#f0513e] border-t-transparent rounded-full" />
        </div>
      ) : requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 animate-fade-up">
          <div className="w-20 h-20 rounded-2xl bg-[#1c1b1b] border border-[#554240]/15 flex items-center justify-center mb-5 shadow-inner">
            <RotateCcw size={32} className="text-[#554240]" />
          </div>
          <p className="text-[#a38b88] font-display font-semibold text-lg">No refund requests</p>
          <p className="text-[#554240] text-sm mt-1">
            {filter === 'pending' ? 'All caught up! No pending approvals.' : 'No requests match this filter.'}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {requests.map((req, idx) => (
            <div
              key={req.id}
              className="bg-[#1c1b1b] border border-[#554240]/15 rounded-2xl p-6 hover-ember hover:bg-[#201f1f] transition-all duration-300 animate-fade-up shadow-lg"
              style={{ animationDelay: `${idx * 40}ms` }}
            >
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8 lg:gap-6">
                {/* Left — Order Info */}
                <div className="flex-1 min-w-0 w-full">
                  <div className="flex flex-wrap items-center gap-3 mb-4">
                    <span className="text-[#ffb4a8] font-mono text-xs font-bold bg-[#4c0000]/50 border border-[#f0513e]/20 px-3 py-1 rounded-md shadow-inner">
                      #{req.order_token || req.order_id.slice(-6).toUpperCase()}
                    </span>
                    <span className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest border ${STATUS_PILL[req.status]}`}>
                      {req.status}
                    </span>
                    <span className="text-[#eac34a] text-xl font-display font-bold lg:ml-auto block w-full lg:w-auto mt-2 lg:mt-0">
                      ₹{parseFloat(req.amount).toFixed(0)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-5 bg-[#131313]/50 border border-[#554240]/10 rounded-xl p-4">
                    <div>
                      <p className="label-premium mb-1">Customer</p>
                      <p className="text-[#e5e2e1] text-sm font-semibold">{req.customer_name}</p>
                      <p className="text-[#a38b88] text-xs mt-0.5">{req.customer_phone}</p>
                    </div>
                    <div>
                      <p className="label-premium mb-1">Restaurant</p>
                      <p className="text-[#dcc0bd] text-sm">{req.restaurant_name}</p>
                    </div>
                    <div className="col-span-2 md:col-span-1 border-t md:border-t-0 border-[#554240]/10 pt-4 md:pt-0">
                      <p className="label-premium mb-1">Requested By</p>
                      <p className="text-[#dcc0bd] text-sm space-x-2">
                        <span>{req.requested_by_name}</span>
                        <span className="text-[#554240] text-[10px] uppercase font-bold tracking-widest bg-[#1c1b1b] px-1.5 py-0.5 rounded border border-[#554240]/20">{req.requested_by_role?.replace('_', ' ')}</span>
                      </p>
                    </div>
                  </div>

                  {/* Items */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {req.order_items?.filter(i => i.item_name).map(i => (
                      <span key={i.item_name} className="text-[#dcc0bd] text-xs bg-[#131313] border border-[#554240]/20 px-2.5 py-1 rounded-md shadow-inner">
                        <span className="text-[#ffb4a8] font-bold">{i.quantity}x</span> {i.item_name}
                      </span>
                    ))}
                  </div>

                  {/* Reason */}
                  <div className="bg-[#eac34a]/5 border border-[#eac34a]/10 rounded-xl px-5 py-4">
                    <p className="text-[#eac34a]/70 text-[10px] font-bold uppercase tracking-widest mb-1.5">Reason</p>
                    <p className="text-[#e5e2e1] text-sm leading-relaxed">{req.reason}</p>
                  </div>

                  {/* Admin note (if rejected) */}
                  {req.admin_note && req.status === 'rejected' && (
                    <div className="bg-[#93000a]/10 border border-[#f0513e]/20 rounded-xl px-5 py-4 mt-3">
                      <p className="text-[#ffb4a8]/70 text-[10px] font-bold uppercase tracking-widest mb-1.5">Rejection Note</p>
                      <p className="text-[#e5e2e1] text-sm leading-relaxed">{req.admin_note}</p>
                    </div>
                  )}

                  <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-[#554240]/15 pt-4">
                    {req.approved_by_name ? (
                      <p className="text-[#a38b88] text-xs">
                        {req.status === 'approved' ? 'Approved' : 'Reviewed'} by <span className="text-[#e5e2e1] font-semibold">{req.approved_by_name}</span>
                        {req.resolved_at && <> on {formatDate(req.resolved_at)}</>}
                      </p>
                    ) : <div />}
                    <p className="text-[#554240] text-xs font-mono flex items-center gap-1.5 font-medium">
                      <Clock size={12} className="opacity-70" /> {formatDate(req.created_at)}
                    </p>
                  </div>
                </div>

                {/* Right — Actions (only for pending) */}
                {req.status === 'pending' && (
                  <div className="flex lg:flex-col gap-3 shrink-0 w-full lg:w-48 border-t lg:border-t-0 border-[#554240]/15 pt-4 lg:pt-0">
                    <button
                      onClick={() => handleApprove(req)}
                      disabled={processing === req.id}
                      className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-bold hover:bg-emerald-500/20 transition-all disabled:opacity-30 shadow-inner"
                    >
                      {processing === req.id ? (
                        <div className="w-5 h-5 border-2 border-emerald-400/40 border-t-emerald-400 rounded-full animate-spin" />
                      ) : (
                        <Check size={18} />
                      )}
                      Approve
                    </button>
                    <button
                      onClick={() => { setRejectModal(req); setRejectNote(''); }}
                      disabled={processing === req.id}
                      className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#93000a]/20 border border-[#f0513e]/20 text-[#ffb4ab] text-sm font-bold hover:bg-[#93000a]/40 transition-all disabled:opacity-30 shadow-inner"
                    >
                      <X size={18} /> Reject
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in p-4" onClick={() => setRejectModal(null)}>
          <div className="glass-panel rounded-2xl p-8 w-full max-w-md shadow-2xl animate-fade-up border border-[#f0513e]/20" onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 rounded-xl bg-[#93000a]/30 border border-[#f0513e]/30 flex items-center justify-center shrink-0 shadow-inner">
                <AlertTriangle size={24} className="text-[#ffb4ab]" />
              </div>
              <div>
                <h3 className="text-[#e5e2e1] text-xl font-display font-bold tracking-tight">Reject Refund</h3>
                <p className="text-[#a38b88] text-sm mt-1">Order #{rejectModal.order_token || rejectModal.order_id.slice(-6).toUpperCase()} • <span className="text-[#eac34a]">₹{parseFloat(rejectModal.amount).toFixed(0)}</span></p>
              </div>
            </div>

            <label className="label-premium block mb-2">
              Rejection Note (optional)
            </label>
            <textarea
              value={rejectNote}
              onChange={e => setRejectNote(e.target.value)}
              placeholder="e.g. Student already received the food, refund not applicable..."
              rows={4}
              className="w-full bg-[#131313] border border-[#554240]/30 rounded-xl px-4 py-3 text-[#e5e2e1] text-sm font-medium placeholder-[#554240] focus:outline-none focus:border-[#f0513e]/50 focus:ring-1 focus:ring-[#f0513e]/20 resize-none transition-all shadow-inner"
            />

            <div className="flex gap-3 mt-8">
              <button 
                onClick={() => setRejectModal(null)}
                className="flex-1 py-3.5 rounded-xl bg-[#1c1b1b] border border-[#554240]/20 text-[#a38b88] text-sm font-bold hover:text-[#e5e2e1] hover:bg-[#201f1f] transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={processing === rejectModal.id}
                className="flex-1 py-3.5 rounded-xl bg-[#93000a]/30 border border-[#f0513e]/30 text-[#ffb4ab] text-sm font-bold hover:bg-[#93000a]/50 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(240,81,62,0.15)] shadow-inner"
              >
                {processing === rejectModal.id ? (
                  <div className="w-5 h-5 border-2 border-[#ffb4ab]/40 border-t-[#ffb4ab] rounded-full animate-spin" />
                ) : (
                  <><X size={16} /> Confirm Reject</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
