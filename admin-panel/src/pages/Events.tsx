import { useState, useEffect } from 'react';
import { Calendar, UserPlus, Table, Trash2, Mail, Lock, CheckCircle2, AlertCircle } from 'lucide-react';
import api from '../services/api';

interface Dean {
  id: string;
  email: string;
  created_at: string;
}

interface EventPreOrder {
  id: string;
  event_name: string;
  catering_time: string;
  expected_guests: number;
  status: string;
  staff: { name: string; phone: string };
}

export default function Events() {
  const [activeTab, setActiveTab] = useState<'deans' | 'calendar' | 'funds'>('deans');
  const [deans, setDeans] = useState<Dean[]>([]);
  const [events, setEvents] = useState<EventPreOrder[]>([]);
  const [loading, setLoading] = useState(true);

  // New Dean form
  const [deanEmail, setDeanEmail] = useState('');
  const [deanPassword, setDeanPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'deans') {
        const { data } = await api.get('/admin/deans');
        setDeans(data);
      } else if (activeTab === 'calendar') {
        const { data } = await api.get('/admin/events');
        setEvents(data);
      }
    } catch (error) {
      alert('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handeAddDean = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deanEmail || !deanPassword) return;

    setIsSubmitting(true);
    try {
      await api.post('/admin/deans', { email: deanEmail, password: deanPassword });
      alert('Dean added successfully');
      setDeanEmail('');
      setDeanPassword('');
      fetchData();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to add dean');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteDean = async (id: string) => {
    if (!confirm('Are you sure you want to delete this dean?')) return;
    try {
      await api.delete(`/admin/deans/${id}`);
      fetchData();
    } catch (error) {
      alert('Failed to delete dean');
    }
  };

  const downloadCSV = async (type: string) => {
    try {
      const response = await api.get(`/admin/export/${type}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${type}_export_${new Date().toISOString().slice(0,10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      alert('Failed to download CSV');
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Event Management</h1>
          <p className="text-slate-400 mt-1">Manage deans, event pre-orders, and budgets.</p>
        </div>
        <div className="flex bg-[#0a0c14] p-1 rounded-xl border border-white/5 shadow-inner">
          <button
            onClick={() => setActiveTab('deans')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'deans' ? 'bg-indigo-500 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Deans
          </button>
          <button
            onClick={() => setActiveTab('calendar')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'calendar' ? 'bg-indigo-500 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Events Calendar
          </button>
          <button
            onClick={() => setActiveTab('funds')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'funds' ? 'bg-indigo-500 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Fund Distribution
          </button>
        </div>
      </div>

      {activeTab === 'deans' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
            <div className="bg-[#0a0c16] rounded-2xl p-6 border border-white/5 relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                <UserPlus size={18} className="text-indigo-400" />
                Add New Dean
              </h2>
              <form onSubmit={handeAddDean} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="email"
                      required
                      value={deanEmail}
                      onChange={(e) => setDeanEmail(e.target.value)}
                      className="w-full bg-[#060810] border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                      placeholder="dean@university.edu"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Default Password
                  </label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="password"
                      required
                      value={deanPassword}
                      onChange={(e) => setDeanPassword(e.target.value)}
                      className="w-full bg-[#060810] border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                      placeholder="••••••••"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full mt-4 bg-indigo-500 hover:bg-indigo-600 text-white font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? 'Adding...' : 'Add Dean'}
                </button>
              </form>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="bg-[#0a0c16] rounded-2xl border border-white/5 overflow-hidden">
              <div className="p-6 border-b border-white/5">
                <h2 className="text-lg font-bold text-white flex items-center justify-between">
                  Registered Deans
                  <span className="bg-indigo-500/20 text-indigo-400 text-xs px-2.5 py-1 rounded-full">
                    {deans.length} active
                  </span>
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white/[0.02]">
                      <th className="py-3 px-6 text-xs font-semibold text-slate-400 uppercase tracking-wider">Email</th>
                      <th className="py-3 px-6 text-xs font-semibold text-slate-400 uppercase tracking-wider">Created</th>
                      <th className="py-3 px-6 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {loading ? (
                      <tr>
                        <td colSpan={3} className="py-8 text-center text-slate-500">Loading...</td>
                      </tr>
                    ) : deans.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="py-8 text-center text-slate-500">
                          <div className="flex flex-col items-center gap-2">
                            <AlertCircle size={24} className="text-slate-600" />
                            <p>No deans found.</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      deans.map((dean) => (
                        <tr key={dean.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-4 px-6 text-sm text-white font-medium">{dean.email}</td>
                          <td className="py-4 px-6 text-sm text-slate-400">
                            {new Date(dean.created_at).toLocaleDateString()}
                          </td>
                          <td className="py-4 px-6 text-right">
                            <button
                              onClick={() => handleDeleteDean(dean.id)}
                              className="text-slate-500 hover:text-red-400 p-2 rounded-lg hover:bg-red-500/10 transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'calendar' && (
        <div className="bg-[#0a0c16] rounded-2xl border border-white/5 p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Calendar className="text-indigo-400" /> Upcoming Catering Events
            </h2>
            <button
              onClick={() => downloadCSV('events')}
              className="px-4 py-2 bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all"
            >
              <Table size={16} /> Export to CSV
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {loading ? (
              <p className="text-slate-500 col-span-3 text-center py-12">Loading events...</p>
            ) : events.length === 0 ? (
              <p className="text-slate-500 col-span-3 text-center py-12 flex flex-col items-center">
                <AlertCircle size={32} className="mb-2 opacity-50" />
                No events scheduled.
              </p>
            ) : (
              events.map((evt) => (
                <div key={evt.id} className="bg-[#060810] border border-white/5 p-5 rounded-2xl relative overflow-hidden group">
                  <div className={`absolute top-0 left-0 w-1 h-full ${
                    evt.status === 'approved' ? 'bg-emerald-500' : 'bg-orange-500'
                  }`} />
                  <h3 className="text-white font-bold text-lg mb-1 truncate">{evt.event_name}</h3>
                  <p className="text-slate-400 text-sm mb-4">
                    {new Date(evt.catering_time).toLocaleDateString()} at {new Date(evt.catering_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </p>
                  
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Guests</span>
                      <span className="text-white font-medium">{evt.expected_guests}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Contact</span>
                      <span className="text-white font-medium">{evt.staff?.name}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/5">
                    <span className={`text-xs font-bold uppercase tracking-wider px-2 py-1 rounded-md ${
                      evt.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-orange-500/10 text-orange-400'
                    }`}>
                      {evt.status}
                    </span>
                    {evt.status === 'pending' && (
                       <button className="text-xs bg-indigo-500 hover:bg-indigo-600 text-white px-3 py-1.5 rounded-lg font-semibold transition-colors">
                         Review
                       </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'funds' && (
        <div className="bg-[#0a0c16] rounded-2xl border border-white/5 p-6 min-h-[400px] flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-2xl flex items-center justify-center mb-4">
            <CheckCircle2 className="text-emerald-400" size={32} />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Fund Distribution & Coupons</h2>
          <p className="text-slate-400 max-w-md mx-auto mb-6">
            Detailed fund distribution is managed securely through the Dean Portal. You can download the aggregated summary report from here.
          </p>
          <button
            onClick={() => downloadCSV('funds')}
            className="px-6 py-2.5 bg-indigo-500 hover:bg-indigo-600 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-lg shadow-indigo-500/20"
          >
            <Table size={18} /> Download Master Report
          </button>
        </div>
      )}
    </div>
  );
}
