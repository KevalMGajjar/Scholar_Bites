import { useState, useEffect } from 'react';
import { Calendar, UserPlus, Table, Trash2, Mail, Lock, CheckCircle2, AlertCircle, ChevronLeft, ChevronRight, Clock, Users, Pencil, X, Building2, Download, Phone, ShoppingCart } from 'lucide-react';
import api from '../services/api';

interface Dean {
  id: string;
  name?: string;
  school_name?: string;
  email: string;
  created_at: string;
  total_budget?: number;
  used_budget?: number;
  remaining_budget?: number;
  total_coupons?: number;
  redeemed_coupons?: number;
}

interface EventItem {
  id: string;
  menu_item_id: string;
  quantity: number;
  price_at_time: number;
  item_name: string;
  item_image?: string;
}

interface EventPreOrder {
  id: string;
  user_id: string;
  event_name: string;
  event_date: string;
  event_time: string;
  member_count: number;
  staff_name: string;
  staff_email: string;
  status: string;
  total_amount: number;
  created_at: string;
  creator_name?: string;
  creator_phone?: string;
  items: EventItem[];
}

export default function Events() {
  const [activeTab, setActiveTab] = useState<'deans' | 'calendar' | 'funds' | 'requests'>('deans');
  const [deans, setDeans] = useState<Dean[]>([]);
  const [events, setEvents] = useState<EventPreOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [selectedEvents, setSelectedEvents] = useState<EventPreOrder[]>([]);

  // Analytics
  const totalEvents = events.length;
  const pendingEvents = events.filter(e => e.status === 'pending').length;
  const completedEvents = events.filter(e => e.status === 'completed' || e.status === 'approved').length;

  // New Dean form
  const [deanName, setDeanName] = useState('');
  const [deanSchool, setDeanSchool] = useState('');
  const [deanEmail, setDeanEmail] = useState('');
  const [deanPassword, setDeanPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Fund inputs
  const [fundInputs, setFundInputs] = useState<Record<string, string>>({});
  const [isUpdatingFunds, setIsUpdatingFunds] = useState<string | null>(null);

  // Edit Dean modal
  const [editDean, setEditDean] = useState<Dean | null>(null);
  const [editName, setEditName] = useState('');
  const [editSchool, setEditSchool] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');

  // Event detail modal
  const [viewEvent, setViewEvent] = useState<EventPreOrder | null>(null);

  // Requests tab
  const [pendingRequests, setPendingRequests] = useState<EventPreOrder[]>([]);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleUpdateFunds = async (deanId: string, action: 'add' | 'deduct') => {
    let amount = Number(fundInputs[deanId]);
    if (!fundInputs[deanId] || isNaN(amount) || amount <= 0) return;
    
    if (action === 'deduct') amount = -amount;

    setIsUpdatingFunds(deanId);
    try {
      const res = await api.patch(`/admin/deans/${deanId}/budget`, { amount });
      setDeans((prev) => prev.map((d) => (d.id === deanId ? { ...d, ...res.data } : d)));
      setFundInputs((prev) => ({ ...prev, [deanId]: '' }));
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to update funds');
    } finally {
      setIsUpdatingFunds(null);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  // Pre-fetch pending count for badge on initial load
  useEffect(() => {
    api.get('/admin/events').then(({ data }) => {
      setPendingRequests(data.filter((e: EventPreOrder) => e.status === 'pending' || e.status === 'upcoming'));
    }).catch(() => {});
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'deans' || activeTab === 'funds') {
        const { data } = await api.get('/admin/deans');
        setDeans(data);
      } else if (activeTab === 'calendar') {
        const { data } = await api.get('/admin/events');
        setEvents(data);
      } else if (activeTab === 'requests') {
        const { data } = await api.get('/admin/events');
        setPendingRequests(data.filter((e: EventPreOrder) => e.status === 'pending' || e.status === 'upcoming'));
      }
    } catch (error) {
      alert('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    try {
      await api.patch(`/admin/events/${id}/status`, { status: 'approved' });
      setPendingRequests(prev => prev.filter(r => r.id !== id));
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to approve');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: string) => {
    if (!rejectReason.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }
    setActionLoading(id);
    try {
      await api.patch(`/admin/events/${id}/status`, { status: 'rejected', rejection_reason: rejectReason.trim() });
      setPendingRequests(prev => prev.filter(r => r.id !== id));
      setRejectingId(null);
      setRejectReason('');
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to reject');
    } finally {
      setActionLoading(null);
    }
  };

  const handeAddDean = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!deanEmail || !deanPassword || !deanName || !deanSchool) {
      setErrorMsg("Please fill in all fields.");
      return;
    }

    if (deanPassword.length < 8) {
      setErrorMsg("Password must be at least 8 characters.");
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post('/admin/deans', { name: deanName, school_name: deanSchool, email: deanEmail, password: deanPassword });
      setSuccessMsg('Dean registered successfully');
      setDeanName('');
      setDeanSchool('');
      setDeanEmail('');
      setDeanPassword('');
      fetchData();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (error: any) {
      setErrorMsg(error.response?.data?.message || error.message || 'Failed to add dean');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteDean = async (id: string) => {
    if (!confirm('Are you sure you want to delete this dean? This action cannot be undone.')) return;
    try {
      await api.delete(`/admin/deans/${id}`);
      fetchData();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to delete dean');
    }
  };

  const openEditModal = (dean: Dean) => {
    setEditDean(dean);
    setEditName(dean.name || '');
    setEditSchool(dean.school_name || '');
    setEditEmail(dean.email);
    setEditError('');
  };

  const handleEditDean = async () => {
    if (!editDean) return;
    if (!editName.trim() || !editEmail.trim() || !editSchool.trim()) {
      setEditError('All fields are required');
      return;
    }

    setEditLoading(true);
    setEditError('');
    try {
      const res = await api.put(`/admin/deans/${editDean.id}`, {
        name: editName.trim(),
        email: editEmail.trim(),
        school_name: editSchool.trim(),
      });
      setDeans(prev => prev.map(d => d.id === editDean.id ? { ...d, ...res.data } : d));
      setEditDean(null);
    } catch (error: any) {
      setEditError(error.response?.data?.message || 'Failed to update dean');
    } finally {
      setEditLoading(false);
    }
  };

  const downloadCSV = async (type: string) => {
    try {
      const response = await api.get(`/admin/export/${type}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${type}_export_${new Date().toISOString().slice(0,10)}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      alert(`Failed to download ${type} export`);
    }
  };

  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return { firstDay, daysInMonth, year, month };
  };

  const { firstDay, daysInMonth, year, month } = getDaysInMonth(currentMonth);
  const calendarDays = Array.from({ length: 42 }, (_, i) => {
    if (i < firstDay || i >= firstDay + daysInMonth) return null;
    return i - firstDay + 1;
  });

  useEffect(() => {
    const filtered = events.filter(e => {
        const d = new Date(e.event_date);
        return d.getUTCDate() === selectedDate.getDate() &&
               d.getUTCMonth() === selectedDate.getMonth() &&
               d.getUTCFullYear() === selectedDate.getFullYear();
    });
    setSelectedEvents(filtered);
  }, [selectedDate, events]);

  const today = new Date();
  const isToday = (day: number) => day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  const getBudgetPct = (dean: Dean) => {
    const total = dean.total_budget || 0;
    if (total === 0) return 0;
    return Math.min(((dean.used_budget || 0) / total) * 100, 100);
  };

  const getBudgetColor = (pct: number) => {
    if (pct >= 90) return { bar: 'bg-red-500', text: 'text-red-400', glow: 'shadow-red-500/20' };
    if (pct >= 70) return { bar: 'bg-amber-500', text: 'text-amber-400', glow: 'shadow-amber-500/20' };
    return { bar: 'bg-emerald-500', text: 'text-emerald-400', glow: 'shadow-emerald-500/20' };
  };

  return (
    <div className="p-8 max-w-7xl mx-auto animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Event Management</h1>
          <p className="text-slate-400 mt-1">Manage deans, event pre-orders, and budgets.</p>
        </div>
        <div className="flex bg-[#0a0c14] p-1 rounded-xl border border-white/5 shadow-inner">
          {(['deans', 'calendar', 'requests', 'funds'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all relative ${
                activeTab === tab ? 'bg-[#8B1C28] text-white shadow-lg shadow-[#8B1C28]/20' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab === 'deans' ? 'Deans' : tab === 'calendar' ? 'Events Calendar' : tab === 'requests' ? 'Requests' : 'Fund Distribution'}
              {tab === 'requests' && pendingRequests.length > 0 && activeTab !== 'requests' && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-amber-500 text-[10px] font-bold text-black rounded-full flex items-center justify-center animate-pulse">
                  {pendingRequests.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ═══════════════════════ DEANS TAB ═══════════════════════ */}
      {activeTab === 'deans' && (
        <div className="flex flex-col gap-8">
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Add New Dean — Premium Form Card */}
            <div className="lg:w-[380px] shrink-0">
              <div className="bg-[#0a0c16] rounded-2xl p-6 border border-white/5 relative overflow-hidden group sticky top-6">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#8B1C28] via-rose-500 to-[#8B1C28]" />
                <div className="absolute inset-0 bg-gradient-to-br from-[#8B1C28]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                
                <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2 relative z-10">
                  <div className="p-2 bg-[#8B1C28]/10 rounded-lg border border-rose-500/10">
                    <UserPlus size={18} className="text-rose-400" />
                  </div>
                  Register New Dean
                </h2>

                <form onSubmit={handeAddDean} className="space-y-4 relative z-10">
                  {errorMsg && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 rounded-xl flex items-start gap-2 animate-fade-in">
                      <AlertCircle size={16} className="mt-0.5 shrink-0" />
                      <span>{errorMsg}</span>
                    </div>
                  )}
                  {successMsg && (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm p-3 rounded-xl flex items-start gap-2 animate-fade-in">
                      <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                      <span>{successMsg}</span>
                    </div>
                  )}

                  {[
                    { label: 'Full Name', icon: <UserPlus size={16} />, type: 'text', value: deanName, setter: setDeanName, placeholder: 'Dr. John Smith' },
                    { label: 'School / Department', icon: <Building2 size={16} />, type: 'text', value: deanSchool, setter: setDeanSchool, placeholder: 'School of Engineering' },
                    { label: 'Email Address', icon: <Mail size={16} />, type: 'email', value: deanEmail, setter: setDeanEmail, placeholder: 'dean@university.edu' },
                    { label: 'Default Password', icon: <Lock size={16} />, type: 'password', value: deanPassword, setter: setDeanPassword, placeholder: '••••••••' },
                  ].map(field => (
                    <div key={field.label}>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                        {field.label}
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">{field.icon}</span>
                        <input
                          type={field.type}
                          value={field.value}
                          onChange={(e) => field.setter(e.target.value)}
                          placeholder={field.placeholder}
                          className="w-full bg-[#060810] border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white text-sm focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all placeholder:text-slate-600 outline-none"
                        />
                      </div>
                    </div>
                  ))}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full mt-4 bg-gradient-to-r from-[#8B1C28] to-rose-700 hover:from-rose-700 hover:to-[#8B1C28] text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-[#8B1C28]/20 hover:shadow-[#8B1C28]/40"
                  >
                    {isSubmitting ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <UserPlus size={16} />
                    )}
                    {isSubmitting ? 'Registering...' : 'Register Dean'}
                  </button>
                </form>
              </div>
            </div>

            {/* Dean Directory — Card Grid */}
            <div className="flex-1">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-white flex items-center gap-3">
                  Registered Deans
                  <span className="bg-[#8B1C28]/20 text-rose-400 text-xs px-2.5 py-1 rounded-full border border-rose-500/10">
                    {deans.length} active
                  </span>
                </h2>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-8 h-8 border-2 border-[#8B1C28] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : deans.length === 0 ? (
                <div className="bg-[#0a0c16] rounded-2xl p-12 text-center border border-white/5">
                  <AlertCircle size={32} className="mx-auto mb-3 text-slate-600" />
                  <p className="text-slate-500">No deans registered yet. Use the form to add one.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {deans.map((dean) => (
                    <div key={dean.id} className="bg-[#0a0c16] rounded-2xl border border-white/5 p-5 relative overflow-hidden group hover:border-white/10 transition-all duration-300 hover:shadow-[0_10px_40px_rgba(0,0,0,0.3)]">
                      <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-[#8B1C28] to-rose-900 group-hover:w-1.5 transition-all" />
                      
                      <div className="flex items-start justify-between ml-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-white font-bold text-lg truncate">{dean.name || 'Unnamed Dean'}</h3>
                          <p className="text-rose-400/80 text-sm font-medium mt-0.5 flex items-center gap-1.5">
                            <Building2 size={13} />
                            {dean.school_name || 'No School'}
                          </p>
                          <p className="text-slate-500 text-xs mt-2 flex items-center gap-1.5">
                            <Mail size={12} />
                            {dean.email}
                          </p>
                          <div className="flex gap-3 mt-3">
                            <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/10">
                              {dean.total_coupons || 0} coupons
                            </span>
                            <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-400 border border-slate-500/10">
                              Since {new Date(dean.created_at).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                            </span>
                          </div>
                        </div>

                        <div className="flex gap-1 ml-2 shrink-0">
                          <button
                            onClick={() => openEditModal(dean)}
                            className="p-2 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                            title="Edit Dean"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => handleDeleteDean(dean.id)}
                            className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            title="Delete Dean"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ EDIT DEAN MODAL ═══════════════ */}
      {editDean && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in" onClick={() => setEditDean(null)}>
          <div className="bg-[#0d1220] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-[0_25px_80px_rgba(0,0,0,0.6)] relative" onClick={e => e.stopPropagation()}>
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#8B1C28] via-rose-500 to-[#8B1C28] rounded-t-2xl" />
            
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Pencil size={16} className="text-rose-400" />
                Edit Dean Details
              </h3>
              <button onClick={() => setEditDean(null)} className="text-slate-500 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors">
                <X size={18} />
              </button>
            </div>

            {editError && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 rounded-xl flex items-start gap-2 mb-4">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <div className="space-y-4">
              {[
                { label: 'Full Name', value: editName, setter: setEditName, icon: <UserPlus size={16} /> },
                { label: 'School / Department', value: editSchool, setter: setEditSchool, icon: <Building2 size={16} /> },
                { label: 'Email Address', value: editEmail, setter: setEditEmail, icon: <Mail size={16} /> },
              ].map(field => (
                <div key={field.label}>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{field.label}</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">{field.icon}</span>
                    <input
                      type="text"
                      value={field.value}
                      onChange={e => field.setter(e.target.value)}
                      className="w-full bg-[#060810] border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white text-sm focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all outline-none"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setEditDean(null)}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-slate-400 hover:text-white hover:border-white/20 font-semibold text-sm transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleEditDean}
                disabled={editLoading}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#8B1C28] to-rose-700 text-white font-semibold text-sm transition-all hover:shadow-lg hover:shadow-[#8B1C28]/30 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {editLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <CheckCircle2 size={16} />}
                {editLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════ CALENDAR TAB ═══════════════════════ */}
      {activeTab === 'calendar' && (
        <div className="flex flex-col gap-6">
          {/* Top Summary Ribbon */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-[#0a0c16] rounded-2xl border border-white/5 p-6 relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-[#8B1C28]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex justify-between items-start mb-4">
                <span className="text-slate-400 font-semibold uppercase tracking-wider text-xs">Total Events</span>
                <Calendar size={18} className="text-rose-400" />
              </div>
              <h3 className="text-4xl font-bold text-white mb-2">{totalEvents}</h3>
              <p className="text-xs text-rose-400 font-medium bg-[#8B1C28]/10 inline-block px-2 py-1 rounded-md">Scheduled This Period</p>
            </div>
            
            <div className="bg-[#0a0c16] rounded-2xl border border-white/5 p-6 relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex justify-between items-start mb-4">
                <span className="text-slate-400 font-semibold uppercase tracking-wider text-xs">Pending Review</span>
                <AlertCircle size={18} className="text-amber-400" />
              </div>
              <h3 className="text-4xl font-bold text-white mb-2">{pendingEvents}</h3>
              <p className="text-xs text-amber-400 font-medium bg-amber-500/10 inline-block px-2 py-1 rounded-md">Action Required</p>
            </div>

            <div className="bg-[#0a0c16] rounded-2xl border border-white/5 p-6 relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex justify-between items-start mb-4">
                <span className="text-slate-400 font-semibold uppercase tracking-wider text-xs">Completed Events</span>
                <CheckCircle2 size={18} className="text-emerald-400" />
              </div>
              <h3 className="text-4xl font-bold text-white mb-2">{completedEvents}</h3>
              <p className="text-xs text-emerald-400 font-medium bg-emerald-500/10 inline-block px-2 py-1 rounded-md">Successfully Executed</p>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-6">
            {/* Interactive Calendar Grid */}
            <div className="lg:w-2/3 bg-[#0a0c16] rounded-2xl border border-white/5 p-6">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Calendar className="text-rose-400" /> Event Schedule
                </h2>
                <div className="flex items-center gap-4 bg-white/[0.02] p-1 rounded-xl border border-white/5">
                  <button onClick={prevMonth} className="p-2 hover:bg-white/[0.05] rounded-lg transition-colors text-slate-400 hover:text-white">
                    <ChevronLeft size={18} />
                  </button>
                  <span className="text-white font-semibold min-w-32 text-center">
                    {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
                  </span>
                  <button onClick={nextMonth} className="p-2 hover:bg-white/[0.05] rounded-lg transition-colors text-slate-400 hover:text-white">
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 mb-2">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="text-center text-xs font-semibold text-slate-500 uppercase tracking-wider py-2">
                      {day}
                    </div>
                  ))}
              </div>
              
              <div className="grid grid-cols-7 gap-2">
                {calendarDays.map((day, idx) => {
                  if (day === null) return <div key={idx} className="h-24 rounded-xl bg-white/[0.01] border border-white/[0.02]" />;
                  
                  const cellDate = new Date(year, month, day);
                  const isSelected = selectedDate.getDate() === day && selectedDate.getMonth() === month && selectedDate.getFullYear() === year;
                  const dayEvents = events.filter(e => {
                      const ed = new Date(e.event_date);
                      return ed.getUTCDate() === day && ed.getUTCMonth() === month && ed.getUTCFullYear() === year;
                  });
                  const todayCell = isToday(day);
                  const hasEvt = dayEvents.length > 0;

                  let cellBorder = 'border-white/5 hover:border-white/20';
                  let cellBg = 'bg-[#060810]';
                  if (isSelected) {
                    cellBorder = 'border-rose-500/50';
                    cellBg = 'bg-[#8B1C28]/10 shadow-[inset_0_0_20px_rgba(139,28,40,0.2)]';
                  } else if (todayCell) {
                    cellBorder = 'border-emerald-500/40';
                    cellBg = 'bg-emerald-500/5';
                  } else if (hasEvt) {
                    cellBorder = 'border-rose-500/30';
                    cellBg = 'bg-rose-500/5';
                  }

                  return (
                    <button
                      key={idx}
                      onClick={() => setSelectedDate(cellDate)}
                      className={`h-24 rounded-xl p-2 flex flex-col items-start justify-start border transition-all text-left relative group ${cellBg} ${cellBorder}`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className={`text-sm font-semibold ${isSelected ? 'text-rose-400' : todayCell ? 'text-emerald-400' : 'text-slate-400 group-hover:text-white'}`}>
                          {day}
                        </span>
                        {todayCell && (
                          <span className="text-[8px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full">Today</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-auto">
                        {dayEvents.map(evt => (
                          <div 
                            key={evt.id} 
                            title={evt.event_name}
                            className={`w-2 h-2 rounded-full ${evt.status === 'pending' || evt.status === 'upcoming' ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]' : 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]'}`}
                          />
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Event Details Side-Panel */}
            <div className="lg:w-1/3 flex flex-col gap-4">
              <div className="bg-[#0a0c16] rounded-2xl border border-rose-500/20 shadow-[0_0_40px_rgba(139,28,40,0.05)] p-6 sticky top-6">
                <div className="border-b border-white/5 pb-4 mb-6">
                  <h3 className="text-xl font-bold text-white mb-1">
                    {selectedDate.toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric' })}
                  </h3>
                  <p className="text-slate-400 text-sm">
                    {selectedEvents.length === 0 ? 'No events scheduled' : `${selectedEvents.length} event${selectedEvents.length > 1 ? 's' : ''} scheduled`}
                  </p>
                </div>

                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                  {selectedEvents.length === 0 ? (
                    <div className="py-12 flex flex-col items-center justify-center text-slate-500 text-center">
                      <Calendar size={32} className="mb-4 opacity-20" />
                      <p>Select a different date or schedule a new event to see details here.</p>
                    </div>
                  ) : (
                    selectedEvents.map(evt => (
                      <div key={evt.id} className="bg-white/[0.02] border border-white/10 p-5 rounded-xl transition-all hover:bg-white/[0.04]">
                        <div className="flex justify-between items-start mb-3">
                          <h4 className="text-white font-semibold text-lg">{evt.event_name}</h4>
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md ${
                            evt.status === 'upcoming' || evt.status === 'pending' ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'
                          }`}>
                            {evt.status}
                          </span>
                        </div>
                        
                        <div className="space-y-3 mt-4">
                          <div className="flex items-center gap-3 text-sm text-slate-300">
                            <Clock size={16} className="text-rose-400" />
                            <span>{evt.event_time || '—'}</span>
                          </div>
                          <div className="flex items-center gap-3 text-sm text-slate-300">
                            <Users size={16} className="text-rose-400" />
                            <span>{evt.member_count} Members</span>
                          </div>
                          <div className="flex items-center gap-3 text-sm text-slate-300">
                            <UserPlus size={16} className="text-rose-400" />
                            <span>{evt.staff_name} ({evt.staff_email})</span>
                          </div>
                        </div>

                        <div className="mt-5 pt-4 border-t border-white/5">
                          <button
                            onClick={() => setViewEvent(evt)}
                            className="w-full text-sm bg-[#8B1C28] hover:bg-rose-800 text-white py-2 rounded-lg font-semibold transition-colors"
                          >
                            View Full Details
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ EVENT DETAIL MODAL ═══════════════ */}
      {viewEvent && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in" onClick={() => setViewEvent(null)}>
          <div className="bg-[#0d1220] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-[0_25px_80px_rgba(0,0,0,0.6)] relative custom-scrollbar" onClick={e => e.stopPropagation()}>
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#8B1C28] via-rose-500 to-[#8B1C28] rounded-t-2xl" />
            
            {/* Modal Header */}
            <div className="p-6 pb-4 flex justify-between items-start border-b border-white/5">
              <div>
                <h3 className="text-xl font-bold text-white">{viewEvent.event_name}</h3>
                <p className="text-slate-500 text-xs font-mono mt-1">Order ID: {viewEvent.id}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md border ${
                  viewEvent.status === 'upcoming' || viewEvent.status === 'pending'
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/10'
                    : viewEvent.status === 'completed' || viewEvent.status === 'approved'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/10'
                    : 'bg-red-500/10 text-red-400 border-red-500/10'
                }`}>
                  {viewEvent.status}
                </span>
                <button onClick={() => setViewEvent(null)} className="text-slate-500 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors">
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Detail Grid */}
            <div className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white/[0.02] rounded-xl p-4 border border-white/5">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1.5">Event Date</p>
                  <p className="text-sm text-white font-semibold">{new Date(viewEvent.event_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                </div>
                <div className="bg-white/[0.02] rounded-xl p-4 border border-white/5">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1.5">Event Time</p>
                  <p className="text-sm text-white font-semibold flex items-center gap-1.5"><Clock size={14} className="text-rose-400" />{viewEvent.event_time || '—'}</p>
                </div>
                <div className="bg-white/[0.02] rounded-xl p-4 border border-white/5">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1.5">Members</p>
                  <p className="text-sm text-white font-semibold flex items-center gap-1.5"><Users size={14} className="text-rose-400" />{viewEvent.member_count}</p>
                </div>
                <div className="bg-white/[0.02] rounded-xl p-4 border border-white/5">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1.5">Total Amount</p>
                  <p className="text-lg text-emerald-400 font-bold font-mono">₹{Number(viewEvent.total_amount).toLocaleString('en-IN')}</p>
                </div>
              </div>

              {/* Staff & Creator */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="bg-white/[0.02] rounded-xl p-4 border border-white/5">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-3">Staff Contact</p>
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2.5 text-sm">
                      <UserPlus size={15} className="text-rose-400 shrink-0" />
                      <span className="text-white font-medium">{viewEvent.staff_name}</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-sm">
                      <Mail size={15} className="text-rose-400 shrink-0" />
                      <span className="text-slate-300">{viewEvent.staff_email}</span>
                    </div>
                  </div>
                </div>
                <div className="bg-white/[0.02] rounded-xl p-4 border border-white/5">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-3">Created By</p>
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2.5 text-sm">
                      <Users size={15} className="text-rose-400 shrink-0" />
                      <span className="text-white font-medium">{viewEvent.creator_name || 'Unknown'}</span>
                    </div>
                    {viewEvent.creator_phone && (
                      <div className="flex items-center gap-2.5 text-sm">
                        <Phone size={15} className="text-rose-400 shrink-0" />
                        <span className="text-slate-300">{viewEvent.creator_phone}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2.5 text-sm">
                      <Clock size={15} className="text-slate-500 shrink-0" />
                      <span className="text-slate-400 text-xs">
                        Created {new Date(viewEvent.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Ordered Items */}
              {viewEvent.items && viewEvent.items.length > 0 && (
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-3 flex items-center gap-1.5">
                    <ShoppingCart size={13} /> Ordered Items ({viewEvent.items.length})
                  </p>
                  <div className="bg-white/[0.02] rounded-xl border border-white/5 overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-white/[0.02]">
                          <th className="text-left py-3 px-4 text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Item</th>
                          <th className="text-center py-3 px-4 text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Qty</th>
                          <th className="text-right py-3 px-4 text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Unit Price</th>
                          <th className="text-right py-3 px-4 text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {viewEvent.items.map(item => (
                          <tr key={item.id} className="hover:bg-white/[0.02]">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                {item.item_image ? (
                                  <img src={item.item_image} alt={item.item_name} className="w-10 h-10 rounded-lg object-cover border border-white/10" />
                                ) : (
                                  <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                                    <ShoppingCart size={14} className="text-slate-600" />
                                  </div>
                                )}
                                <span className="text-sm text-white font-medium">{item.item_name}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-center text-sm text-slate-300 font-mono">{item.quantity}</td>
                            <td className="py-3 px-4 text-right text-sm text-slate-400 font-mono">₹{Number(item.price_at_time).toFixed(2)}</td>
                            <td className="py-3 px-4 text-right text-sm text-emerald-400 font-bold font-mono">₹{(item.quantity * Number(item.price_at_time)).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-white/10 bg-white/[0.03]">
                          <td colSpan={3} className="py-3 px-4 text-right text-xs text-slate-400 font-semibold uppercase tracking-wider">Grand Total</td>
                          <td className="py-3 px-4 text-right text-base text-white font-bold font-mono">₹{Number(viewEvent.total_amount).toLocaleString('en-IN')}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-6 pt-0 flex gap-3">
              <button
                onClick={() => setViewEvent(null)}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-slate-400 hover:text-white hover:border-white/20 font-semibold text-sm transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════ REQUESTS TAB ═══════════════════════ */}
      {activeTab === 'requests' && (
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white flex items-center gap-3">
              <div className="p-2 bg-amber-500/10 rounded-lg border border-amber-500/10">
                <AlertCircle size={18} className="text-amber-400" />
              </div>
              Pending Catering Requests
              <span className="bg-amber-500/15 text-amber-400 text-xs px-2.5 py-1 rounded-full border border-amber-500/10">
                {pendingRequests.length} pending
              </span>
            </h2>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-[#8B1C28] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : pendingRequests.length === 0 ? (
            <div className="bg-[#0a0c16] rounded-2xl p-16 text-center border border-white/5">
              <CheckCircle2 size={48} className="mx-auto mb-4 text-emerald-500/30" />
              <h3 className="text-lg font-bold text-white mb-2">All Clear</h3>
              <p className="text-slate-500">No pending catering requests to review.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingRequests.map((req) => (
                <div key={req.id} className="bg-[#0a0c16] rounded-2xl border border-white/5 overflow-hidden hover:border-amber-500/20 transition-all">
                  {/* Request Header */}
                  <div className="p-6 pb-4 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <h3 className="text-lg font-bold text-white">{req.event_name}</h3>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/10">
                          {req.status}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="flex items-center gap-2 text-sm text-slate-300">
                          <Calendar size={14} className="text-rose-400 shrink-0" />
                          {new Date(req.event_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-slate-300">
                          <Clock size={14} className="text-rose-400 shrink-0" />
                          {req.event_time || '—'}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-slate-300">
                          <Users size={14} className="text-rose-400 shrink-0" />
                          {req.member_count} members
                        </div>
                        <div className="flex items-center gap-2 text-sm text-emerald-400 font-bold font-mono">
                          ₹{Number(req.total_amount).toLocaleString('en-IN')}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1.5"><UserPlus size={12} /> {req.staff_name}</span>
                        <span className="flex items-center gap-1.5"><Mail size={12} /> {req.staff_email}</span>
                        {req.creator_phone && <span className="flex items-center gap-1.5"><Phone size={12} /> {req.creator_phone}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Items Preview */}
                  {req.items && req.items.length > 0 && (
                    <div className="px-6 pb-3">
                      <div className="flex flex-wrap gap-2">
                        {req.items.map(item => (
                          <span key={item.id} className="text-xs bg-white/[0.03] border border-white/[0.06] rounded-lg px-2.5 py-1.5 text-slate-400">
                            {item.quantity}x {item.item_name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="px-6 py-4 border-t border-white/5 bg-white/[0.01]">
                    {rejectingId === req.id ? (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-semibold text-red-400 uppercase tracking-wider mb-2">Reason for Rejection</label>
                          <textarea
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            rows={2}
                            placeholder="e.g. Budget constraints, overlapping events, insufficient notice period..."
                            className="w-full bg-[#060810] border border-red-500/20 rounded-xl py-3 px-4 text-white text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all placeholder:text-slate-600 outline-none resize-none"
                          />
                        </div>
                        <div className="flex gap-3">
                          <button
                            onClick={() => handleReject(req.id)}
                            disabled={actionLoading === req.id || !rejectReason.trim()}
                            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-red-700 text-white font-semibold text-sm transition-all hover:shadow-lg hover:shadow-red-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            {actionLoading === req.id ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <X size={16} />}
                            Confirm Rejection
                          </button>
                          <button
                            onClick={() => { setRejectingId(null); setRejectReason(''); }}
                            className="px-6 py-2.5 rounded-xl border border-white/10 text-slate-400 hover:text-white hover:border-white/20 font-semibold text-sm transition-all"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleApprove(req.id)}
                          disabled={actionLoading === req.id}
                          className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 text-white font-semibold text-sm transition-all hover:shadow-lg hover:shadow-emerald-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {actionLoading === req.id ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <CheckCircle2 size={16} />}
                          Approve Request
                        </button>
                        <button
                          onClick={() => setRejectingId(req.id)}
                          className="flex-1 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/15 font-semibold text-sm transition-all flex items-center justify-center gap-2"
                        >
                          <X size={16} /> Reject
                        </button>
                        <button
                          onClick={() => setViewEvent(req)}
                          className="px-4 py-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 text-slate-400 hover:text-white text-sm font-semibold transition-all"
                        >
                          Details
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════ FUNDS TAB — Financial Ledger ═══════════════════════ */}
      {activeTab === 'funds' && (
        <div className="bg-[#0a0c16] rounded-2xl border border-white/5 overflow-hidden">
          {/* Ledger Header */}
          <div className="p-6 border-b border-white/5 bg-gradient-to-r from-[#0a0c16] to-[#0d1020]">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-3">
                  <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/10">
                    <Table size={18} className="text-emerald-400" />
                  </div>
                  Dean Fund Distribution Ledger
                </h2>
                <p className="text-slate-500 text-sm mt-1 ml-12">Financial overview of all dean budget allocations</p>
              </div>
              <button
                onClick={() => downloadCSV('funds')}
                className="px-4 py-2.5 bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all text-white hover:border-white/20"
              >
                <Download size={16} /> Export Ledger
              </button>
            </div>

            {/* Summary Stats Row */}
            <div className="grid grid-cols-3 gap-4 mt-6">
              <div className="bg-white/[0.02] rounded-xl p-4 border border-white/5">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1">Total Allocated</p>
                <p className="text-xl font-bold text-emerald-400">₹{deans.reduce((sum, d) => sum + (d.total_budget || 0), 0).toLocaleString('en-IN')}</p>
              </div>
              <div className="bg-white/[0.02] rounded-xl p-4 border border-white/5">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1">Total Used</p>
                <p className="text-xl font-bold text-amber-400">₹{deans.reduce((sum, d) => sum + (d.used_budget || 0), 0).toLocaleString('en-IN')}</p>
              </div>
              <div className="bg-white/[0.02] rounded-xl p-4 border border-white/5">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1">Remaining</p>
                <p className="text-xl font-bold text-white">₹{deans.reduce((sum, d) => sum + ((d.total_budget || 0) - (d.used_budget || 0)), 0).toLocaleString('en-IN')}</p>
              </div>
            </div>
          </div>

          {/* Ledger Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/[0.02]">
                  <th className="py-4 px-6 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Dean</th>
                  <th className="py-4 px-6 text-[10px] font-semibold text-slate-400 uppercase tracking-wider text-right">Allocated</th>
                  <th className="py-4 px-6 text-[10px] font-semibold text-slate-400 uppercase tracking-wider text-right">Used</th>
                  <th className="py-4 px-6 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Utilization</th>
                  <th className="py-4 px-6 text-[10px] font-semibold text-slate-400 uppercase tracking-wider text-right">Remaining</th>
                  <th className="py-4 px-6 text-[10px] font-semibold text-slate-400 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center">
                      <div className="w-8 h-8 border-2 border-[#8B1C28] border-t-transparent rounded-full animate-spin mx-auto" />
                    </td>
                  </tr>
                ) : deans.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500">
                      No deans registered. Add deans from the Deans tab first.
                    </td>
                  </tr>
                ) : (
                  deans.map((dean) => {
                    const pct = getBudgetPct(dean);
                    const colors = getBudgetColor(pct);
                    const remaining = (dean.total_budget || 0) - (dean.used_budget || 0);

                    return (
                      <tr key={dean.id} className="hover:bg-white/[0.02] transition-colors group">
                        <td className="py-4 px-6">
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold text-white">{dean.name || 'Unnamed'}</span>
                            <span className="text-xs text-slate-500">{dean.school_name || '—'}</span>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <span className="text-sm text-emerald-400 font-bold font-mono">₹{(dean.total_budget || 0).toLocaleString('en-IN')}</span>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <span className="text-sm text-slate-400 font-mono">₹{(dean.used_budget || 0).toLocaleString('en-IN')}</span>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3 min-w-[140px]">
                            <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${colors.bar} transition-all duration-500 shadow-lg ${colors.glow}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className={`text-xs font-bold ${colors.text} min-w-[38px] text-right`}>{pct.toFixed(0)}%</span>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <span className={`text-sm font-bold font-mono ${remaining < 0 ? 'text-red-400' : 'text-white'}`}>
                            ₹{remaining.toLocaleString('en-IN')}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex justify-end items-center gap-2">
                            <input
                              type="number"
                              placeholder="Amt"
                              min="1"
                              value={fundInputs[dean.id] || ''}
                              onChange={(e) => setFundInputs({ ...fundInputs, [dean.id]: e.target.value })}
                              className="bg-[#060810] border border-white/10 rounded-lg py-1.5 px-3 text-white text-sm focus:border-rose-500 focus:ring-1 focus:ring-rose-500 w-20 outline-none font-mono"
                            />
                            <button
                              onClick={() => handleUpdateFunds(dean.id, 'add')}
                              disabled={isUpdatingFunds === dean.id || !fundInputs[dean.id] || Number(fundInputs[dean.id]) <= 0}
                              className="bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-400 disabled:opacity-30 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border border-emerald-500/10"
                            >
                              + Add
                            </button>
                            <button
                              onClick={() => handleUpdateFunds(dean.id, 'deduct')}
                              disabled={isUpdatingFunds === dean.id || !fundInputs[dean.id] || Number(fundInputs[dean.id]) <= 0}
                              className="bg-red-500/15 hover:bg-red-500/30 text-red-400 disabled:opacity-30 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border border-red-500/10"
                            >
                              − Deduct
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
