import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { Edit2, Image as ImageIcon, Plus, Power, PowerOff, X, Flame, Weight, Leaf, Beef, ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import CategoryManager from '../components/CategoryManager';
import type { Category } from '../components/CategoryManager';

interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: string;
  category: string;
  category_id: string | null;
  category_name: string | null;
  image_url: string;
  is_available: boolean;
  stock_quantity: number;
  restaurant_id: string;
  is_veg?: boolean;
  nutritional_info?: { calories?: number; weight?: number; weight_grams?: number; unit?: string; };
}

interface Restaurant {
  id: string;
  name: string;
  is_event_restaurant?: boolean;
}

export default function MenuItems() {
  const { user } = useAuth();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [selectedRestaurant, setSelectedRestaurant] = useState('');
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({
    name: '', description: '', price: '', category: '', category_id: '',
    stock_quantity: 50, restaurant_id: '', calories: '', weight: '', unit: 'g', is_veg: true
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const restRes = await api.get(`/admin/restaurants/${user?.university_id}`);
      setRestaurants(restRes.data);
      if (restRes.data.length > 0) setSelectedRestaurant((prev) => prev || restRes.data[0].id);
    } catch (err) { console.error(err); }
  }, [user?.university_id]);

  const fetchCategories = useCallback(async () => {
    if (!selectedRestaurant) return;
    try {
      const res = await api.get(`/admin/categories/${selectedRestaurant}`);
      setCategories(res.data);
    } catch (err) { console.error(err); }
  }, [selectedRestaurant]);

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
  useEffect(() => {
    if (selectedRestaurant) { fetchItems(); fetchCategories(); }
  }, [selectedRestaurant, fetchItems, fetchCategories]);

  const refreshAll = () => { fetchItems(); fetchCategories(); };

  // Group items by category
  const groupedItems = useMemo(() => {
    const groups: { categoryId: string | null; categoryName: string; items: MenuItem[] }[] = [];
    const catMap = new Map<string, MenuItem[]>();
    const uncategorized: MenuItem[] = [];

    for (const item of items) {
      if (item.category_id) {
        const existing = catMap.get(item.category_id) || [];
        existing.push(item);
        catMap.set(item.category_id, existing);
      } else {
        uncategorized.push(item);
      }
    }

    // Match with actual category objects to preserve order
    for (const cat of categories) {
      groups.push({
        categoryId: cat.id,
        categoryName: cat.name,
        items: catMap.get(cat.id) || [],
      });
      catMap.delete(cat.id);
    }

    // Any leftover category_ids not in categories list
    catMap.forEach((catItems, catId) => {
      const name = catItems[0]?.category_name || 'Unknown';
      groups.push({ categoryId: catId, categoryName: name, items: catItems });
    });

    if (uncategorized.length > 0) {
      groups.push({ categoryId: null, categoryName: 'Uncategorized', items: uncategorized });
    }

    return groups;
  }, [items, categories]);

  const toggleCollapse = (catId: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId); else next.add(catId);
      return next;
    });
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', description: '', price: '', category: '', category_id: categories[0]?.id || '', stock_quantity: 50, restaurant_id: selectedRestaurant, calories: '', weight: '', unit: 'g', is_veg: true });
    setImageFile(null); setImagePreview(null); setShowForm(true);
  };

  const openEdit = (item: MenuItem) => {
    setEditing(item);
    setForm({
      name: item.name, description: item.description || '', price: item.price,
      category: item.category, category_id: item.category_id || '',
      stock_quantity: item.stock_quantity, restaurant_id: item.restaurant_id,
      calories: item.nutritional_info?.calories?.toString() || '',
      weight: item.nutritional_info?.weight?.toString() || item.nutritional_info?.weight_grams?.toString() || '',
      unit: item.nutritional_info?.unit || 'g', is_veg: item.is_veg ?? true
    });
    setImageFile(null); setImagePreview(item.image_url || null); setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const fd = new FormData();
      fd.append('name', form.name); fd.append('description', form.description);
      fd.append('price', form.price);
      // Derive category string from selected category_id
      const selectedCat = categories.find(c => c.id === form.category_id);
      fd.append('category', selectedCat?.name || form.category || '');
      if (form.category_id) fd.append('category_id', form.category_id);
      if (!editing) fd.append('restaurant_id', form.restaurant_id);
      fd.append('stock_quantity', form.stock_quantity.toString());
      fd.append('is_veg', form.is_veg.toString());
      const nutritionalInfo: Record<string, any> = {};
      if (form.calories) nutritionalInfo.calories = parseFloat(form.calories);
      if (form.weight) { nutritionalInfo.weight = parseFloat(form.weight); nutritionalInfo.unit = form.unit; }
      fd.append('nutritional_info', JSON.stringify(nutritionalInfo));
      if (imageFile) fd.append('image', imageFile);
      if (editing) { await api.patch(`/admin/menu/${editing.id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }); }
      else { await api.post('/admin/menu', fd, { headers: { 'Content-Type': 'multipart/form-data' } }); }
      setShowForm(false); refreshAll();
    } catch (err) { console.error(err); }
  };

  const toggleAvailability = async (item: MenuItem) => {
    try { await api.patch(`/admin/menu/${item.id}`, { is_available: !item.is_available }); fetchItems(); }
    catch (err) { console.error(err); }
  };

  const handleDelete = async (item: MenuItem) => {
    if (!confirm(`Delete "${item.name}"? This permanently removes it from the menu.`)) return;
    try {
      const res = await api.delete(`/admin/menu/${item.id}`);
      // If it had order history the backend archives it instead — let the admin know.
      if (res.data?.deleted === false && res.data?.message) alert(res.data.message);
      fetchItems();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete item');
    }
  };

  const inputClass = "w-full px-4 py-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-white text-[14px] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all placeholder-slate-600";
  const labelClass = "block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2";

  return (
    <div className="p-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-end justify-between mb-8 animate-fade-up">
        <div className="space-y-1.5">
          <h1 className="text-[28px] font-extrabold text-white tracking-[-0.03em]">Menu Management</h1>
          <p className="text-slate-500 text-[14px] font-medium">
            <span className="text-white font-bold">{items.length}</span> items across <span className="text-white font-bold">{categories.length}</span> categories
          </p>
        </div>
        <div className="flex gap-2.5 items-center">
          <select value={selectedRestaurant} onChange={(e) => setSelectedRestaurant(e.target.value)}
            className="px-4 py-2.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-slate-300 text-[13px] font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/30 appearance-none pr-8 transition-all">
            {restaurants.map((r) => (<option key={r.id} value={r.id} className="bg-[#0c0f18]">{r.name}</option>))}
          </select>
          {restaurants.find(r => r.id === selectedRestaurant)?.is_event_restaurant && (
            <span className="px-3 py-1.5 rounded-xl bg-purple-500/10 text-purple-400 text-[11px] font-bold border border-purple-500/20 tracking-wide whitespace-nowrap">
              Catering Only
            </span>
          )}
          <button onClick={openCreate}
            className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-[13px] font-bold hover:shadow-lg hover:shadow-indigo-500/20 transition-all btn-press flex items-center gap-2">
            <Plus size={15} /> Add Item
          </button>
        </div>
      </div>

      {/* Categories section */}
      <CategoryManager categories={categories} restaurantId={selectedRestaurant} onRefresh={refreshAll} />

      {/* Divider */}
      <div className="border-t border-white/[0.04] mb-6" />

      {/* Form Modal */}
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
                  className={`${inputClass} resize-none`} placeholder="Brief details about the item..." /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className={labelClass}>Price (Rs) <span className="text-red-400">*</span></label>
                  <input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required className={inputClass} /></div>
                <div><label className={labelClass}>Category <span className="text-red-400">*</span></label>
                  <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} required className={`${inputClass} appearance-none`}>
                    <option value="" disabled className="bg-[#0c0f18]">Select Category</option>
                    {categories.map((c) => (<option key={c.id} value={c.id} className="bg-[#0c0f18]">{c.name}</option>))}
                  </select></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Dietary Type</label>
                  <div className="flex gap-3">
                    <label className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl cursor-pointer transition-all border ${form.is_veg ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-white/[0.03] border-white/[0.06] text-slate-400 hover:bg-white/[0.06]'}`}>
                      <input type="radio" name="diet" className="hidden" checked={form.is_veg} onChange={() => setForm({ ...form, is_veg: true })} />
                      <Leaf size={14} /> <span className="text-[13px] font-bold">Veg</span>
                    </label>
                    <label className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl cursor-pointer transition-all border ${!form.is_veg ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-white/[0.03] border-white/[0.06] text-slate-400 hover:bg-white/[0.06]'}`}>
                      <input type="radio" name="diet" className="hidden" checked={!form.is_veg} onChange={() => setForm({ ...form, is_veg: false })} />
                      <Beef size={14} /> <span className="text-[13px] font-bold">Non-Veg</span>
                    </label>
                  </div>
                </div>
                <div><label className={labelClass}>Inventory <span className="text-red-400">*</span></label>
                  <input type="number" value={form.stock_quantity} onChange={(e) => setForm({ ...form, stock_quantity: parseInt(e.target.value) })} required className={inputClass} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className={labelClass}><Flame size={10} className="text-orange-400" /> Calories (kcal)</label>
                  <input type="number" step="1" value={form.calories} onChange={(e) => setForm({ ...form, calories: e.target.value })} className={inputClass} placeholder="e.g. 350" /></div>
                <div>
                  <label className={labelClass}><Weight size={10} className="text-blue-400" /> Serving Size</label>
                  <div className="flex relative items-center">
                    <input type="number" step="1" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} className={`${inputClass} pr-16`} placeholder="e.g. 250" />
                    <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="absolute right-2 bg-white/10 text-white rounded-md px-2 py-1 text-xs border-none outline-none cursor-pointer">
                      <option value="g" className="bg-[#0c0f18] text-white">g</option>
                      <option value="ml" className="bg-[#0c0f18] text-white">ml</option>
                    </select>
                  </div>
                </div>
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

      {/* Items grouped by category */}
      {loading ? (
        <div className="flex justify-center py-20"><div className="animate-spin w-6 h-6 border-2 border-indigo-500/40 border-t-indigo-500 rounded-full" /></div>
      ) : groupedItems.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-slate-600 text-[14px] font-medium">No menu items yet</p>
        </div>
      ) : (
        <div className="space-y-4 animate-fade-up" style={{ animationDelay: '100ms' }}>
          {groupedItems.map((group) => {
            const key = group.categoryId || '_uncategorized';
            const isCollapsed = collapsedCategories.has(key);
            return (
              <div key={key} className="bg-white/[0.015] border border-white/[0.04] rounded-2xl overflow-hidden">
                {/* Category group header */}
                <button onClick={() => toggleCollapse(key)}
                  className="w-full flex items-center justify-between px-6 py-3.5 hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-center gap-3">
                    {isCollapsed ? <ChevronRight size={14} className="text-slate-600" /> : <ChevronDown size={14} className="text-slate-500" />}
                    <span className="text-white text-[13px] font-bold tracking-[-0.01em]">{group.categoryName}</span>
                    <span className="text-[10px] font-bold text-slate-600 bg-white/[0.04] px-2 py-0.5 rounded-md">
                      {group.items.length}
                    </span>
                  </div>
                </button>
                {/* Items table */}
                {!isCollapsed && group.items.length > 0 && (
                  <table className="w-full">
                    <thead>
                      <tr className="border-t border-white/[0.04]">
                        {['Item Details', 'Price', 'Stock', 'Status', ''].map((h) => (
                          <th key={h} className="text-left text-[10px] text-slate-600 font-bold px-6 py-3 uppercase tracking-[0.15em]">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.03]">
                      {group.items.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-white/[0.02] transition-colors duration-200 group/row animate-fade-up" style={{ animationDelay: `${idx * 30}ms` }}>
                          <td className="px-6 py-4 w-[50%]">
                            <div className="flex items-center gap-4">
                              {item.image_url ? (
                                <div className="w-11 h-11 rounded-xl overflow-hidden ring-1 ring-white/[0.06] flex-shrink-0"><img src={item.image_url} alt={item.name} className="w-full h-full object-cover" /></div>
                              ) : (
                                <div className="w-11 h-11 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center flex-shrink-0"><ImageIcon size={16} className="text-slate-700" /></div>
                              )}
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="text-white text-[13px] font-bold tracking-[-0.01em]">{item.name}</p>
                                  <div title={item.is_veg !== false ? 'Vegetarian' : 'Non-Vegetarian'} className={`w-3.5 h-3.5 rounded flex items-center justify-center border ${item.is_veg !== false ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-red-500/50 bg-red-500/10'}`}>
                                    <div className={`w-1.5 h-1.5 rounded-full ${item.is_veg !== false ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                  </div>
                                </div>
                                <p className="text-slate-600 text-[12px] truncate max-w-[280px]">{item.description}</p>
                                {item.nutritional_info && (item.nutritional_info.calories || item.nutritional_info.weight || item.nutritional_info.weight_grams) && (
                                  <div className="flex items-center gap-2 mt-1">
                                    {item.nutritional_info.calories && <span className="text-orange-400/70 text-[10px] font-semibold">{item.nutritional_info.calories} kcal</span>}
                                    {item.nutritional_info.calories && (item.nutritional_info.weight || item.nutritional_info.weight_grams) && <span className="text-slate-700">·</span>}
                                    {(item.nutritional_info.weight || item.nutritional_info.weight_grams) && <span className="text-blue-400/70 text-[10px] font-semibold">{item.nutritional_info.weight || item.nutritional_info.weight_grams}{item.nutritional_info.unit || 'g'}</span>}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-white text-[14px] font-extrabold tracking-[-0.01em]">Rs {parseFloat(item.price).toFixed(0)}</td>
                          <td className="px-6 py-4">
                            <span className={`font-mono text-[13px] font-medium ${item.stock_quantity <= 0 ? 'text-red-400' : item.stock_quantity <= 5 ? 'text-amber-400' : 'text-slate-500'}`}>
                              {item.stock_quantity}
                              {item.stock_quantity > 0 && item.stock_quantity <= 5 && <span className="ml-1.5 text-[9px] font-bold text-amber-400/80 uppercase tracking-wider">Low</span>}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            {item.stock_quantity <= 0 && !item.is_available ? (
                              <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest bg-red-500/8 text-red-400 border border-red-500/15">Out of Stock</span>
                            ) : (
                              <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest ${item.is_available ? 'bg-emerald-500/8 text-emerald-400 border border-emerald-500/15' : 'bg-red-500/8 text-red-400 border border-red-500/15'}`}>
                                {item.is_available ? 'Available' : 'Disabled'}
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex gap-1.5 opacity-100 lg:opacity-0 group-hover/row:opacity-100 transition-opacity">
                              <button onClick={() => openEdit(item)} className="p-2 rounded-xl bg-indigo-500/8 text-indigo-400 hover:bg-indigo-500/15 border border-indigo-500/15 transition-all btn-press" title="Edit item"><Edit2 size={14} /></button>
                              <button onClick={() => toggleAvailability(item)} title={item.is_available ? 'Disable (hide from menu)' : 'Enable'}
                                className={`p-2 rounded-xl transition-all border btn-press ${item.is_available ? 'bg-amber-500/8 text-amber-400 border-amber-500/15 hover:bg-amber-500/15' : 'bg-emerald-500/8 text-emerald-400 border-emerald-500/15 hover:bg-emerald-500/15'}`}>
                                {item.is_available ? <PowerOff size={14} /> : <Power size={14} />}
                              </button>
                              <button onClick={() => handleDelete(item)} title="Delete item"
                                className="p-2 rounded-xl bg-red-500/8 text-red-400 hover:bg-red-500/15 border border-red-500/15 transition-all btn-press">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {!isCollapsed && group.items.length === 0 && (
                  <div className="px-6 py-6 border-t border-white/[0.04] text-center">
                    <p className="text-slate-700 text-[12px] font-medium">No items in this category</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
