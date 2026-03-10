import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

interface Restaurant {
  id: string;
  name: string;
  logo_url: string;
  cover_url: string;
  rating: number;
  tags: string[];
  is_open: boolean;
  prep_time_minutes: number;
}

export default function Restaurants() {
  const { user } = useAuth();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Restaurant | null>(null);
  const [form, setForm] = useState({ name: '', logo_url: '', cover_url: '', rating: 4.5, tags: '', prep_time_minutes: 15 });

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
    setForm({ name: '', logo_url: '', cover_url: '', rating: 4.5, tags: '', prep_time_minutes: 15 });
    setShowForm(true);
  };

  const openEdit = (r: Restaurant) => {
    setEditing(r);
    setForm({
      name: r.name,
      logo_url: r.logo_url || '',
      cover_url: r.cover_url || '',
      rating: r.rating,
      tags: (r.tags || []).join(', '),
      prep_time_minutes: r.prep_time_minutes || 15,
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...form,
      university_id: user?.university_id,
      tags: `{${form.tags}}`,
    };
    try {
      if (editing) {
        await api.patch(`/admin/restaurants/${editing.id}`, payload);
      } else {
        await api.post('/admin/restaurants', payload);
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
        <button onClick={openCreate} className="px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 transition">
          + Add Restaurant
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-lg">
            <h2 className="text-xl font-bold text-white mb-4">{editing ? 'Edit Restaurant' : 'New Restaurant'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-300 mb-1">Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required
                  className="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Logo URL</label>
                  <input value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50" />
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Cover URL</label>
                  <input value={form.cover_url} onChange={(e) => setForm({ ...form, cover_url: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Rating</label>
                  <input type="number" step="0.1" min="0" max="5" value={form.rating} onChange={(e) => setForm({ ...form, rating: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50" />
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Prep Time (min)</label>
                  <input type="number" value={form.prep_time_minutes} onChange={(e) => setForm({ ...form, prep_time_minutes: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50" />
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Tags (comma sep)</label>
                  <input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-1 py-2.5 rounded-lg bg-amber-500 text-white font-semibold hover:bg-amber-600 transition">
                  {editing ? 'Save Changes' : 'Create Restaurant'}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2.5 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 transition">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Restaurant Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {restaurants.map((r) => (
          <div key={r.id} className="bg-slate-800/60 border border-slate-700/50 rounded-xl overflow-hidden hover:border-slate-600/50 transition">
            {r.cover_url && (
              <div className="h-32 bg-slate-700 overflow-hidden">
                <img src={r.cover_url} alt={r.name} className="w-full h-full object-cover" />
              </div>
            )}
            <div className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-white font-semibold">{r.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-amber-400 text-sm">★ {r.rating}</span>
                    <span className="text-slate-600">·</span>
                    <span className="text-slate-400 text-xs">{r.prep_time_minutes} min</span>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${r.is_open ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                  {r.is_open ? 'Open' : 'Closed'}
                </span>
              </div>
              <div className="flex flex-wrap gap-1 mt-3">
                {(r.tags || []).map((tag, idx) => (
                  <span key={idx} className="px-2 py-0.5 rounded-md bg-slate-700 text-slate-300 text-xs">{tag}</span>
                ))}
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={() => openEdit(r)} className="flex-1 py-1.5 rounded-lg bg-slate-700 text-slate-300 text-xs hover:bg-slate-600 transition">
                  Edit
                </button>
                <button onClick={() => toggleOpen(r)}
                  className={`flex-1 py-1.5 rounded-lg text-xs transition ${r.is_open ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'}`}>
                  {r.is_open ? 'Close' : 'Open'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
