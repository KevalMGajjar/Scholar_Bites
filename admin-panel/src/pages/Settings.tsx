import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { Camera, Building2, MapPin, UserPlus, Shield, Trash2, Lock, Eye, EyeOff, Users, Mail, KeyRound, Send } from 'lucide-react';

interface University {
  id: string;
  name: string;
  address: string;
  logo_url: string;
}

interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: string;
  created_at: string;
}

export default function Settings() {
  const { user } = useAuth();

  // ── University state ──
  const [university, setUniversity] = useState<University | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uniSuccess, setUniSuccess] = useState('');
  const [uniError, setUniError] = useState('');

  // ── Staff state ──
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [staffLoading, setStaffLoading] = useState(true);
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [newStaff, setNewStaff] = useState({ name: '', email: '', password: '', role: 'staff' });
  const [staffSaving, setStaffSaving] = useState(false);
  const [staffError, setStaffError] = useState('');
  const [staffSuccess, setStaffSuccess] = useState('');

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

  const fetchUniversity = useCallback(async () => {
    if (!user?.university_id) return;
    try { const res = await api.get(`/university/${user.university_id}`); setUniversity(res.data); setName(res.data.name); setAddress(res.data.address || ''); setLogoPreview(res.data.logo_url || null); }
    catch (err) { console.error(err); setUniError('Failed to load university'); }
    finally { setLoading(false); }
  }, [user?.university_id]);

  const fetchStaff = useCallback(async () => {
    if (!user?.university_id) return;
    try { const res = await api.get(`/admin/staff/${user.university_id}`); setStaffList(res.data); }
    catch (err) { console.error(err); }
    finally { setStaffLoading(false); }
  }, [user?.university_id]);

  useEffect(() => { fetchUniversity(); fetchStaff(); }, [fetchUniversity, fetchStaff]);

  const handleUniSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.university_id) return;
    setSaving(true); setUniError(''); setUniSuccess('');
    const fd = new FormData(); fd.append('name', name); fd.append('address', address);
    if (logoFile) fd.append('logo', logoFile);
    try { await api.patch(`/university/${user.university_id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }); setUniSuccess('University updated successfully!'); setLogoFile(null); fetchUniversity(); }
    catch (err: any) { setUniError(err.response?.data?.message || 'Update failed'); }
    finally { setSaving(false); }
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setStaffSaving(true); setStaffError(''); setStaffSuccess('');
    try { await api.post('/admin/staff', { ...newStaff, university_id: user?.university_id }); setStaffSuccess('Staff member added successfully!'); setNewStaff({ name: '', email: '', password: '', role: 'staff' }); setShowAddStaff(false); fetchStaff(); }
    catch (err: any) { setStaffError(err.response?.data?.message || 'Failed to add staff'); }
    finally { setStaffSaving(false); }
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
    if (newPassword.length < 8) { setPwError('New password must be at least 8 characters'); return; }
    if (newPassword !== confirmPassword) { setPwError('Passwords do not match'); return; }
    if (!otpCode || otpCode.length !== 6) { setPwError('Please enter the 6-digit OTP'); return; }
    setPwSaving(true);
    try { await api.post('/admin/password/verify-and-change', { otp: otpCode, current_password: currentPassword, new_password: newPassword }); setPwSuccess('Password changed successfully!'); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setOtpCode(''); setOtpSent(false); }
    catch (err: any) { setPwError(err.response?.data?.message || 'Password change failed'); }
    finally { setPwSaving(false); }
  };

  const inputClass = "w-full px-4 py-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-white text-[14px] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all placeholder-slate-600";
  const labelClass = "text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5";

  if (loading) {
    return <div className="flex justify-center items-center h-full min-h-screen"><div className="animate-spin w-6 h-6 border-2 border-indigo-500/40 border-t-indigo-500 rounded-full" /></div>;
  }

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
        <p className="text-slate-500 text-[14px] font-medium mt-1">Manage university profile, team members, and security</p>
      </div>

      {/* ═══ SECTION 1: University Profile ═══ */}
      {university && (
        <div className="bg-white/[0.02] border border-white/[0.04] rounded-3xl p-8 hover-lift animate-fade-up" style={{ animationDelay: '100ms' }}>
          <h2 className="text-[16px] font-bold text-white mb-6 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/8 text-indigo-400 border border-indigo-500/12"><Building2 size={16} /></div>
            University Profile
          </h2>
          {uniError && <div className="mb-4 p-3.5 rounded-2xl bg-red-500/6 border border-red-500/12 text-red-400 text-[13px] animate-scale-in">{uniError}</div>}
          {uniSuccess && <div className="mb-4 p-3.5 rounded-2xl bg-emerald-500/6 border border-emerald-500/12 text-emerald-400 text-[13px] animate-scale-in">{uniSuccess}</div>}
          <form onSubmit={handleUniSubmit} className="space-y-6">
            <div className="flex items-start gap-6 pb-6 border-b border-white/[0.04]">
              <div className="relative group shrink-0">
                <div className="w-20 h-20 rounded-2xl bg-white/[0.03] border-2 border-white/[0.06] overflow-hidden flex items-center justify-center">
                  {logoPreview ? <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" /> : <Building2 size={28} className="text-slate-700" />}
                </div>
                <label className="absolute inset-0 bg-black/60 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center cursor-pointer rounded-2xl">
                  <Camera size={16} className="text-white mb-0.5" /><span className="text-white text-[10px] font-bold">Change</span>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setLogoFile(f); setLogoPreview(URL.createObjectURL(f)); } }} />
                </label>
              </div>
              <div className="flex-1 mt-1">
                <h3 className="text-white font-bold text-[13px]">University Logo</h3>
                <p className="text-slate-600 text-[11px] mt-1">Square PNG or JPG, at least 500×500px.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div><label className={labelClass}><Building2 size={11} className="text-indigo-400" /> Name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className={inputClass} /></div>
              <div><label className={labelClass}><MapPin size={11} className="text-indigo-400" /> Address</label>
                <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className={inputClass} /></div>
            </div>
            <div className="flex justify-end">
              <button type="submit" disabled={saving} className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-[13px] font-bold hover:shadow-lg hover:shadow-indigo-500/20 transition-all disabled:opacity-50 btn-press flex items-center gap-2">
                {saving ? <><div className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" /> Saving...</> : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ═══ SECTION 2: Staff Accounts ═══ */}
      <div className="bg-white/[0.02] border border-white/[0.04] rounded-3xl p-8 hover-lift animate-fade-up" style={{ animationDelay: '200ms' }}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-[16px] font-bold text-white flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/8 text-blue-400 border border-blue-500/12"><Users size={16} /></div>
            Staff Accounts
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
                  <input type="password" value={newStaff.password} onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })} required placeholder="Min 8 characters" minLength={8} className={inputClass} /></div>
                <div><label className={labelClass}><Shield size={10} /> Role</label>
                  <select value={newStaff.role} onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value })} className={`${inputClass} appearance-none`}>
                    <option value="staff" className="bg-[#0c0f18]">Staff</option><option value="admin" className="bg-[#0c0f18]">Admin</option>
                  </select></div>
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
                <span className="text-slate-700 text-[10px] font-medium hidden md:block">
                  {new Date(s.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
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

      {/* ═══ SECTION 3: OTP Password Change ═══ */}
      <div className="bg-white/[0.02] border border-white/[0.04] rounded-3xl p-8 hover-lift animate-fade-up" style={{ animationDelay: '300ms' }}>
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
              <div className="relative"><input type={showNewPw ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required placeholder="Min 8 characters" minLength={8} className={`${inputClass} pr-11`} />
                <button type="button" onClick={() => setShowNewPw(!showNewPw)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-300 transition-colors">{showNewPw ? <EyeOff size={15} /> : <Eye size={15} />}</button></div></div>
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
    </div>
  );
}
