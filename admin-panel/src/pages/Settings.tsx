import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { Camera, Building2, MapPin } from 'lucide-react';

interface University {
  id: string;
  name: string;
  address: string;
  logo_url: string;
}

export default function Settings() {
  const { user } = useAuth();
  const [university, setUniversity] = useState<University | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const fetchUniversity = useCallback(async () => {
    if (!user?.university_id) return;
    try {
      const res = await api.get(`/university/${user.university_id}`);
      setUniversity(res.data);
      setName(res.data.name);
      setAddress(res.data.address || '');
      setLogoPreview(res.data.logo_url || null);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch university details');
    } finally {
      setLoading(false);
    }
  }, [user?.university_id]);

  useEffect(() => {
    fetchUniversity();
  }, [fetchUniversity]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.university_id) return;

    setSaving(true);
    setError('');
    setSuccess('');

    const fd = new FormData();
    fd.append('name', name);
    fd.append('address', address);
    if (logoFile) {
      fd.append('logo', logoFile);
    }

    try {
      await api.patch(`/university/${user.university_id}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSuccess('University settings updated successfully!');
      fetchUniversity();
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to update university');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full min-h-screen">
        <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!university) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-white mb-2">Settings</h1>
        <p className="text-slate-400">No university associated with this account.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Settings</h1>
        <p className="text-slate-400 text-sm mt-1">Manage your university details and app branding</p>
      </div>

      <div className="bg-slate-900/40 backdrop-blur-md border border-slate-700/50 rounded-3xl p-8 shadow-xl">
        <h2 className="text-xl font-bold text-white mb-6">University Profile</h2>
        
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium">
            {error}
          </div>
        )}
        
        {success && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Logo Upload Section */}
          <div className="flex items-start gap-6 pb-6 border-b border-white/5">
            <div className="relative group shrink-0">
              <div className="w-24 h-24 rounded-2xl bg-slate-800 border-2 border-slate-700 overflow-hidden shadow-inner flex items-center justify-center">
                {logoPreview ? (
                  <img src={logoPreview} alt="University Logo" className="w-full h-full object-cover" />
                ) : (
                  <Building2 size={32} className="text-slate-500" />
                )}
              </div>
              <label className="absolute inset-0 bg-black/50 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center cursor-pointer rounded-2xl">
                <Camera size={20} className="text-white mb-1" />
                <span className="text-white text-xs font-bold">Change</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setLogoFile(file);
                      setLogoPreview(URL.createObjectURL(file));
                    }
                  }}
                />
              </label>
            </div>
            <div className="flex-1 mt-2">
              <h3 className="text-white font-bold tracking-wide">University Logo</h3>
              <p className="text-slate-400 text-sm mt-1 mb-3">
                This logo represents your university in the system. Upload a square PNG or JPG at least 500x500px.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-300 flex items-center gap-2">
                <Building2 size={16} className="text-indigo-400" />
                University Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl bg-slate-950/50 border border-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all shadow-inner placeholder-slate-600"
                placeholder="Enter university name"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-300 flex items-center gap-2">
                <MapPin size={16} className="text-indigo-400" />
                Address
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-950/50 border border-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all shadow-inner placeholder-slate-600"
                placeholder="Enter formal address"
              />
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={saving}
              className="px-8 py-3 rounded-xl bg-indigo-500 shadow-lg shadow-indigo-500/20 text-white font-bold tracking-wide hover:bg-indigo-400 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
