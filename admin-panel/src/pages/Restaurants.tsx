import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { Plus, Store, Clock, Star, Edit2, Power, PowerOff } from 'lucide-react';

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
    try {
      const res = await api.get(`/admin/restaurants/${user?.university_id}`);
      setRestaurants(res.data);
    } catch (err) { console.error(err); }
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
    setForm({
      name: r.name,
      rating: r.rating,
      tags: (r.tags || []).join(', '),
      prep_time_minutes: r.prep_time_minutes || 15,
      opening_time: r.opening_time ? r.opening_time.substring(0, 5) : '09:00',
      closing_time: r.closing_time ? r.closing_time.substring(0, 5) : '22:00',
    });
    setLogoFile(null); setCoverFile(null);
    setLogoPreview(r.logo_url || null);
    setCoverPreview(r.cover_url || null);
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
      if (editing) {
        await api.patch(`/admin/restaurants/${editing.id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      } else {
        await api.post('/admin/restaurants', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      }
      setShowForm(false);
      fetchRestaurants();
    } catch (err) { console.error(err); }
  };

  const toggleOpen = async (r: Restaurant) => {
    try {
      await api.patch(`/admin/restaurants/${r.id}`, { is_open: !r.is_open });
      fetchRestaurants();
    } catch (err) { console.error(err); }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="animate-spin w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Restaurants</h1>
          <p className="text-slate-400 text-sm mt-1">{restaurants.length} restaurants</p>
        </div>
        <button onClick={openCreate} className="px-4 py-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-sm font-bold hover:bg-indigo-500/20 hover:border-indigo-500/30 transition-all shadow-sm flex items-center gap-2">
          <Plus size={16} />
          Add Restaurant
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700/50 rounded-3xl p-8 w-full max-w-lg shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-6 tracking-tight">{editing ? 'Edit Restaurant' : 'New Restaurant'}</h2>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-400 mb-1.5">Restaurant Name <span className="text-red-400">*</span></label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950/50 border border-slate-800 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all shadow-inner placeholder-slate-600" placeholder="e.g. Sizzling Wok" />
              </div>
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-semibold text-slate-400 mb-2">Logo Image</label>
                  {logoPreview && (
                    <div className="w-16 h-16 rounded-2xl overflow-hidden border border-slate-700/50 shadow-lg mb-3">
                      <img src={logoPreview} alt="logo" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <input type="file" accept="image/*" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setLogoFile(file);
                    setLogoPreview(URL.createObjectURL(file));
                  }}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950/50 border border-slate-800 text-slate-300 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-bold file:bg-indigo-500/10 file:text-indigo-400 hover:file:bg-indigo-500/20 transition-all shadow-inner cursor-pointer" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-400 mb-2">Cover Image</label>
                  {coverPreview && (
                    <div className="w-full h-16 rounded-2xl overflow-hidden border border-slate-700/50 shadow-lg mb-3">
                      <img src={coverPreview} alt="cover" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <input type="file" accept="image/*" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setCoverFile(file);
                    setCoverPreview(URL.createObjectURL(file));
                  }}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950/50 border border-slate-800 text-slate-300 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-bold file:bg-indigo-500/10 file:text-indigo-400 hover:file:bg-indigo-500/20 transition-all shadow-inner cursor-pointer" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-5">
                <div>
                  <label className="block text-sm font-semibold text-slate-400 mb-1.5">Rating</label>
                  <input type="number" step="0.1" min="0" max="5" value={form.rating} onChange={(e) => setForm({ ...form, rating: parseFloat(e.target.value) })}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950/50 border border-slate-800 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all shadow-inner" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-400 mb-1.5">Prep Time (min)</label>
                  <input type="number" value={form.prep_time_minutes} onChange={(e) => setForm({ ...form, prep_time_minutes: parseInt(e.target.value) })}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950/50 border border-slate-800 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all shadow-inner" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-400 mb-1.5">Tags (comma sep)</label>
                  <input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950/50 border border-slate-800 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all shadow-inner placeholder-slate-600" placeholder="Fast food, Pizza" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-semibold text-slate-400 mb-1.5">Opening Time</label>
                  <input type="time" value={form.opening_time} onChange={(e) => setForm({ ...form, opening_time: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950/50 border border-slate-800 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all shadow-inner" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-400 mb-1.5">Closing Time</label>
                  <input type="time" value={form.closing_time} onChange={(e) => setForm({ ...form, closing_time: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950/50 border border-slate-800 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all shadow-inner" />
                </div>
              </div>
              <div className="flex gap-3 pt-4 border-t border-slate-800/50 mt-6">
                <button type="submit" className="flex-1 py-3 rounded-xl bg-indigo-500 shadow-lg shadow-indigo-500/20 text-white font-bold tracking-wide hover:bg-indigo-400 transition-all">
                  {editing ? 'Save Changes' : 'Create Restaurant'}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="px-6 py-3 rounded-xl bg-slate-800/80 border border-slate-700/50 text-slate-300 font-bold tracking-wide hover:bg-slate-700 transition-all">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Restaurant Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {restaurants.map((r) => (
          <div key={r.id} className="bg-slate-900/60 backdrop-blur-md border border-slate-700/50 rounded-3xl overflow-hidden hover:border-slate-600/80 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1 group relative">
            
            {/* Cover Image Area */}
            <div className="h-40 bg-slate-800 relative overflow-hidden">
              {r.cover_url ? (
                <>
                  <img src={r.cover_url} alt={r.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent" />
                </>
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
                  <Store size={48} className="text-slate-700" />
                </div>
              )}
              
              {/* Floating Action Buttons */}
              <div className="absolute top-4 right-4 flex gap-2 translate-y-[-10px] opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                <button onClick={() => openEdit(r)} className="p-2.5 rounded-xl bg-slate-900/80 backdrop-blur-md text-white hover:text-indigo-400 hover:bg-slate-800 border border-white/10 shadow-lg transition-colors flex items-center justify-center">
                  <Edit2 size={16} />
                </button>
                <button onClick={() => toggleOpen(r)}
                  className={`p-2.5 rounded-xl backdrop-blur-md border shadow-lg transition-colors flex items-center justify-center ${r.is_open ? 'bg-slate-900/80 text-amber-500 hover:bg-amber-500/20 border-white/10' : 'bg-slate-900/80 text-emerald-400 hover:bg-emerald-500/20 border-white/10'}`}>
                  {r.is_open ? <PowerOff size={16} /> : <Power size={16} />}
                </button>
              </div>

              {/* Status Badge overlayed on cover */}
              <div className="absolute bottom-4 right-4">
                <span className={`px-3 py-1.5 rounded-xl text-xs font-bold tracking-wider uppercase border backdrop-blur-md shadow-lg ${r.is_open ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}`}>
                  {r.is_open ? 'Open' : 'Closed'}
                </span>
              </div>
            </div>

            {/* Content Area */}
            <div className="p-6 pt-4 relative">
              {/* Logo Overlay */}
              <div className="absolute -top-10 left-6">
                <div className="w-16 h-16 rounded-2xl bg-slate-800 border-4 border-slate-900 overflow-hidden shadow-xl flex items-center justify-center">
                  {r.logo_url ? (
                    <img src={r.logo_url} alt="Logo" className="w-full h-full object-cover" />
                  ) : (
                    <Store size={24} className="text-slate-600" />
                  )}
                </div>
              </div>

              <div className="mt-8 flex items-start justify-between">
                <div>
                  <h3 className="text-white font-bold text-xl tracking-tight leading-tight">{r.name}</h3>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="flex items-center gap-1 text-amber-400 text-sm font-bold bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20">
                      <Star size={14} className="fill-amber-400" /> {r.rating}
                    </span>
                    <span className="flex items-center gap-1 text-slate-400 text-sm font-medium">
                      <Clock size={14} className="text-slate-500" /> {r.prep_time_minutes} min
                    </span>
                  </div>
                </div>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-2 mt-5">
                {(r.tags || []).map((tag, idx) => (
                  <span key={idx} className="px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700/50 text-slate-300 text-[10px] font-bold tracking-widest uppercase shadow-sm">{tag}</span>
                ))}
                {(!r.tags || r.tags.length === 0) && (
                   <span className="text-slate-600 text-xs italic">No tags added</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
