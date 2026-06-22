import { useEffect, useState } from 'react';
import api from '../services/api';
import { UserPlus, Activity, LogIn, ShieldOff, Unlock, Trash2, AlertTriangle, Eye, EyeOff, Pencil, Search } from 'lucide-react';

// Mirrors the backend passwordSchema (validators.ts). The API enforces this on
// /superadmin/staff create + update, so validate here for an immediate message.
const PASSWORD_RULE = 'At least 8 characters, with 1 uppercase letter and 1 number.';
function passwordRuleError(pw: string): string | null {
  if (pw.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Z]/.test(pw)) return 'Password must contain at least one uppercase letter.';
  if (!/[0-9]/.test(pw)) return 'Password must contain at least one number.';
  return null;
}

interface Staff {
  id: string;
  name: string;
  email: string | null;
  role: string;
  restaurant_id: string | null;
  restaurant_name: string | null;
  created_at: string;
  // Access Control shows every account type. Only `kind === 'staff'` rows are
  // managed here (edit/delete); event heads and delegates are shown read-only
  // (they're managed in their own sections).
  kind?: 'staff' | 'event_head' | 'delegate';
  subtitle?: string | null;
}

interface Restaurant {
  id: string;
  name: string;
}

interface StaffAnalytics {
  lastLogin: string | null;
  totalOrdersCompleted: number;
  totalRefundsHandled: number;
  recentActivity: {
    action: string;
    resource: string;
    details: string;
    created_at: string;
  }[];
}

interface LockedAccount {
  email: string;
  lockedUntil: string;
  remainingSeconds: number;
}

