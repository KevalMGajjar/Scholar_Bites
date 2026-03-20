import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { Edit2, Image as ImageIcon, Plus, Power, PowerOff, X, Flame, Weight } from 'lucide-react';

interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: string;
  category: string;
  image_url: string;
  is_available: boolean;
  stock_quantity: number;
  restaurant_id: string;
  nutritional_info?: { calories?: number; weight_grams?: number };
}

interface Restaurant {
  id: string;
  name: string;
}

export default function MenuItems() {
  const { user } = useAuth();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [selectedRestaurant, setSelectedRestaurant] = useState('');
  const [form, setForm] = useState({ name: '', description: '', price: '', category: '', stock_quantity: 50, restaurant_id: '', calories: '', weight_grams: '' });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const restRes = await api.get(`/admin/restaurants/${user?.university_id}`);
      setRestaurants(restRes.data);
      if (restRes.data.length > 0) setSelectedRestaurant((prev) => prev || restRes.data[0].id);
    } catch (err) { console.error(err); }
  }, [user?.university_id]);

  const fetchItems = useCallback(async () => {
    if (!selectedRestaurant) return;
    setLoading(true);
    try {
      const res = await api.get('/menu', { params: { restaurant_id: selectedRestaurant, include_unavailable: 'true' } });
      setItems(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [selectedRestaurant]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { if (selectedRestaurant) fetchItems(); }, [selectedRestaurant, fetchItems]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', description: '', price: '', category: '', stock_quantity: 50, restaurant_id: selectedRestaurant, calories: '', weight_grams: '' });
    setImageFile(null); setImagePreview(null); setShowForm(true);
  };

  const openEdit = (item: MenuItem) => {
    setEditing(item);
    setForm({ name: item.name, description: item.description || '', price: item.price, category: item.category, stock_quantity: item.stock_quantity, restaurant_id: item.restaurant_id, calories: item.nutritional_info?.calories?.toString() || '', weight_grams: item.nutritional_info?.weight_grams?.toString() || '' });
    setImageFile(null); setImagePreview(item.image_url || null); setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const fd = new FormData();
      fd.append('name', form.name); fd.append('description', form.description);
      fd.append('price', form.price); fd.append('category', form.category);
      if (!editing) fd.append('restaurant_id', form.restaurant_id);
      fd.append('stock_quantity', form.stock_quantity.toString());
      const nutritionalInfo: Record<string, number> = {};
      if (form.calories) nutritionalInfo.calories = parseFloat(form.calories);
      if (form.weight_grams) nutritionalInfo.weight_grams = parseFloat(form.weight_grams);
      fd.append('nutritional_info', JSON.stringify(nutritionalInfo));
      if (imageFile) fd.append('image', imageFile);
      if (editing) { await api.patch(`/admin/menu/${editing.id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }); }
      else { await api.post('/admin/menu', fd, { headers: { 'Content-Type': 'multipart/form-data' } }); }
      setShowForm(false); fetchItems();
    } catch (err) { console.error(err); }
  };

  const toggleAvailability = async (item: MenuItem) => {
    try { await api.patch(`/admin/menu/${item.id}`, { is_available: !item.is_available }); fetchItems(); }
    catch (err) { console.error(err); }
  };

  const inputClass = "w-full px-4 py-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-white text-[14px] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all placeholder-slate-600";
  const labelClass = "block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2";

  return (
    <div className="p-8 animate-fade-in">
      {/* ── Header ── */}
      <div className="flex items-end justify-between mb-10 animate-fade-up">
        <div className="space-y-1.5">
          <h1 className="text-[28px] font-extrabold text-white tracking-[-0.03em]">Menu Items</h1>
          <p className="text-slate-500 text-[14px] font-medium">
            <span className="text-white font-bold">{items.length}</span> items in the current restaurant
          </p>
        </div>
        <div className="flex gap-2.5">
          <select value={selectedRestaurant} onChange={(e) => setSelectedRestaurant(e.target.value)}
            className="px-4 py-2.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-slate-300 text-[13px] font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/30 appearance-none pr-8 transition-all">
            {restaurants.map((r) => (<option key={r.id} value={r.id} className="bg-[#0c0f18]">{r.name}</option>))}
          </select>
          <button onClick={openCreate}
            className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-[13px] font-bold hover:shadow-lg hover:shadow-indigo-500/20 transition-all btn-press flex items-center gap-2">
            <Plus size={15} /> Add Item
          </button>
        </div>
      </div>

      {/* ── Form Modal ── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in" onClick={() => setShowForm(false)}>
          <div className="bg-[#0c0f18] border border-white/[0.06] rounded-3xl p-8 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-[22px] font-extrabold text-white tracking-[-0.02em]">{editing ? 'Edit Menu Item' : 'New Menu Item'}</h2>
              <button onClick={() => setShowForm(false)} className="p-2 rounded-xl hover:bg-white/5 text-slate-600 hover:text-white transition-all"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div><label className={labelClass}>Item Name <span className="text-red-400">*</span></label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className={inputClass} placeholder="e.g. Classic Burger" /></div>
              <div><label className={labelClass}>Description <span className="text-red-400">*</span></label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} required
                  className={`${inputClass} resize-none`} placeholder="Brief details about the item…" /></div>
              <div className="grid grid-cols-3 gap-4">
                <div><label className={labelClass}>Price (₹) <span className="text-red-400">*</span></label>
                  <input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required className={inputClass} /></div>
                <div><label className={labelClass}>Category <span className="text-red-400">*</span></label>
                  <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required className={inputClass} placeholder="Snacks" /></div>
                <div><label className={labelClass}>Inventory <span className="text-red-400">*</span></label>
                  <input type="number" value={form.stock_quantity} onChange={(e) => setForm({ ...form, stock_quantity: parseInt(e.target.value) })} required className={inputClass} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className={labelClass}><Flame size={10} className="text-orange-400" /> Calories (kcal)</label>
                  <input type="number" step="1" value={form.calories} onChange={(e) => setForm({ ...form, calories: e.target.value })} className={inputClass} placeholder="e.g. 350" /></div>
                <div><label className={labelClass}><Weight size={10} className="text-blue-400" /> Serving Weight (g)</label>
                  <input type="number" step="1" value={form.weight_grams} onChange={(e) => setForm({ ...form, weight_grams: e.target.value })} className={inputClass} placeholder="e.g. 250" /></div>
              </div>
              <div><label className={labelClass}>Primary Image</label>
                {imagePreview && <div className="w-20 h-20 rounded-2xl overflow-hidden border border-white/[0.06] mb-3"><img src={imagePreview} alt="" className="w-full h-full object-cover" /></div>}
                <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setImageFile(f); setImagePreview(URL.createObjectURL(f)); } }}
                  className={`${inputClass} file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[11px] file:font-bold file:bg-indigo-500/10 file:text-indigo-400 hover:file:bg-indigo-500/20 cursor-pointer`} /></div>
              {!editing && (
                <div><label className={labelClass}>Restaurant <span className="text-red-400">*</span></label>
                  <select value={form.restaurant_id} onChange={(e) => setForm({ ...form, restaurant_id: e.target.value })} required className={`${inputClass} appearance-none`}>
                    {restaurants.map((r) => (<option key={r.id} value={r.id} className="bg-[#0c0f18]">{r.name}</option>))}
                  </select></div>
              )}
              <div className="flex gap-3 pt-4 border-t border-white/[0.04] mt-2">
                <button type="submit" className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-bold text-[14px] hover:shadow-lg hover:shadow-indigo-500/20 transition-all btn-press">
                  {editing ? 'Save Changes' : 'Create Item'}</button>
                <button type="button" onClick={() => setShowForm(false)} className="px-6 py-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-slate-400 font-bold text-[14px] hover:bg-white/[0.06] transition-all btn-press">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Table ── */}
      {loading ? (
        <div className="flex justify-center py-20"><div className="animate-spin w-6 h-6 border-2 border-indigo-500/40 border-t-indigo-500 rounded-full" /></div>
      ) : (
        <div className="bg-white/[0.015] border border-white/[0.04] rounded-2xl overflow-hidden animate-fade-up" style={{ animationDelay: '100ms' }}>
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.04]">
                {['Item Details', 'Category', 'Price', 'Stock', 'Status', ''].map((h) => (
                  <th key={h} className="text-left text-[10px] text-slate-600 font-bold px-6 py-4 uppercase tracking-[0.15em]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {items.map((item, idx) => (
                <tr key={item.id} className="hover:bg-white/[0.02] transition-colors duration-200 group animate-fade-up" style={{ animationDelay: `${idx * 30}ms` }}>
                  <td className="px-6 py-4 w-[40%]">
                    <div className="flex items-center gap-4">
                      {item.image_url ? (
                        <div className="w-12 h-12 rounded-xl overflow-hidden ring-1 ring-white/[0.06]"><img src={item.image_url} alt={item.name} className="w-full h-full object-cover" /></div>
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center"><ImageIcon size={18} className="text-slate-700" /></div>
                      )}
                      <div>
                        <p className="text-white text-[13px] font-bold tracking-[-0.01em]">{item.name}</p>
                        <p className="text-slate-600 text-[12px] truncate max-w-[250px]">{item.description}</p>
                        {item.nutritional_info && (item.nutritional_info.calories || item.nutritional_info.weight_grams) && (
                          <div className="flex items-center gap-2 mt-1">
                            {item.nutritional_info.calories && <span className="text-orange-400/70 text-[10px] font-semibold">{item.nutritional_info.calories} kcal</span>}
                            {item.nutritional_info.calories && item.nutritional_info.weight_grams && <span className="text-slate-700">·</span>}
                            {item.nutritional_info.weight_grams && <span className="text-blue-400/70 text-[10px] font-semibold">{item.nutritional_info.weight_grams}g</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 rounded-lg bg-white/[0.03] border border-white/[0.06] text-slate-400 text-[10px] font-bold tracking-widest uppercase">{item.category}</span>
                  </td>
                  <td className="px-6 py-4 text-white text-[14px] font-extrabold tracking-[-0.01em]">₹{parseFloat(item.price).toFixed(0)}</td>
                  <td className="px-6 py-4 text-slate-500 font-mono text-[13px] font-medium">{item.stock_quantity}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest ${item.is_available ? 'bg-emerald-500/8 text-emerald-400 border border-emerald-500/15' : 'bg-red-500/8 text-red-400 border border-red-500/15'}`}>
                      {item.is_available ? 'Available' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-1.5 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(item)} className="p-2 rounded-xl bg-indigo-500/8 text-indigo-400 hover:bg-indigo-500/15 border border-indigo-500/15 transition-all btn-press"><Edit2 size={14} /></button>
                      <button onClick={() => toggleAvailability(item)}
                        className={`p-2 rounded-xl transition-all border btn-press ${item.is_available ? 'bg-amber-500/8 text-amber-400 border-amber-500/15 hover:bg-amber-500/15' : 'bg-emerald-500/8 text-emerald-400 border-emerald-500/15 hover:bg-emerald-500/15'}`}>
                        {item.is_available ? <PowerOff size={14} /> : <Power size={14} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
