import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useRestaurant } from '../context/RestaurantContext';
import api from '../services/api';
import { UserPlus, Shield, Trash2, Lock, Eye, EyeOff, Users, Mail, KeyRound, Send, Store, Pencil } from 'lucide-react';

// Mirrors the backend passwordSchema (validators.ts). The API enforces these on
// staff creation (/admin/staff) and password change (/admin/password/verify-and-change),
// so we validate here to give an immediate, specific message instead of a 400 round-trip.
const PASSWORD_RULE = 'At least 8 characters, with 1 uppercase letter and 1 number.';
function passwordRuleError(pw: string): string | null {
  if (pw.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Z]/.test(pw)) return 'Password must contain at least one uppercase letter.';
  if (!/[0-9]/.test(pw)) return 'Password must contain at least one number.';
  return null;
}

interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: string;
  restaurant_id?: string | null;
  restaurant_name?: string | null;
  created_at: string;
}

export default function Settings() {
  const { user } = useAuth();
  const { restaurants } = useRestaurant();

  // ── Staff state ──
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [staffLoading, setStaffLoading] = useState(true);
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [newStaff, setNewStaff] = useState({ name: '', email: '', password: '', role: 'staff', restaurant_id: '' });
  const [staffSaving, setStaffSaving] = useState(false);
  const [staffError, setStaffError] = useState('');
  const [staffSuccess, setStaffSuccess] = useState('');

  // ── Edit staff state ──
  const [editStaff, setEditStaff] = useState<StaffMember | null>(null);
  const [editData, setEditData] = useState({ name: '', email: '', password: '', role: 'staff', restaurant_id: '' });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [showEditPw, setShowEditPw] = useState(false);

  // ── Password state (OTP-based) ──
  const [otpSent, setOtpSent] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const fetchStaff = useCallback(async () => {
    if (!user?.university_id) return;
    try { const res = await api.get(`/admin/staff/${user.university_id}`); setStaffList(res.data); }
    catch (err) { console.error(err); }
    finally { setStaffLoading(false); }
  }, [user?.university_id]);

  useEffect(() => { fetchStaff(); }, [fetchStaff]);

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    const pwErr = passwordRuleError(newStaff.password);
    if (pwErr) { setStaffError(pwErr); return; }
    setStaffSaving(true); setStaffError(''); setStaffSuccess('');
    try {
      const payload: any = { ...newStaff, university_id: user?.university_id };
      if (newStaff.role !== 'staff') delete payload.restaurant_id;
      await api.post('/admin/staff', payload);
      setStaffSuccess('Staff member added successfully!');
      setNewStaff({ name: '', email: '', password: '', role: 'staff', restaurant_id: '' });
      setShowAddStaff(false);
      fetchStaff();
    }
    catch (err: any) { setStaffError(err.response?.data?.message || 'Failed to add staff'); }
    finally { setStaffSaving(false); }
  };

  const openEditStaff = (s: StaffMember) => {
    setEditStaff(s);
    setEditData({ name: s.name, email: s.email || '', password: '', role: s.role, restaurant_id: s.restaurant_id || '' });
    setEditError('');
    setShowEditPw(false);
  };

  const handleUpdateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editStaff) return;
    setEditSaving(true); setEditError(''); setStaffSuccess('');
    try {
      const payload: any = {
        name: editData.name.trim(),
        email: editData.email.trim(),
        role: editData.role,
        restaurant_id: editData.role === 'staff' ? editData.restaurant_id : '',
      };
      if (editData.password) payload.password = editData.password;
      await api.put(`/admin/staff/${editStaff.id}`, payload);
      setStaffSuccess('Staff account updated successfully!');
      setEditStaff(null);
      fetchStaff();
    }
    catch (err: any) { setEditError(err.response?.data?.message || 'Failed to update staff'); }
    finally { setEditSaving(false); }
  };

  const handleDeleteStaff = async (id: string, staffName: string) => {
    if (!confirm(`Are you sure you want to remove ${staffName}?`)) return;
    try { await api.delete(`/admin/staff/${id}`); setStaffSuccess(`${staffName} has been removed.`); fetchStaff(); }
    catch (err: any) { setStaffError(err.response?.data?.message || 'Failed to remove staff'); }
  };

  const handleRequestOtp = async () => {
    setOtpSending(true); setPwError(''); setPwSuccess('');
    try { const res = await api.post('/admin/password/request-otp'); setMaskedEmail(res.data.email); setOtpSent(true); setCooldown(60); }
    catch (err: any) { setPwError(err.response?.data?.message || 'Failed to send OTP'); }
    finally { setOtpSending(false); }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault(); setPwError(''); setPwSuccess('');
    const pwErr = passwordRuleError(newPassword);
    if (pwErr) { setPwError(pwErr); return; }
    if (newPassword !== confirmPassword) { setPwError('Passwords do not match'); return; }
    if (!otpCode || otpCode.length !== 6) { setPwError('Please enter the 6-digit OTP'); return; }
    setPwSaving(true);
    try { await api.post('/admin/password/verify-and-change', { otp: otpCode, current_password: currentPassword, new_password: newPassword }); setPwSuccess('Password changed successfully!'); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setOtpCode(''); setOtpSent(false); }
    catch (err: any) { setPwError(err.response?.data?.message || 'Password change failed'); }
    finally { setPwSaving(false); }
  };

  const inputClass = "w-full px-4 py-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-white text-[14px] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all placeholder-slate-600";
  const labelClass = "text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5";

  const ROLE_BADGES: Record<string, string> = {
    staff: 'bg-blue-500/8 text-blue-400 border-blue-500/12',
    admin: 'bg-indigo-500/8 text-indigo-400 border-indigo-500/12',
    super_admin: 'bg-purple-500/8 text-purple-400 border-purple-500/12',
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8 animate-fade-in">
      {/* ── Header ── */}
      <div className="animate-fade-up">
        <h1 className="text-[28px] font-extrabold text-white tracking-[-0.03em]">Settings</h1>
        <p className="text-slate-500 text-[14px] font-medium mt-1">Manage your team members and account security</p>
      </div>

      {/* ═══ SECTION 1: Staff Accounts ═══ */}
      <div className="bg-white/[0.02] border border-white/[0.04] rounded-3xl p-8 hover-lift animate-fade-up" style={{ animationDelay: '100ms' }}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-[16px] font-bold text-white flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/8 text-blue-400 border border-blue-500/12"><Users size={16} /></div>
            Canteen Staff Accounts
          </h2>
          <button onClick={() => { setShowAddStaff(!showAddStaff); setStaffError(''); setStaffSuccess(''); }}
            className="px-4 py-2 rounded-xl bg-indigo-500/8 border border-indigo-500/12 text-indigo-400 text-[12px] font-bold hover:bg-indigo-500/15 transition-all btn-press flex items-center gap-2">
            <UserPlus size={13} /> Add Staff
          </button>
        </div>
        {staffError && <div className="mb-4 p-3.5 rounded-2xl bg-red-500/6 border border-red-500/12 text-red-400 text-[13px] animate-scale-in">{staffError}</div>}
        {staffSuccess && <div className="mb-4 p-3.5 rounded-2xl bg-emerald-500/6 border border-emerald-500/12 text-emerald-400 text-[13px] animate-scale-in">{staffSuccess}</div>}

        {showAddStaff && (
          <div className="mb-6 p-6 rounded-2xl bg-white/[0.02] border border-white/[0.04] space-y-4 animate-scale-in">
            <h3 className="text-white font-bold text-[13px]">Create New Staff Account</h3>
            <form onSubmit={handleAddStaff} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className={labelClass}>Full Name</label>
                  <input type="text" value={newStaff.name} onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })} required placeholder="John Doe" className={inputClass} /></div>
                <div><label className={labelClass}><Mail size={10} /> Email</label>
                  <input type="email" value={newStaff.email} onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })} required placeholder="staff@university.edu" className={inputClass} /></div>
                <div><label className={labelClass}><KeyRound size={10} /> Password</label>
                  <input type="password" value={newStaff.password} onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })} required placeholder="Min 8 chars, 1 uppercase, 1 number" minLength={8} className={inputClass} />
                  <p className="text-[11px] text-slate-600 mt-1.5">{PASSWORD_RULE}</p></div>
                <div><label className={labelClass}><Shield size={10} /> Role</label>
                  <select value={newStaff.role} onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value })} className={`${inputClass} appearance-none`}>
                    <option value="staff" className="bg-[#0c0f18]">Staff</option><option value="admin" className="bg-[#0c0f18]">Admin</option>
                  </select></div>
                {newStaff.role === 'staff' && (
                  <div><label className={labelClass}><Store size={10} className="text-emerald-400" /> Assigned Restaurant</label>
                    <select
                      value={newStaff.restaurant_id}
                      onChange={(e) => setNewStaff({ ...newStaff, restaurant_id: e.target.value })}
                      required
                      className={`${inputClass} appearance-none`}
                    >
                      <option value="" className="bg-[#0c0f18]">Select restaurant…</option>
                      {restaurants.map((r) => (
                        <option key={r.id} value={r.id} className="bg-[#0c0f18]">{r.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2.5 pt-2">
                <button type="button" onClick={() => setShowAddStaff(false)} className="px-5 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-slate-400 text-[12px] font-bold hover:bg-white/[0.06] transition-all btn-press">Cancel</button>
                <button type="submit" disabled={staffSaving} className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-[12px] font-bold hover:shadow-lg hover:shadow-indigo-500/20 transition-all disabled:opacity-50 btn-press flex items-center gap-2">
                  {staffSaving ? <><div className="animate-spin w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full" /> Creating...</> : <><UserPlus size={13} /> Create Account</>}
                </button>
              </div>
            </form>
          </div>
        )}

        {staffLoading ? (
          <div className="flex justify-center py-8"><div className="animate-spin w-5 h-5 border-2 border-indigo-500/40 border-t-indigo-500 rounded-full" /></div>
        ) : staffList.filter(s => s.role === 'staff').length === 0 ? (
          <div className="text-center py-12"><Users size={36} className="text-slate-800 mx-auto mb-3" /><p className="text-slate-600 text-[13px]">No staff accounts found.</p></div>
        ) : (
          <div className="space-y-2 stagger-children">
            {staffList.filter(s => s.role === 'staff').map((s) => (
              <div key={s.id} className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.01] border border-white/[0.03] hover:bg-white/[0.04] hover:border-white/[0.08] transition-all duration-200 group">
                <div className="w-9 h-9 rounded-xl bg-white/[0.04] flex items-center justify-center shrink-0">
                  <span className="text-white font-bold text-[12px]">{s.name.charAt(0).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-[13px] font-bold truncate">{s.name}</p>
                  <p className="text-slate-600 text-[11px] truncate">{s.email}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold tracking-widest uppercase border ${ROLE_BADGES[s.role] || 'bg-white/[0.04] text-slate-400 border-white/[0.06]'}`}>
                  {s.role.replace('_', ' ')}
                </span>
                {s.restaurant_name && (
                  <span className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-emerald-500/8 text-emerald-400 border border-emerald-500/12 flex items-center gap-1">
                    <Store size={9} /> {s.restaurant_name}
                  </span>
                )}
                <span className="text-slate-700 text-[10px] font-medium hidden md:block">
                  {new Date(s.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
                <button onClick={() => openEditStaff(s)}
                  className="p-2 rounded-xl text-slate-700 hover:text-indigo-400 hover:bg-indigo-500/8 opacity-0 group-hover:opacity-100 transition-all btn-press" title="Edit">
                  <Pencil size={14} />
                </button>
                {s.id !== user?.id && (
                  <button onClick={() => handleDeleteStaff(s.id, s.name)}
                    className="p-2 rounded-xl text-slate-700 hover:text-red-400 hover:bg-red-500/8 opacity-0 group-hover:opacity-100 transition-all btn-press" title="Remove">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ═══ SECTION 2: OTP Password Change ═══ */}
      <div className="bg-white/[0.02] border border-white/[0.04] rounded-3xl p-8 hover-lift animate-fade-up" style={{ animationDelay: '200ms' }}>
        <h2 className="text-[16px] font-bold text-white mb-2 flex items-center gap-3">
          <div className="p-2 rounded-xl bg-amber-500/8 text-amber-400 border border-amber-500/12"><Lock size={16} /></div>
          Change Password
        </h2>
        <p className="text-slate-600 text-[12px] mb-6">Requires email OTP verification for security.</p>

        {pwError && <div className="mb-4 p-3.5 rounded-2xl bg-red-500/6 border border-red-500/12 text-red-400 text-[13px] animate-scale-in">{pwError}</div>}
        {pwSuccess && <div className="mb-4 p-3.5 rounded-2xl bg-emerald-500/6 border border-emerald-500/12 text-emerald-400 text-[13px] animate-scale-in">{pwSuccess}</div>}

        {!otpSent ? (
          <div className="max-w-lg space-y-4">
            <p className="text-slate-400 text-[13px] leading-relaxed">
              To change your password, we'll send a 6-digit verification code to your registered email address.
            </p>
            <button onClick={handleRequestOtp} disabled={otpSending}
              className="px-6 py-3 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-[13px] font-bold hover:shadow-lg hover:shadow-indigo-500/20 transition-all disabled:opacity-50 btn-press flex items-center gap-2">
              {otpSending ? <><div className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" /> Sending OTP...</> : <><Send size={14} /> Send Verification Code</>}
            </button>
          </div>
        ) : (
          <form onSubmit={handlePasswordChange} className="space-y-5 max-w-lg">
            <div className="p-4 rounded-2xl bg-indigo-500/4 border border-indigo-500/10 space-y-2">
              <p className="text-indigo-400 text-[13px] font-bold">OTP sent to {maskedEmail}</p>
              <p className="text-slate-500 text-[11px]">Enter the 6-digit code below. Expires in 10 minutes.</p>
              <button type="button" onClick={handleRequestOtp} disabled={cooldown > 0 || otpSending}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 disabled:text-slate-700 font-bold transition-colors btn-press">
                {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend OTP'}
              </button>
            </div>
            <div><label className={labelClass}><Mail size={11} className="text-indigo-400" /> Verification Code</label>
              <input type="text" value={otpCode} onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))} required placeholder="000000" maxLength={6}
                className="w-full px-4 py-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-white text-center text-[24px] font-mono tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 placeholder-slate-700" /></div>
            <div><label className={labelClass}>Current Password</label>
              <div className="relative"><input type={showCurrentPw ? 'text' : 'password'} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required placeholder="Enter current password" className={`${inputClass} pr-11`} />
                <button type="button" onClick={() => setShowCurrentPw(!showCurrentPw)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-300 transition-colors">{showCurrentPw ? <EyeOff size={15} /> : <Eye size={15} />}</button></div></div>
            <div><label className={labelClass}>New Password</label>
              <div className="relative"><input type={showNewPw ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required placeholder="Min 8 chars, 1 uppercase, 1 number" minLength={8} className={`${inputClass} pr-11`} />
                <button type="button" onClick={() => setShowNewPw(!showNewPw)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-300 transition-colors">{showNewPw ? <EyeOff size={15} /> : <Eye size={15} />}</button></div>
              <p className="text-[11px] text-slate-600 mt-1.5">{PASSWORD_RULE}</p></div>
            <div><label className={labelClass}>Confirm New Password</label>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required placeholder="Re-enter new password" className={inputClass} /></div>
            <div className="flex justify-end pt-2">
              <button type="submit" disabled={pwSaving} className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-[13px] font-bold hover:shadow-lg hover:shadow-indigo-500/20 transition-all disabled:opacity-50 btn-press flex items-center gap-2">
                {pwSaving ? <><div className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" /> Updating...</> : <><Lock size={14} /> Update Password</>}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* ═══ Edit Staff Modal ═══ */}
      {editStaff && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setEditStaff(null)}>
          <form onSubmit={handleUpdateStaff} onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-3xl bg-[#0c0f18] border border-white/[0.08] p-8 space-y-5 animate-scale-in">
            <h3 className="text-white font-bold text-[16px] flex items-center gap-3">
              <div className="p-2 rounded-xl bg-indigo-500/8 text-indigo-400 border border-indigo-500/12"><Pencil size={15} /></div>
              Edit Staff Account
            </h3>
            {editError && <div className="p-3.5 rounded-2xl bg-red-500/6 border border-red-500/12 text-red-400 text-[13px]">{editError}</div>}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className={labelClass}>Full Name</label>
                <input type="text" value={editData.name} onChange={(e) => setEditData({ ...editData, name: e.target.value })} required className={inputClass} /></div>
              <div><label className={labelClass}><Mail size={10} /> Email</label>
                <input type="email" value={editData.email} onChange={(e) => setEditData({ ...editData, email: e.target.value })} required className={inputClass} /></div>
              <div><label className={labelClass}><KeyRound size={10} /> New Password <span className="text-slate-700 normal-case font-medium">(optional)</span></label>
                <div className="relative">
                  <input type={showEditPw ? 'text' : 'password'} value={editData.password} onChange={(e) => setEditData({ ...editData, password: e.target.value })} placeholder="Leave blank to keep current" minLength={8} className={`${inputClass} pr-11`} />
                  <button type="button" onClick={() => setShowEditPw(!showEditPw)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-300 transition-colors" tabIndex={-1}>{showEditPw ? <EyeOff size={15} /> : <Eye size={15} />}</button>
                </div></div>
              <div><label className={labelClass}><Shield size={10} /> Role</label>
                <select value={editData.role} onChange={(e) => setEditData({ ...editData, role: e.target.value })} className={`${inputClass} appearance-none`} disabled={editStaff.id === user?.id}>
                  <option value="staff" className="bg-[#0c0f18]">Staff</option><option value="admin" className="bg-[#0c0f18]">Admin</option>
                </select></div>
              {editData.role === 'staff' && (
                <div className="md:col-span-2"><label className={labelClass}><Store size={10} className="text-emerald-400" /> Assigned Restaurant</label>
                  <select value={editData.restaurant_id} onChange={(e) => setEditData({ ...editData, restaurant_id: e.target.value })} required className={`${inputClass} appearance-none`}>
                    <option value="" className="bg-[#0c0f18]">Select restaurant…</option>
                    {restaurants.map((r) => (<option key={r.id} value={r.id} className="bg-[#0c0f18]">{r.name}</option>))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button type="button" onClick={() => setEditStaff(null)} className="px-5 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-slate-400 text-[12px] font-bold hover:bg-white/[0.06] transition-all btn-press">Cancel</button>
              <button type="submit" disabled={editSaving} className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-[12px] font-bold hover:shadow-lg hover:shadow-indigo-500/20 transition-all disabled:opacity-50 btn-press flex items-center gap-2">
                {editSaving ? <><div className="animate-spin w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full" /> Saving...</> : <><Pencil size={13} /> Save Changes</>}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
