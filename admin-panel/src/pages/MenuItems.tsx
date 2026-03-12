import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

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
    name: '', description: '', price: '', category: '', image_url: '', stock_quantity: 50, restaurant_id: '',
  });

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
      const res = await api.get('/menu', { params: { restaurant_id: selectedRestaurant } });
      setItems(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [selectedRestaurant]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { if (selectedRestaurant) fetchItems(); }, [selectedRestaurant, fetchItems]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', description: '', price: '', category: '', image_url: '', stock_quantity: 50, restaurant_id: selectedRestaurant });
    setShowForm(true);
  };

  const openEdit = (item: MenuItem) => {
    setEditing(item);
    setForm({
      name: item.name,
      description: item.description || '',
      price: item.price,
      category: item.category,
      image_url: item.image_url || '',
      stock_quantity: item.stock_quantity,
      restaurant_id: item.restaurant_id,
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.patch(`/admin/menu/${editing.id}`, { ...form, price: parseFloat(form.price) });
      } else {
        await api.post('/admin/menu', { ...form, price: parseFloat(form.price) });
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
            className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
          >
            {restaurants.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
          <button onClick={openCreate} className="px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 transition">
            + Add Item
          </button>
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-lg">
            <h2 className="text-xl font-bold text-white mb-4">{editing ? 'Edit Item' : 'New Item'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-300 mb-1">Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required
                  className="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50" />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2}
                  className="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Price (₹) *</label>
                  <input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required
                    className="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50" />
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Category *</label>
                  <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required
                    className="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50" />
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Stock</label>
                  <input type="number" value={form.stock_quantity} onChange={(e) => setForm({ ...form, stock_quantity: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">Image</label>
                {form.image_url && (
                  <img src={form.image_url.startsWith('/') ? (import.meta.env.VITE_API_URL || '').replace('/api','') + form.image_url : form.image_url} alt="preview" className="w-20 h-20 rounded-lg object-cover mb-2" />
                )}
                <input type="file" accept="image/*" onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const fd = new FormData();
                  fd.append('image', file);
                  try {
                    const res = await api.post('/admin/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
                    setForm({ ...form, image_url: res.data.image_url });
                  } catch (err) { console.error('Upload failed:', err); }
                }}
                  className="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:bg-amber-500 file:text-white file:text-sm file:font-medium file:cursor-pointer hover:file:bg-amber-600" />
              </div>
              {!editing && (
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Restaurant *</label>
                  <select value={form.restaurant_id} onChange={(e) => setForm({ ...form, restaurant_id: e.target.value })} required
                    className="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50">
                    {restaurants.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-1 py-2.5 rounded-lg bg-amber-500 text-white font-semibold hover:bg-amber-600 transition">
                  {editing ? 'Save Changes' : 'Add Item'}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2.5 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 transition">
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
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700/50">
                <th className="text-left text-xs text-slate-400 font-medium px-4 py-3">Item</th>
                <th className="text-left text-xs text-slate-400 font-medium px-4 py-3">Category</th>
                <th className="text-left text-xs text-slate-400 font-medium px-4 py-3">Price</th>
                <th className="text-left text-xs text-slate-400 font-medium px-4 py-3">Stock</th>
                <th className="text-left text-xs text-slate-400 font-medium px-4 py-3">Status</th>
                <th className="text-left text-xs text-slate-400 font-medium px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-slate-700/30 hover:bg-slate-700/20 transition">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.name} className="w-10 h-10 rounded-lg object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center">
                          <span className="text-lg">🍽️</span>
                        </div>
                      )}
                      <div>
                        <p className="text-white text-sm font-medium">{item.name}</p>
                        <p className="text-slate-500 text-xs truncate max-w-[200px]">{item.description}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-md bg-slate-700 text-slate-300 text-xs">{item.category}</span>
                  </td>
                  <td className="px-4 py-3 text-white text-sm font-medium">₹{parseFloat(item.price).toFixed(0)}</td>
                  <td className="px-4 py-3 text-slate-300 text-sm">{item.stock_quantity}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${item.is_available ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                      {item.is_available ? 'Available' : 'Unavailable'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(item)} className="px-2 py-1 rounded-md bg-slate-700 text-slate-300 text-xs hover:bg-slate-600 transition">
                        Edit
                      </button>
                      <button onClick={() => toggleAvailability(item)}
                        className={`px-2 py-1 rounded-md text-xs transition ${item.is_available ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'}`}>
                        {item.is_available ? 'Disable' : 'Enable'}
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
