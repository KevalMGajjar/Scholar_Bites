import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { Edit2, Image as ImageIcon, Plus, Power, PowerOff } from 'lucide-react';

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
  const [form, setForm] = useState({
    name: '', description: '', price: '', category: '', stock_quantity: 50, restaurant_id: '',
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const restRes = await api.get(`/admin/restaurants/${user?.university_id}`);
      setRestaurants(restRes.data);
      if (restRes.data.length > 0) {
        setSelectedRestaurant((prev) => prev || restRes.data[0].id);
      }
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
    setForm({ name: '', description: '', price: '', category: '', stock_quantity: 50, restaurant_id: selectedRestaurant });
    setImageFile(null);
    setImagePreview(null);
    setShowForm(true);
  };

  const openEdit = (item: MenuItem) => {
    setEditing(item);
    setForm({
      name: item.name,
      description: item.description || '',
      price: item.price,
      category: item.category,
      stock_quantity: item.stock_quantity,
      restaurant_id: item.restaurant_id,
    });
    setImageFile(null);
    setImagePreview(item.image_url || null);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const fd = new FormData();
      fd.append('name', form.name);
      fd.append('description', form.description);
      fd.append('price', form.price);
      fd.append('category', form.category);
      if (!editing) fd.append('restaurant_id', form.restaurant_id);
      fd.append('stock_quantity', form.stock_quantity.toString());
      if (imageFile) fd.append('image', imageFile);

      if (editing) {
        await api.patch(`/admin/menu/${editing.id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      } else {
        await api.post('/admin/menu', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      }
      setShowForm(false);
      fetchItems();
    } catch (err) { console.error(err); }
  };

  const toggleAvailability = async (item: MenuItem) => {
    try {
      await api.patch(`/admin/menu/${item.id}`, { is_available: !item.is_available });
      fetchItems();
    } catch (err) { console.error(err); }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Menu Items</h1>
          <p className="text-slate-400 text-sm mt-1">{items.length} items</p>
        </div>
        <div className="flex gap-3">
          <select
            value={selectedRestaurant}
            onChange={(e) => setSelectedRestaurant(e.target.value)}
            className="px-4 py-2 rounded-xl bg-slate-900/50 border border-slate-700/50 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 backdrop-blur-sm transition-all shadow-sm"
          >
            {restaurants.map((r) => (
              <option key={r.id} value={r.id} className="bg-slate-800">{r.name}</option>
            ))}
          </select>
          <button onClick={openCreate} className="px-4 py-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-sm font-bold hover:bg-indigo-500/20 hover:border-indigo-500/30 transition-all shadow-sm flex items-center gap-2">
            <Plus size={16} />
            Add Item
          </button>
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700/50 rounded-3xl p-8 w-full max-w-lg shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-6 tracking-tight">{editing ? 'Edit Menu Item' : 'New Menu Item'}</h2>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-400 mb-1.5">Item Name <span className="text-red-400">*</span></label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950/50 border border-slate-800 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all placeholder-slate-600 shadow-inner" placeholder="e.g. Classic Burger" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-400 mb-1.5">Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950/50 border border-slate-800 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all placeholder-slate-600 shadow-inner resize-none" placeholder="Brief details about the item..." />
              </div>
              <div className="grid grid-cols-3 gap-5">
                <div>
                  <label className="block text-sm font-semibold text-slate-400 mb-1.5">Price (₹) <span className="text-red-400">*</span></label>
                  <input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950/50 border border-slate-800 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all shadow-inner" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-400 mb-1.5">Category <span className="text-red-400">*</span></label>
                  <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950/50 border border-slate-800 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all shadow-inner placeholder-slate-600" placeholder="e.g. Snacks" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-400 mb-1.5">Inventory</label>
                  <input type="number" value={form.stock_quantity} onChange={(e) => setForm({ ...form, stock_quantity: parseInt(e.target.value) })}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950/50 border border-slate-800 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all shadow-inner" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-400 mb-2">Primary Image</label>
                {imagePreview && (
                  <div className="w-24 h-24 rounded-2xl overflow-hidden border border-slate-700/50 shadow-lg mb-3">
                    <img src={imagePreview} alt="preview" className="w-full h-full object-cover" />
                  </div>
                )}
                <input type="file" accept="image/*" onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setImageFile(file);
                  setImagePreview(URL.createObjectURL(file));
                }}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950/50 border border-slate-800 text-slate-300 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-bold file:bg-indigo-500/10 file:text-indigo-400 hover:file:bg-indigo-500/20 file:transition-all shadow-inner cursor-pointer" />
              </div>
              {!editing && (
                <div>
                  <label className="block text-sm font-semibold text-slate-400 mb-1.5">Link to Restaurant <span className="text-red-400">*</span></label>
                  <select value={form.restaurant_id} onChange={(e) => setForm({ ...form, restaurant_id: e.target.value })} required
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950/50 border border-slate-800 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all shadow-inner">
                    {restaurants.map((r) => (
                      <option key={r.id} value={r.id} className="bg-slate-800">{r.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex gap-3 pt-4 border-t border-slate-800/50 mt-6">
                <button type="submit" className="flex-1 py-3 rounded-xl bg-indigo-500 shadow-lg shadow-indigo-500/20 text-white font-bold tracking-wide hover:bg-indigo-400 transition-all">
                  {editing ? 'Save Changes' : 'Create Item'}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="px-6 py-3 rounded-xl bg-slate-800/80 border border-slate-700/50 text-slate-300 font-bold tracking-wide hover:bg-slate-700 transition-all">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Items Table */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="bg-slate-900/40 backdrop-blur-md border border-slate-700/50 rounded-2xl overflow-hidden shadow-xl">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700/50 bg-slate-800/20">
                <th className="text-left text-xs text-slate-400 font-semibold px-6 py-4 uppercase tracking-wider">Item Details</th>
                <th className="text-left text-xs text-slate-400 font-semibold px-6 py-4 uppercase tracking-wider">Category</th>
                <th className="text-left text-xs text-slate-400 font-semibold px-6 py-4 uppercase tracking-wider">Price</th>
                <th className="text-left text-xs text-slate-400 font-semibold px-6 py-4 uppercase tracking-wider">Stock</th>
                <th className="text-left text-xs text-slate-400 font-semibold px-6 py-4 uppercase tracking-wider">Status</th>
                <th className="text-left text-xs text-slate-400 font-semibold px-6 py-4 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/30">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-800/40 transition-colors group">
                  <td className="px-6 py-4 w-[40%]">
                    <div className="flex items-center gap-4">
                      {item.image_url ? (
                        <div className="relative w-12 h-12 rounded-xl overflow-hidden shadow-md">
                          <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700/50 flex items-center justify-center shadow-inner">
                          <ImageIcon size={20} className="text-slate-500" />
                        </div>
                      )}
                      <div>
                        <p className="text-slate-200 text-sm font-bold tracking-tight">{item.name}</p>
                        <p className="text-slate-500 text-xs truncate max-w-[250px] font-medium leading-relaxed">{item.description}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 rounded-lg bg-slate-800/80 border border-slate-700/50 text-slate-300 text-[10px] font-bold tracking-widest uppercase shadow-sm">{item.category}</span>
                  </td>
                  <td className="px-6 py-4 text-slate-200 text-sm font-bold tracking-tight">₹{parseFloat(item.price).toFixed(0)}</td>
                  <td className="px-6 py-4 text-slate-400 font-mono text-sm font-medium">{item.stock_quantity}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-wide uppercase border ${item.is_available ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                      {item.is_available ? 'Available' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-6 py-4 h-full align-middle">
                    <div className="flex gap-2 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(item)} className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 border border-indigo-500/20 transition-all flex items-center justify-center">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => toggleAvailability(item)}
                        className={`p-2 rounded-xl transition-all border flex items-center justify-center ${item.is_available ? 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/20'}`}>
                        {item.is_available ? <PowerOff size={16} /> : <Power size={16} />}
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
