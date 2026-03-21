import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { Plus, Store, Clock, Star, Edit2, X } from 'lucide-react';

interface Restaurant {
  id: string;
  name: string;
  logo_url: string;
  cover_url: string;
  rating: number;
  tags: string[];
  is_open: boolean;
  prep_time_minutes: number;
  opening_time: string | null;
  closing_time: string | null;
}

export default function Restaurants() {
  const { user } = useAuth();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Restaurant | null>(null);
  const [form, setForm] = useState({ name: '', rating: 4.5, tags: '', prep_time_minutes: 15, opening_time: '09:00', closing_time: '22:00' });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  const fetchRestaurants = useCallback(async () => {
    try { const res = await api.get(`/admin/restaurants/${user?.university_id}`); setRestaurants(res.data); }
    catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [user?.university_id]);

  useEffect(() => { fetchRestaurants(); }, [fetchRestaurants]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', rating: 4.5, tags: '', prep_time_minutes: 15, opening_time: '09:00', closing_time: '22:00' });
    setLogoFile(null); setCoverFile(null); setLogoPreview(null); setCoverPreview(null);
    setShowForm(true);
  };

  const openEdit = (r: Restaurant) => {
    setEditing(r);
    setForm({ name: r.name, rating: r.rating, tags: (r.tags || []).join(', '), prep_time_minutes: r.prep_time_minutes || 15, opening_time: r.opening_time ? r.opening_time.substring(0, 5) : '09:00', closing_time: r.closing_time ? r.closing_time.substring(0, 5) : '22:00' });
    setLogoFile(null); setCoverFile(null); setLogoPreview(r.logo_url || null); setCoverPreview(r.cover_url || null);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData();
    fd.append('name', form.name);
    if (!editing) fd.append('university_id', user?.university_id || '');
    fd.append('rating', form.rating.toString());
    fd.append('tags', `{${form.tags}}`);
    fd.append('prep_time_minutes', form.prep_time_minutes.toString());
    fd.append('opening_time', form.opening_time);
    fd.append('closing_time', form.closing_time);
    if (logoFile) fd.append('logo', logoFile);
    if (coverFile) fd.append('cover', coverFile);
    try {
      if (editing) { await api.patch(`/admin/restaurants/${editing.id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }); }
      else { await api.post('/admin/restaurants', fd, { headers: { 'Content-Type': 'multipart/form-data' } }); }
      setShowForm(false); fetchRestaurants();
    } catch (err) { console.error(err); }
  };



  if (loading) {
    return <div className="flex justify-center items-center h-full"><div className="animate-spin w-6 h-6 border-2 border-indigo-500/40 border-t-indigo-500 rounded-full" /></div>;
  }

  const inputClass = "w-full px-4 py-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-white text-[14px] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all placeholder-slate-600";
  const labelClass = "block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2";

  /** Compute real-time open/closed status using is_open flag + time window */
  const computeIsOpen = (r: Restaurant): boolean => {
    if (!r.is_open) return false;
    if (!r.opening_time || !r.closing_time) return r.is_open;
    try {
      const now = new Date();
      // Use IST (UTC+5:30) for consistency with backend
      const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
      const currentMinutes = (utcMinutes + 330) % 1440; // +5h30m in minutes
      const openParts = r.opening_time.substring(0, 5).split(':');
      const closeParts = r.closing_time.substring(0, 5).split(':');
      const openMin = parseInt(openParts[0]) * 60 + parseInt(openParts[1]);
      const closeMin = parseInt(closeParts[0]) * 60 + parseInt(closeParts[1]);
      if (closeMin < openMin) {
        return currentMinutes >= openMin || currentMinutes <= closeMin;
      }
      return currentMinutes >= openMin && currentMinutes <= closeMin;
    } catch {
      return r.is_open;
    }
  };

  return (
    <div className="p-8 animate-fade-in">
      {/* ── Header ── */}
      <div className="flex items-end justify-between mb-10 animate-fade-up">
        <div className="space-y-1.5">
          <h1 className="text-[28px] font-extrabold text-white tracking-[-0.03em]">Restaurants</h1>
          <p className="text-slate-500 text-[14px] font-medium">
            <span className="text-white font-bold">{restaurants.length}</span> restaurant{restaurants.length !== 1 ? 's' : ''} on your campus
          </p>
        </div>
        <button onClick={openCreate}
          className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-[13px] font-bold hover:shadow-lg hover:shadow-indigo-500/20 transition-all btn-press flex items-center gap-2">
          <Plus size={15} /> Add Restaurant
        </button>
      </div>

      {/* ── Form Modal ── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in" onClick={() => setShowForm(false)}>
          <div className="bg-[#0c0f18] border border-white/[0.06] rounded-3xl p-8 w-full max-w-lg shadow-2xl animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-[22px] font-extrabold text-white tracking-[-0.02em]">{editing ? 'Edit Restaurant' : 'New Restaurant'}</h2>
              <button onClick={() => setShowForm(false)} className="p-2 rounded-xl hover:bg-white/5 text-slate-600 hover:text-white transition-all"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div><label className={labelClass}>Restaurant Name <span className="text-red-400">*</span></label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className={inputClass} placeholder="e.g. Sizzling Wok" /></div>
              <div className="grid grid-cols-2 gap-5">
                <div><label className={labelClass}>Logo Image</label>
                  {logoPreview && <div className="w-14 h-14 rounded-2xl overflow-hidden border border-white/[0.06] mb-3"><img src={logoPreview} alt="" className="w-full h-full object-cover" /></div>}
                  <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setLogoFile(f); setLogoPreview(URL.createObjectURL(f)); } }}
                    className={`${inputClass} file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[11px] file:font-bold file:bg-indigo-500/10 file:text-indigo-400 hover:file:bg-indigo-500/20 cursor-pointer`} /></div>
                <div><label className={labelClass}>Cover Image</label>
                  {coverPreview && <div className="w-full h-14 rounded-2xl overflow-hidden border border-white/[0.06] mb-3"><img src={coverPreview} alt="" className="w-full h-full object-cover" /></div>}
                  <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setCoverFile(f); setCoverPreview(URL.createObjectURL(f)); } }}
                    className={`${inputClass} file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[11px] file:font-bold file:bg-indigo-500/10 file:text-indigo-400 hover:file:bg-indigo-500/20 cursor-pointer`} /></div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div><label className={labelClass}>Rating</label><input type="number" step="0.1" min="0" max="5" value={form.rating} onChange={(e) => setForm({ ...form, rating: parseFloat(e.target.value) })} className={inputClass} /></div>
                <div><label className={labelClass}>Prep Time</label><input type="number" value={form.prep_time_minutes} onChange={(e) => setForm({ ...form, prep_time_minutes: parseInt(e.target.value) })} className={inputClass} /></div>
                <div><label className={labelClass}>Tags</label><input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} className={inputClass} placeholder="Pizza, Fast" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className={labelClass}>Opens</label><input type="time" value={form.opening_time} onChange={(e) => setForm({ ...form, opening_time: e.target.value })} className={inputClass} /></div>
                <div><label className={labelClass}>Closes</label><input type="time" value={form.closing_time} onChange={(e) => setForm({ ...form, closing_time: e.target.value })} className={inputClass} /></div>
              </div>
              <div className="flex gap-3 pt-4 border-t border-white/[0.04] mt-2">
                <button type="submit" className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-bold text-[14px] hover:shadow-lg hover:shadow-indigo-500/20 transition-all btn-press">
                  {editing ? 'Save Changes' : 'Create Restaurant'}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="px-6 py-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-slate-400 font-bold text-[14px] hover:bg-white/[0.06] transition-all btn-press">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Restaurant Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 stagger-children">
        {restaurants.map((r) => (
          <div key={r.id} className="bg-white/[0.02] border border-white/[0.04] rounded-3xl overflow-hidden hover:border-white/[0.08] transition-all duration-300 hover-lift group relative">
            {/* Cover */}
            <div className="h-36 bg-[#0c0f18] relative overflow-hidden">
              {r.cover_url ? (
                <><img src={r.cover_url} alt={r.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#060810] via-[#060810]/30 to-transparent" /></>
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-slate-800/50 to-slate-900 flex items-center justify-center"><Store size={40} className="text-slate-800" /></div>
              )}
              {/* Floating Actions */}
              <div className="absolute top-3 right-3 flex gap-1.5 translate-y-[-8px] opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                <button onClick={() => openEdit(r)} className="p-2 rounded-xl bg-black/50 backdrop-blur-md text-white hover:text-indigo-400 border border-white/[0.08] transition-colors btn-press"><Edit2 size={14} /></button>
              </div>
              {/* Status */}
              <div className="absolute bottom-3 right-3">
                {(() => { const open = computeIsOpen(r); return (
                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest backdrop-blur-md ${open ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/15 text-red-400 border border-red-500/20'}`}>
                  {open ? 'Open' : 'Closed'}
                </span>
                ); })()}
              </div>
            </div>
            {/* Content */}
            <div className="p-6 pt-4 relative">
              <div className="absolute -top-9 left-5">
                <div className="w-14 h-14 rounded-2xl bg-[#0c0f18] border-[3px] border-[#060810] overflow-hidden shadow-xl flex items-center justify-center">
                  {r.logo_url ? <img src={r.logo_url} alt="" className="w-full h-full object-cover" /> : <Store size={20} className="text-slate-700" />}
                </div>
              </div>
              <div className="mt-6">
                <h3 className="text-white font-extrabold text-[17px] tracking-[-0.02em] leading-tight">{r.name}</h3>
                <div className="flex items-center gap-3 mt-2.5">
                  <span className="flex items-center gap-1 text-amber-400 text-[12px] font-bold bg-amber-500/8 px-2 py-0.5 rounded-lg">
                    <Star size={12} className="fill-amber-400" /> {r.rating}
                  </span>
                  <span className="flex items-center gap-1 text-slate-500 text-[12px] font-medium">
                    <Clock size={12} /> {r.prep_time_minutes} min
                  </span>
                </div>
              </div>
              {(r.tags?.length > 0) && (
                <div className="flex flex-wrap gap-1.5 mt-4">
                  {r.tags.map((tag, idx) => (
                    <span key={idx} className="px-2 py-0.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-slate-500 text-[10px] font-bold tracking-widest uppercase">{tag}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