export default function StaffManagement() {
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Restaurants (for assigning staff to a kitchen)
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', password: '', role: 'staff', restaurant_id: '' });
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');

  // Edit State
  const [editTarget, setEditTarget] = useState<Staff | null>(null);
  const [editData, setEditData] = useState({ name: '', email: '', role: 'staff', password: '', restaurant_id: '' });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');
  const [showEditPassword, setShowEditPassword] = useState(false);

  // Delete State — two-step confirmation
  const [deleteTarget, setDeleteTarget] = useState<Staff | null>(null);
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [showModalPassword, setShowModalPassword] = useState(false);

  // Analytics Slide-over State
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [analytics, setAnalytics] = useState<StaffAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // Locked Accounts State
  const [lockedAccounts, setLockedAccounts] = useState<LockedAccount[]>([]);
  const [lockedLoading, setLockedLoading] = useState(false);
  const [unlockingEmail, setUnlockingEmail] = useState<string | null>(null);
  const [lockMessage, setLockMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Success toast
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    fetchStaff();
    fetchLockedAccounts();
    fetchRestaurants();
  }, []);

  useEffect(() => {
    if (successMsg) {
      const t = setTimeout(() => setSuccessMsg(''), 4000);
      return () => clearTimeout(t);
    }
  }, [successMsg]);

  const fetchStaff = async () => {
    try {
      setLoading(true);
      // Pull every account type so Access Control shows the whole roster.
      const [staffRes, deansRes, delegatesRes] = await Promise.all([
        api.get('/superadmin/staff'),
        api.get('/superadmin/deans-list').catch(() => ({ data: [] })),
        api.get('/superadmin/university-staff').catch(() => ({ data: [] })),
      ]);
      const staff: Staff[] = (staffRes.data || []).map((s: any) => ({ ...s, kind: 'staff' as const }));
      const eventHeads: Staff[] = (deansRes.data || []).map((d: any) => ({
        id: d.id, name: d.name, email: d.email ?? null, role: 'event_head',
        restaurant_id: null, restaurant_name: null, created_at: d.created_at ?? '',
        kind: 'event_head' as const, subtitle: d.school_name ?? null,
      }));
      const delegates: Staff[] = (delegatesRes.data || []).map((u: any) => ({
        id: u.id, name: u.name, email: u.email ?? u.phone ?? null, role: 'delegate',
        restaurant_id: null, restaurant_name: null, created_at: u.created_at ?? '',
        kind: 'delegate' as const, subtitle: u.dean_name ? `Under ${u.dean_name}` : null,
      }));
      setStaffList([...staff, ...eventHeads, ...delegates]);
    } catch (err) {
      console.error('Failed to fetch staff:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRestaurants = async () => {
    try {
      const { data } = await api.get('/superadmin/restaurants');
      setRestaurants(data || []);
    } catch (err) {
      console.error('Failed to fetch restaurants:', err);
    }
  };

  const fetchLockedAccounts = async () => {
    try {
      setLockedLoading(true);
      const { data } = await api.get('/superadmin/locked-accounts');
      setLockedAccounts(data.lockedAccounts || []);
    } catch (err) {
      console.error('Failed to fetch locked accounts:', err);
    } finally {
      setLockedLoading(false);
    }
  };

  const handleUnlock = async (email: string) => {
    setUnlockingEmail(email);
    setLockMessage(null);
    try {
      const { data } = await api.post('/superadmin/unlock-account', { email });
      setLockMessage({ type: 'success', text: data.message });
      setLockedAccounts((prev) => prev.filter((a) => a.email !== email));
    } catch (err: any) {
      setLockMessage({ type: 'error', text: err.response?.data?.message || 'Failed to unlock account' });
    } finally {
      setUnlockingEmail(null);
    }
  };

  const loadAnalytics = async (staff: Staff) => {
    setSelectedStaff(staff);
    setAnalytics(null);
    setAnalyticsLoading(true);
    try {
      const { data } = await api.get(`/superadmin/staff/${staff.id}/analytics`);
      setAnalytics(data);
    } catch (err) {
      console.error('Failed to load analytics', err);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');
    const pwErr = passwordRuleError(formData.password);
    if (pwErr) { setModalError(pwErr); return; }
    setModalLoading(true);
    try {
      const payload: Record<string, string> = {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        role: formData.role,
      };
      if (formData.role === 'staff') payload.restaurant_id = formData.restaurant_id;
      await api.post('/superadmin/staff', payload);
      setShowAddModal(false);
      setFormData({ name: '', email: '', password: '', role: 'staff', restaurant_id: '' });
      setShowModalPassword(false);
      setSuccessMsg('Account created successfully.');
      fetchStaff();
    } catch (err: any) {
      setModalError(err.response?.data?.message || 'Failed to create user');
    } finally {
      setModalLoading(false);
    }
  };

  // ── Edit ──
  const openEditModal = (staff: Staff) => {
    setEditTarget(staff);
    setEditData({ name: staff.name, email: staff.email || '', role: staff.role, password: '', restaurant_id: staff.restaurant_id || '' });
    setEditError('');
    setShowEditPassword(false);
  };

  const handleEditStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    setEditError('');
    if (editData.password) {
      const pwErr = passwordRuleError(editData.password);
      if (pwErr) { setEditError(pwErr); return; }
    }
    setEditLoading(true);
    try {
      const payload: Record<string, string> = {
        name: editData.name.trim(),
        email: editData.email.trim(),
        role: editData.role,
        restaurant_id: editData.role === 'staff' ? editData.restaurant_id : '',
      };
      if (editData.password) payload.password = editData.password;
      await api.put(`/superadmin/staff/${editTarget.id}`, payload);
      setEditTarget(null);
      setSuccessMsg('Account updated successfully.');
      fetchStaff();
    } catch (err: any) {
      setEditError(err.response?.data?.message || 'Failed to update account');
    } finally {
      setEditLoading(false);
    }
  };

  // ── Delete: step 1 opens the modal, step 2 confirms ──
  const openDeleteModal = (staff: Staff) => {
    setDeleteTarget(staff);
    setDeleteConfirmed(false);
    setDeleteError('');
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    if (!deleteConfirmed) {
      // First click → reveal the final confirmation
      setDeleteConfirmed(true);
      return;
    }
    // Second click → actually delete
    setDeleteLoading(true);
    setDeleteError('');
    try {
      await api.delete(`/superadmin/staff/${deleteTarget.id}`);
      setDeleteTarget(null);
      setDeleteConfirmed(false);
      setSuccessMsg(`${deleteTarget.name} has been permanently deleted.`);
      fetchStaff();
    } catch (err: any) {
      setDeleteError(err.response?.data?.message || 'Failed to delete account');
    } finally {
      setDeleteLoading(false);
    }
  };

  const closeSidebar = () => {
    setSelectedStaff(null);
    setAnalytics(null);
  };

  const formatRemainingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  return (
    <div className="p-8 lg:p-12 max-w-7xl mx-auto space-y-10 animate-fade-up font-body flex relative min-h-[calc(100vh-2rem)]">
      <div className={`flex-1 transition-all duration-300 ${selectedStaff ? 'mr-96' : ''}`}>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-10">
          <div>
            <h1 className="text-4xl font-display font-bold text-[#e5e2e1] mb-2 tracking-tight">Access Control</h1>
            <p className="text-[#a38b88] text-sm">Every account on the platform — staff, event heads & delegates. Staff are managed here; the rest are read-only.</p>
          </div>
          <button 
            onClick={() => setShowAddModal(true)}
            className="btn-premium px-6 py-2.5 flex items-center gap-2 shadow-[0_0_15px_rgba(255,180,168,0.2)]"
          >
            <UserPlus size={18} />
            Add Account
          </button>
        </div>

        {/* Success toast */}
        {successMsg && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium animate-fade-up">
            {successMsg}
          </div>
        )}

        {/* Search */}
        <div className="relative mb-6">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#554240]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full pl-11 pr-10 py-3 rounded-xl bg-[#1c1b1b] border border-[#554240]/20 text-[#e5e2e1] text-sm focus:outline-none focus:border-[#ffb4a8]/40 placeholder-[#554240]"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#554240] hover:text-[#a38b88]" title="Clear">
              &times;
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center p-20">
             <div className="animate-spin w-8 h-8 flex border-2 border-indigo-500 border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="bg-[#1c1b1b] border border-[#554240]/15 rounded-2xl overflow-hidden">
             <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#2a2828] text-[#a38b88] border-b border-[#554240]/20 text-sm font-semibold">
                     <th className="p-5 font-display">Name</th>
                     <th className="p-5 font-display">Role</th>
                     <th className="p-5 font-display">Email</th>
                     <th className="p-5 font-display text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#554240]/15">
                   {staffList.filter((st) => {
                      const q = search.trim().toLowerCase();
                      if (!q) return true;
                      return st.name.toLowerCase().includes(q) || (st.email || '').toLowerCase().includes(q);
                   }).map((st) => (
                      <tr key={st.id} className="hover:bg-[#201f1f] transition group">
                         <td className="p-5">
                            <div className={`flex items-center gap-4 ${st.kind === 'staff' ? 'cursor-pointer' : ''}`} onClick={() => { if (st.kind === 'staff') loadAnalytics(st); }}>
                               <div className="w-10 h-10 bg-[#131313] border border-[#554240]/30 rounded-full flex items-center justify-center text-[#ffb4a8] font-bold">
                                  {st.name.charAt(0)}
                               </div>
                               <div>
                                  <span className="text-[#e5e2e1] font-semibold block">{st.name}</span>
                                  {st.kind === 'staff' && st.role === 'staff' && (
                                     st.restaurant_name
                                       ? <span className="text-[#a38b88] text-xs">{st.restaurant_name}</span>
                                       : <span className="text-[#ffb4ab] text-xs font-semibold">⚠ No restaurant assigned</span>
                                  )}
                                  {st.kind !== 'staff' && st.subtitle && (
                                     <span className="text-[#a38b88] text-xs">{st.subtitle}</span>
                                  )}
                               </div>
                            </div>
                         </td>
                         <td className="p-5">
                            <span className={`px-3 py-1 text-xs font-bold rounded-full ${
                               st.role === 'super_admin' ? 'bg-[#ffb4a8]/10 text-[#ffb4a8] border border-[#ffb4a8]/20' :
                               st.role === 'admin' ? 'bg-[#eac34a]/10 text-[#eac34a] border border-[#eac34a]/20' :
                               st.role === 'event_head' ? 'bg-[#7aa2f7]/10 text-[#7aa2f7] border border-[#7aa2f7]/20' :
                               st.role === 'delegate' ? 'bg-[#73d0a3]/10 text-[#73d0a3] border border-[#73d0a3]/20' :
                               'bg-[#554240]/30 text-[#a38b88]'
                            }`}>
                               {st.role.toUpperCase().replace(/_/g, ' ')}
                            </span>
                         </td>
                         <td className="p-5 text-[#a38b88] text-sm">
                            {st.email || 'No email'}
                         </td>
                         <td className="p-5 text-right">
                            {st.kind === 'staff' ? (
                              <div className="flex items-center justify-end gap-3">
                                 <button onClick={() => loadAnalytics(st)} className="text-[#ffb4a8] text-sm font-semibold hover:underline">View Log</button>
                                 <button
                                   onClick={(e) => { e.stopPropagation(); openEditModal(st); }}
                                   className="p-2 rounded-lg text-[#554240] hover:text-[#eac34a] hover:bg-[#eac34a]/10 opacity-0 group-hover:opacity-100 transition-all"
                                   title="Edit account"
                                 >
                                   <Pencil size={15} />
                                 </button>
                                 <button
                                   onClick={(e) => { e.stopPropagation(); openDeleteModal(st); }}
                                   className="p-2 rounded-lg text-[#554240] hover:text-[#ffb4ab] hover:bg-[#93000a]/15 opacity-0 group-hover:opacity-100 transition-all"
                                   title="Delete account"
                                 >
                                   <Trash2 size={15} />
                                 </button>
                              </div>
                            ) : (
                              <span className="text-[#554240] text-xs italic">
                                Managed in {st.kind === 'event_head' ? 'Event Heads' : 'University Staff'}
                              </span>
                            )}
                         </td>
                      </tr>
                   ))}
                </tbody>
             </table>
          </div>
        )}

        {/* ── Account Lockout Management ── */}
        <div className="mt-12">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#4c0000]/40 border border-[#f0513e]/20 rounded-xl flex items-center justify-center">
                <ShieldOff size={20} className="text-[#ffb4a8]" />
              </div>
              <div>
                <h2 className="text-xl font-display font-bold text-[#e5e2e1] tracking-tight">Account Lockout Management</h2>
                <p className="text-[#a38b88] text-xs mt-0.5">Accounts locked due to repeated failed login attempts</p>
              </div>
            </div>
            <button
              onClick={fetchLockedAccounts}
              disabled={lockedLoading}
              className="text-[#ffb4a8] text-sm font-semibold hover:text-[#e5e2e1] transition-colors disabled:opacity-50"
            >
              {lockedLoading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>

          {lockMessage && (
            <div className={`p-4 rounded-xl mb-4 text-sm font-medium ${
              lockMessage.type === 'success'
                ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                : 'bg-[#93000a]/20 border border-[#93000a]/50 text-[#ffb4ab]'
            }`}>
              {lockMessage.text}
            </div>
          )}

          {lockedLoading ? (
            <div className="flex justify-center p-10">
              <div className="animate-spin w-6 h-6 border-2 border-[#ffb4a8] border-t-transparent rounded-full" />
            </div>
          ) : lockedAccounts.length === 0 ? (
            <div className="bg-[#1c1b1b] border border-[#554240]/15 rounded-2xl p-8 text-center">
              <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center mx-auto mb-3">
                <Unlock size={22} className="text-emerald-400" />
              </div>
              <p className="text-[#a38b88] text-sm font-medium">No locked accounts</p>
              <p className="text-[#554240] text-xs mt-1">All accounts are currently accessible</p>
            </div>
          ) : (
            <div className="bg-[#1c1b1b] border border-[#554240]/15 rounded-2xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#2a2828] text-[#a38b88] border-b border-[#554240]/20 text-sm font-semibold">
                    <th className="p-4 font-display">Email</th>
                    <th className="p-4 font-display">Locked Until</th>
                    <th className="p-4 font-display">Time Remaining</th>
                    <th className="p-4 font-display text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#554240]/15">
                  {lockedAccounts.map((acc) => (
                    <tr key={acc.email} className="hover:bg-[#201f1f] transition">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-[#93000a]/20 rounded-full flex items-center justify-center">
                            <ShieldOff size={14} className="text-[#ffb4ab]" />
                          </div>
                          <span className="text-[#e5e2e1] text-sm font-semibold">{acc.email}</span>
                        </div>
                      </td>
                      <td className="p-4 text-[#a38b88] text-sm">
                        {new Date(acc.lockedUntil).toLocaleTimeString()}
                      </td>
                      <td className="p-4">
                        <span className="text-[#ffb4ab] text-sm font-semibold bg-[#93000a]/15 px-3 py-1 rounded-full">
                          {formatRemainingTime(acc.remainingSeconds)}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleUnlock(acc.email)}
                          disabled={unlockingEmail === acc.email}
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-semibold rounded-lg hover:bg-emerald-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Unlock size={14} />
                          {unlockingEmail === acc.email ? 'Unlocking...' : 'Unlock'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Analytics Slide Over Panel */}
      <div className={`fixed top-0 right-0 w-96 h-screen bg-[#131313] border-l border-[#554240]/20 shadow-2xl transform transition-transform duration-300 z-50 ${selectedStaff ? 'translate-x-0' : 'translate-x-full'}`}>
         {selectedStaff && (
           <div className="flex flex-col h-full">
              <div className="p-6 border-b border-[#554240]/20 flex justify-between items-center bg-[#1c1b1b]">
                 <div>
                    <h2 className="text-xl font-display font-bold text-[#e5e2e1]">{selectedStaff.name}</h2>
                    <p className="text-[#a38b88] text-xs uppercase tracking-widest mt-1">{selectedStaff.role.replace('_', ' ')}</p>
                 </div>
                 <button onClick={closeSidebar} className="text-[#a38b88] hover:text-[#ffb4a8] font-bold text-2xl">&times;</button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                 {analyticsLoading ? (
                    <div className="flex justify-center mt-20"><div className="animate-spin w-6 h-6 border-2 border-[#ffb4a8] border-t-transparent rounded-full" /></div>
                 ) : analytics ? (
                    <>
                       <div className="grid grid-cols-2 gap-4">
                          <div className="bg-[#1c1b1b] p-4 rounded-xl border border-[#554240]/15">
                             <p className="text-[#a38b88] text-xs font-semibold mb-1">Orders Handled</p>
                             <p className="text-2xl font-display font-bold text-[#e5e2e1]">{analytics.totalOrdersCompleted}</p>
                          </div>
                          <div className="bg-[#1c1b1b] p-4 rounded-xl border border-[#554240]/15">
                             <p className="text-[#a38b88] text-xs font-semibold mb-1">Refunds Proc.</p>
                             <p className="text-2xl font-display font-bold text-[#e5e2e1]">{analytics.totalRefundsHandled}</p>
                          </div>
                          <div className="bg-[#1c1b1b] p-4 rounded-xl border border-[#554240]/15 col-span-2 flex items-center gap-4">
                             <LogIn className="text-[#ffb4a8]" size={20} />
                             <div>
                               <p className="text-[#a38b88] text-xs font-semibold mb-0.5">Last Login</p>
                               <p className="text-sm font-display font-bold text-[#e5e2e1]">
                                 {analytics.lastLogin ? new Date(analytics.lastLogin).toLocaleString() : 'Never logged in'}
                               </p>
                             </div>
                          </div>
                       </div>

                       <div>
                          <h3 className="text-[#e5e2e1] font-display font-bold mb-4 flex items-center gap-2">
                             <Activity size={16} className="text-[#ffb4a8]" /> Recent Activity
                          </h3>
                          <div className="space-y-4 relative before:absolute before:inset-0 before:ml-2.5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-[#554240]/30 before:to-transparent">
                             {analytics.recentActivity.length === 0 ? (
                                <p className="text-[#a38b88] text-sm text-center py-10">No recent audit logs.</p>
                             ) : analytics.recentActivity.map((log, i) => (
                                <div key={i} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                                   <div className="flex items-center justify-center w-5 h-5 rounded-full border border-[#554240]/50 bg-[#1c1b1b] text-[#a38b88] shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                                     <div className="w-1.5 h-1.5 bg-[#ffb4a8] rounded-full"></div>
                                   </div>
                                   <div className="w-[calc(100%-2.5rem)] md:w-[calc(50%-1.25rem)] p-3 rounded-lg bg-[#1c1b1b] border border-[#554240]/15">
                                      <p className="text-[#e5e2e1] text-xs font-bold mb-1">{log.action}</p>
                                      <p className="text-[#a38b88] text-[10px] truncate">{log.resource}</p>
                                      <p className="text-[#554240] text-[9px] mt-1">{new Date(log.created_at).toLocaleString()}</p>
                                   </div>
                                </div>
                             ))}
                          </div>
                       </div>
                    </>
                 ) : null}
              </div>
           </div>
         )}
      </div>

      {/* ── Add Account Modal ── */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <form className="bg-[#1c1b1b] border border-[#554240]/20 w-full max-w-md rounded-2xl p-8" onSubmit={handleAddStaff}>
            <h2 className="text-xl font-display font-bold text-[#e5e2e1] mb-6">Create Account</h2>
            {modalError && <p className="text-[#ffb4a8] bg-[#4c0000]/30 p-3 rounded-lg text-sm mb-4">{modalError}</p>}
            
            <div className="space-y-4">
               <div>
                  <label className="text-[#a38b88] text-xs font-bold mb-1 block">Full Name <span className="text-[#f0513e]">*</span></label>
                  <input required type="text" value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} className="w-full bg-[#131313] border border-[#554240]/30 text-[#e5e2e1] rounded-lg p-3 text-sm focus:outline-none focus:border-[#ffb4a8]" placeholder="John Doe" />
               </div>
               <div>
                  <label className="text-[#a38b88] text-xs font-bold mb-1 block">Email <span className="text-[#f0513e]">*</span></label>
                  <input required type="email" value={formData.email} onChange={e=>setFormData({...formData, email: e.target.value})} className="w-full bg-[#131313] border border-[#554240]/30 text-[#e5e2e1] rounded-lg p-3 text-sm focus:outline-none focus:border-[#ffb4a8]" placeholder="staff@university.edu" />
               </div>
               <div>
                  <label className="text-[#a38b88] text-xs font-bold mb-1 block">Password <span className="text-[#f0513e]">*</span></label>
                  <div className="relative">
                    <input required minLength={8} type={showModalPassword ? 'text' : 'password'} value={formData.password} onChange={e=>setFormData({...formData, password: e.target.value})} className="w-full bg-[#131313] border border-[#554240]/30 text-[#e5e2e1] rounded-lg p-3 pr-11 text-sm focus:outline-none focus:border-[#ffb4a8]" placeholder="Min 8 chars, 1 uppercase, 1 number" />
                    <button type="button" onClick={() => setShowModalPassword(!showModalPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#554240] hover:text-[#a38b88] transition-colors" tabIndex={-1}>
                      {showModalPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <p className="text-[11px] text-[#a38b88] mt-1.5">{PASSWORD_RULE}</p>
               </div>
               <div>
                  <label className="text-[#a38b88] text-xs font-bold mb-1 block">Role <span className="text-[#f0513e]">*</span></label>
                  <select required value={formData.role} onChange={e=>setFormData({...formData, role: e.target.value})} className="w-full bg-[#131313] border border-[#554240]/30 text-[#e5e2e1] rounded-lg p-3 text-sm focus:outline-none focus:border-[#ffb4a8]">
                     <option value="staff">Staff (Kitchen/Scanner)</option>
                     <option value="admin">Admin (Manager)</option>
                     <option value="super_admin">Super Admin (Global Head)</option>
                  </select>
               </div>
               {formData.role === 'staff' && (
                 <div>
                    <label className="text-[#a38b88] text-xs font-bold mb-1 block">Restaurant <span className="text-[#f0513e]">*</span></label>
                    <select required value={formData.restaurant_id} onChange={e=>setFormData({...formData, restaurant_id: e.target.value})} className="w-full bg-[#131313] border border-[#554240]/30 text-[#e5e2e1] rounded-lg p-3 text-sm focus:outline-none focus:border-[#ffb4a8]">
                       <option value="">Select a restaurant…</option>
                       {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                    <p className="text-[#554240] text-[11px] mt-1">Staff only see orders for their assigned restaurant.</p>
                 </div>
               )}
            </div>

            <div className="flex gap-4 mt-8">
               <button type="button" onClick={()=>setShowAddModal(false)} className="flex-1 py-3 text-[#a38b88] hover:text-[#e5e2e1] font-semibold text-sm transition">Cancel</button>
               <button type="submit" disabled={modalLoading} className="flex-1 bg-[#ffb4a8] text-[#410000] py-3 rounded-lg font-bold text-sm shadow-[0_0_15px_rgba(255,180,168,0.2)] disabled:opacity-50">{modalLoading ? 'Creating...' : 'Create Account'}</button>
            </div>
          </form>
        </div>
      )}

      {/* ── Edit Account Modal ── */}
      {editTarget && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setEditTarget(null)}>
          <form className="bg-[#1c1b1b] border border-[#554240]/20 w-full max-w-md rounded-2xl p-8" onClick={(e) => e.stopPropagation()} onSubmit={handleEditStaff}>
            <h2 className="text-xl font-display font-bold text-[#e5e2e1] mb-6 flex items-center gap-2">
              <Pencil size={18} className="text-[#eac34a]" /> Edit Account
            </h2>
            {editError && <p className="text-[#ffb4a8] bg-[#4c0000]/30 p-3 rounded-lg text-sm mb-4">{editError}</p>}

            <div className="space-y-4">
              <div>
                <label className="text-[#a38b88] text-xs font-bold mb-1 block">Full Name <span className="text-[#f0513e]">*</span></label>
                <input required type="text" value={editData.name} onChange={e => setEditData({ ...editData, name: e.target.value })} className="w-full bg-[#131313] border border-[#554240]/30 text-[#e5e2e1] rounded-lg p-3 text-sm focus:outline-none focus:border-[#eac34a]" />
              </div>
              <div>
                <label className="text-[#a38b88] text-xs font-bold mb-1 block">Email <span className="text-[#f0513e]">*</span></label>
                <input required type="email" value={editData.email} onChange={e => setEditData({ ...editData, email: e.target.value })} className="w-full bg-[#131313] border border-[#554240]/30 text-[#e5e2e1] rounded-lg p-3 text-sm focus:outline-none focus:border-[#eac34a]" />
              </div>
              <div>
                <label className="text-[#a38b88] text-xs font-bold mb-1 block">New Password <span className="text-[#554240] font-medium normal-case">(leave blank to keep current)</span></label>
                <div className="relative">
                  <input minLength={8} type={showEditPassword ? 'text' : 'password'} value={editData.password} onChange={e => setEditData({ ...editData, password: e.target.value })} className="w-full bg-[#131313] border border-[#554240]/30 text-[#e5e2e1] rounded-lg p-3 pr-11 text-sm focus:outline-none focus:border-[#eac34a]" placeholder="••••••••" />
                  <button type="button" onClick={() => setShowEditPassword(!showEditPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#554240] hover:text-[#a38b88] transition-colors" tabIndex={-1}>
                    {showEditPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <p className="text-[11px] text-[#a38b88] mt-1.5">{PASSWORD_RULE}</p>
              </div>
              <div>
                <label className="text-[#a38b88] text-xs font-bold mb-1 block">Role <span className="text-[#f0513e]">*</span></label>
                <select required value={editData.role} onChange={e => setEditData({ ...editData, role: e.target.value })} className="w-full bg-[#131313] border border-[#554240]/30 text-[#e5e2e1] rounded-lg p-3 text-sm focus:outline-none focus:border-[#eac34a]">
                  <option value="staff">Staff (Kitchen/Scanner)</option>
                  <option value="admin">Admin (Manager)</option>
                  <option value="super_admin">Super Admin (Global Head)</option>
                </select>
              </div>
              {editData.role === 'staff' && (
                <div>
                  <label className="text-[#a38b88] text-xs font-bold mb-1 block">Restaurant <span className="text-[#f0513e]">*</span></label>
                  <select required value={editData.restaurant_id} onChange={e => setEditData({ ...editData, restaurant_id: e.target.value })} className="w-full bg-[#131313] border border-[#554240]/30 text-[#e5e2e1] rounded-lg p-3 text-sm focus:outline-none focus:border-[#eac34a]">
                    <option value="">Select a restaurant…</option>
                    {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                  <p className="text-[#554240] text-[11px] mt-1">Staff only see orders for their assigned restaurant.</p>
                </div>
              )}
            </div>

            <div className="flex gap-4 mt-8">
              <button type="button" onClick={() => setEditTarget(null)} className="flex-1 py-3 text-[#a38b88] hover:text-[#e5e2e1] font-semibold text-sm transition">Cancel</button>
              <button type="submit" disabled={editLoading} className="flex-1 bg-[#eac34a] text-[#2a1e00] py-3 rounded-lg font-bold text-sm shadow-[0_0_15px_rgba(234,195,74,0.2)] disabled:opacity-50">{editLoading ? 'Saving...' : 'Save Changes'}</button>
            </div>
          </form>
        </div>
      )}

      {/* ── Delete Confirmation Modal (Two-Step) ── */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1c1b1b] border border-[#554240]/20 w-full max-w-md rounded-2xl p-8 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-[#93000a]/20 rounded-xl flex items-center justify-center shrink-0">
                <AlertTriangle size={22} className="text-[#ffb4ab]" />
              </div>
              <div>
                <h2 className="text-lg font-display font-bold text-[#e5e2e1]">
                  {deleteConfirmed ? 'Are you absolutely sure?' : 'Delete Account'}
                </h2>
                <p className="text-[#a38b88] text-xs mt-0.5">
                  {deleteConfirmed ? 'This action is permanent and cannot be undone.' : 'This will permanently remove the account.'}
                </p>
              </div>
            </div>

            <div className="bg-[#131313] border border-[#554240]/20 rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-[#a38b88]">Name</span>
                <span className="text-[#e5e2e1] font-semibold">{deleteTarget.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#a38b88]">Email</span>
                <span className="text-[#e5e2e1] font-semibold">{deleteTarget.email || '—'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#a38b88]">Role</span>
                <span className="text-[#e5e2e1] font-semibold">{deleteTarget.role.toUpperCase().replace('_', ' ')}</span>
              </div>
            </div>

            {deleteConfirmed && (
              <div className="p-3 rounded-xl bg-[#93000a]/15 border border-[#93000a]/30 text-[#ffb4ab] text-sm font-medium flex items-start gap-2">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <span>All associated data, audit logs references, and login sessions for <strong>{deleteTarget.name}</strong> will be permanently lost.</span>
              </div>
            )}

            {deleteError && (
              <p className="text-[#ffb4a8] bg-[#4c0000]/30 p-3 rounded-lg text-sm">{deleteError}</p>
            )}

            <div className="flex gap-4 pt-2">
              <button
                type="button"
                onClick={() => { setDeleteTarget(null); setDeleteConfirmed(false); setDeleteError(''); }}
                className="flex-1 py-3 text-[#a38b88] hover:text-[#e5e2e1] font-semibold text-sm transition rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteLoading}
                className={`flex-1 py-3 rounded-lg font-bold text-sm transition disabled:opacity-50 flex items-center justify-center gap-2 ${
                  deleteConfirmed
                    ? 'bg-[#93000a] text-white hover:bg-[#b31217]'
                    : 'bg-[#93000a]/20 text-[#ffb4ab] border border-[#93000a]/30 hover:bg-[#93000a]/40'
                }`}
              >
                <Trash2 size={14} />
                {deleteLoading ? 'Deleting...' : deleteConfirmed ? 'Yes, Delete Permanently' : 'Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
