import { useState } from 'react';
import { Plus, Edit2, Trash2, X, Clock, Timer, Check, AlertTriangle } from 'lucide-react';
import api from '../services/api';

export interface Category {
  id: string;
  restaurant_id: string;
  name: string;
  cutoff_time: string | null;
  lead_time: number;
  item_count: number;
}

interface Props {
  categories: Category[];
  restaurantId: string;
  onRefresh: () => void;
}

export default function CategoryManager({ categories, restaurantId, onRefresh }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState({ name: '', cutoff_time: '', lead_time: 0 });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [error, setError] = useState('');

  const inputClass = "w-full px-4 py-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-white text-[14px] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all placeholder-slate-600";
  const labelClass = "block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2";

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', cutoff_time: '', lead_time: 0 });
    setError('');
    setShowForm(true);
  };

  const openEdit = (cat: Category) => {
    setEditing(cat);
    setForm({
      name: cat.name,
      cutoff_time: cat.cutoff_time ? cat.cutoff_time.substring(0, 5) : '',
      lead_time: cat.lead_time || 0,
    });
    setError('');
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (editing) {
        await api.patch(`/admin/categories/${editing.id}`, {
          name: form.name,
          cutoff_time: form.cutoff_time || null,
          lead_time: form.lead_time,
        });
      } else {
        await api.post('/admin/categories', {
          restaurant_id: restaurantId,
          name: form.name,
          cutoff_time: form.cutoff_time || null,
          lead_time: form.lead_time,
        });
      }
      setShowForm(false);
      onRefresh();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save category');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/admin/categories/${id}`);
      setDeleteConfirm(null);
      onRefresh();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete category');
      setDeleteConfirm(null);
    }
  };

  return (
    <div className="mb-8 animate-fade-up">
      {/* Section header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-[16px] font-extrabold text-white tracking-[-0.02em]">Categories</h2>
          <span className="text-[11px] font-bold text-slate-600 bg-white/[0.03] border border-white/[0.04] px-2.5 py-1 rounded-lg">
            {categories.length}
          </span>
        </div>
        <button onClick={openCreate}
          className="px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-slate-300 text-[12px] font-bold hover:bg-white/[0.07] hover:border-white/[0.10] transition-all btn-press flex items-center gap-2">
          <Plus size={13} /> Add Category
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/8 border border-red-500/15 text-red-400 text-[12px] font-medium flex items-center gap-2 animate-fade-in">
          <AlertTriangle size={14} /> {error}
          <button onClick={() => setError('')} className="ml-auto text-red-400/60 hover:text-red-400"><X size={12} /></button>
        </div>
      )}

      {/* Category cards */}
      {categories.length === 0 ? (
        <div className="text-center py-10 border border-dashed border-white/[0.06] rounded-2xl">
          <p className="text-slate-600 text-[13px] font-medium">No categories yet</p>
          <p className="text-slate-700 text-[11px] mt-1">Add categories to organize your menu items</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 stagger-children">
          {categories.map((cat) => (
            <div key={cat.id}
              className="group relative bg-white/[0.02] border border-white/[0.05] rounded-2xl p-4 hover:border-white/[0.10] hover:bg-white/[0.03] transition-all duration-300">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="text-white text-[14px] font-bold tracking-[-0.01em] truncate">{cat.name}</h3>
                  <div className="flex items-center gap-3 mt-2.5">
                    {cat.cutoff_time && (
                      <span className="flex items-center gap-1 text-[10px] font-semibold text-slate-500">
                        <Clock size={10} className="text-indigo-400/60" />
                        Cutoff {cat.cutoff_time.substring(0, 5)}
                      </span>
                    )}
                    {cat.lead_time > 0 && (
                      <span className="flex items-center gap-1 text-[10px] font-semibold text-slate-500">
                        <Timer size={10} className="text-indigo-400/60" />
                        {cat.lead_time} min lead
                      </span>
                    )}
                  </div>
                  <span className="inline-block mt-2 text-[10px] font-bold text-slate-600 bg-white/[0.03] border border-white/[0.04] px-2 py-0.5 rounded-md">
                    {cat.item_count} item{cat.item_count !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                  <button onClick={() => openEdit(cat)}
                    className="p-1.5 rounded-lg bg-indigo-500/8 text-indigo-400 hover:bg-indigo-500/15 border border-indigo-500/15 transition-all">
                    <Edit2 size={12} />
                  </button>
                  {deleteConfirm === cat.id ? (
                    <button onClick={() => handleDelete(cat.id)}
                      className="p-1.5 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/20 transition-all">
                      <Check size={12} />
                    </button>
                  ) : (
                    <button onClick={() => setDeleteConfirm(cat.id)}
                      className="p-1.5 rounded-lg bg-white/[0.03] text-slate-600 hover:text-red-400 hover:bg-red-500/8 border border-white/[0.06] transition-all">
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in" onClick={() => setShowForm(false)}>
          <div className="bg-[#0c0f18] border border-white/[0.06] rounded-3xl p-8 w-full max-w-md shadow-2xl animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-[20px] font-extrabold text-white tracking-[-0.02em]">
                {editing ? 'Edit Category' : 'New Category'}
              </h2>
              <button onClick={() => setShowForm(false)} className="p-2 rounded-xl hover:bg-white/5 text-slate-600 hover:text-white transition-all">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className={labelClass}>Category Name <span className="text-red-400">*</span></label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required className={inputClass} placeholder="e.g. Breakfast, Lunch Specials" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Cutoff Time</label>
                  <input type="time" value={form.cutoff_time} onChange={(e) => setForm({ ...form, cutoff_time: e.target.value })}
                    className={inputClass} />
                  <p className="text-[10px] text-slate-600 mt-1.5 font-medium">Ordering deadline</p>
                </div>
                <div>
                  <label className={labelClass}>Lead Time (min)</label>
                  <input type="number" min={0} value={form.lead_time} onChange={(e) => setForm({ ...form, lead_time: parseInt(e.target.value) || 0 })}
                    className={inputClass} placeholder="0" />
                  <p className="text-[10px] text-slate-600 mt-1.5 font-medium">Advance prep notice</p>
                </div>
              </div>
              {error && <p className="text-red-400 text-[12px] font-medium">{error}</p>}
              <div className="flex gap-3 pt-4 border-t border-white/[0.04]">
                <button type="submit"
                  className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-bold text-[14px] hover:shadow-lg hover:shadow-indigo-500/20 transition-all btn-press">
                  {editing ? 'Save Changes' : 'Create Category'}
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  className="px-6 py-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-slate-400 font-bold text-[14px] hover:bg-white/[0.06] transition-all btn-press">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
