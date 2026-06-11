import { useState } from 'react';
import api from '../services/api';
import { Megaphone, Send, AlertTriangle, CheckCircle2, Smartphone } from 'lucide-react';

export default function Broadcast() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [confirming, setConfirming] = useState(false);

  const canSend = title.trim().length > 0 && body.trim().length > 0;

  const send = async () => {
    setConfirming(false);
    setSending(true);
    setMessage(null);
    try {
      const res = await api.post('/superadmin/broadcast', { title: title.trim(), body: body.trim() });
      setMessage({ type: 'success', text: res.data.message });
      setTitle('');
      setBody('');
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to send broadcast' });
    } finally {
      setSending(false);
    }
  };

  const inputClass = "w-full px-4 py-3 rounded-xl bg-[#131313] border border-[#554240]/20 text-[#e5e2e1] text-sm focus:outline-none focus:ring-2 focus:ring-[#f0513e]/30 focus:border-[#f0513e]/40 transition-all placeholder-[#554240]";
  const labelClass = "text-[11px] font-bold text-[#a38b88] uppercase tracking-widest mb-2 flex items-center justify-between";

  return (
    <div className="p-8 lg:p-12 max-w-5xl mx-auto space-y-8 animate-fade-up font-body min-h-[calc(100vh-2rem)]">
      <div>
        <h1 className="text-4xl font-display font-bold text-[#e5e2e1] mb-2 tracking-tight">Broadcast</h1>
        <p className="text-[#a38b88] text-sm">Send an instant push notification to every app user. Use for outages, fixes, and important announcements.</p>
      </div>

      {message && (
        <div className={`p-4 rounded-xl text-sm font-medium flex items-center gap-2 ${message.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-[#93000a]/20 border border-[#93000a]/50 text-[#ffb4ab]'}`}>
          {message.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />} {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Composer */}
        <div className="lg:col-span-3 bg-[#1c1b1b] border border-[#554240]/15 rounded-2xl p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-[#4c0000]/40 border border-[#f0513e]/20 rounded-xl flex items-center justify-center">
              <Megaphone size={20} className="text-[#ffb4a8]" />
            </div>
            <div>
              <h2 className="text-lg font-display font-bold text-[#e5e2e1]">Compose Announcement</h2>
              <p className="text-[#a38b88] text-xs">Delivered as a push notification + in-app alert</p>
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <label className={labelClass}><span>Title</span><span className={title.length > 120 ? 'text-[#ffb4ab]' : 'text-[#554240]'}>{title.length}/120</span></label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="e.g. Canteen reopening at 2 PM" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}><span>Message</span><span className={body.length > 500 ? 'text-[#ffb4ab]' : 'text-[#554240]'}>{body.length}/500</span></label>
              <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={500} rows={5} placeholder="Write the announcement the students and staff will see…" className={`${inputClass} resize-none`} />
            </div>
            <div className="flex justify-end pt-2">
              <button onClick={() => setConfirming(true)} disabled={!canSend || sending}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#f0513e] to-[#d32f2f] text-white text-sm font-bold hover:shadow-lg hover:shadow-[#f0513e]/20 transition-all disabled:opacity-50 flex items-center gap-2">
                {sending ? <><div className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" /> Sending...</> : <><Send size={14} /> Send Broadcast</>}
              </button>
            </div>
          </div>
        </div>

        {/* Live preview */}
        <div className="lg:col-span-2 space-y-4">
          <p className={labelClass.replace('justify-between', '')}><Smartphone size={11} /> Preview</p>
          <div className="bg-[#131313] border border-[#554240]/20 rounded-2xl p-4 shadow-xl">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#f0513e] to-[#8B1C28] flex items-center justify-center shrink-0">
                <Megaphone size={16} className="text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-[#e5e2e1] text-sm font-bold truncate">{title.trim() || 'Notification title'}</p>
                <p className="text-[#a38b88] text-xs mt-0.5 leading-relaxed break-words">{body.trim() || 'Your message body will appear here.'}</p>
                <p className="text-[#554240] text-[10px] mt-1.5">Ahmedabad University Canteen · now</p>
              </div>
            </div>
          </div>
          <div className="p-4 rounded-xl bg-[#eac34a]/8 border border-[#eac34a]/20 flex items-start gap-2.5">
            <AlertTriangle size={15} className="text-[#eac34a] shrink-0 mt-0.5" />
            <p className="text-[#dcc0bd] text-xs leading-relaxed">This reaches <strong>all</strong> app users immediately and cannot be unsent. Double-check before sending.</p>
          </div>
        </div>
      </div>

      {/* Confirm modal */}
      {confirming && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setConfirming(false)}>
          <div className="bg-[#1c1b1b] border border-[#554240]/20 w-full max-w-md rounded-2xl p-8 space-y-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-[#4c0000]/40 rounded-xl flex items-center justify-center shrink-0"><Megaphone size={22} className="text-[#ffb4a8]" /></div>
              <div>
                <h2 className="text-lg font-display font-bold text-[#e5e2e1]">Send to all users?</h2>
                <p className="text-[#a38b88] text-xs mt-0.5">This push cannot be recalled.</p>
              </div>
            </div>
            <div className="bg-[#131313] border border-[#554240]/20 rounded-xl p-4">
              <p className="text-[#e5e2e1] text-sm font-bold">{title.trim()}</p>
              <p className="text-[#a38b88] text-xs mt-1 leading-relaxed">{body.trim()}</p>
            </div>
            <div className="flex justify-end gap-3 pt-1">
              <button onClick={() => setConfirming(false)} className="px-5 py-2.5 rounded-xl text-[#a38b88] hover:text-[#e5e2e1] text-sm font-semibold transition">Cancel</button>
              <button onClick={send} className="px-5 py-2.5 rounded-xl bg-[#f0513e] text-white text-sm font-bold hover:bg-[#d32f2f] transition flex items-center gap-2">
                <Send size={14} /> Send Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
