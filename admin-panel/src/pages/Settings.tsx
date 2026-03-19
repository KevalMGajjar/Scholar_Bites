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

  // ── Password state (OTP-based two-step flow) ──
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

  // Cooldown timer for OTP resend
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  // ── Fetch University ──
  const fetchUniversity = useCallback(async () => {
    if (!user?.university_id) return;
    try {
      const res = await api.get(`/university/${user.university_id}`);
      setUniversity(res.data);
      setName(res.data.name);
      setAddress(res.data.address || '');
      setLogoPreview(res.data.logo_url || null);
    } catch (err) { console.error(err); setUniError('Failed to load university'); }
    finally { setLoading(false); }
  }, [user?.university_id]);

  // ── Fetch Staff ──
  const fetchStaff = useCallback(async () => {
    if (!user?.university_id) return;
    try {
      const res = await api.get(`/admin/staff/${user.university_id}`);
      setStaffList(res.data);
    } catch (err) { console.error(err); }
    finally { setStaffLoading(false); }
  }, [user?.university_id]);

  useEffect(() => { fetchUniversity(); fetchStaff(); }, [fetchUniversity, fetchStaff]);

  // ── University Submit ──
  const handleUniSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.university_id) return;
    setSaving(true); setUniError(''); setUniSuccess('');
    const fd = new FormData();
    fd.append('name', name);
    fd.append('address', address);
    if (logoFile) fd.append('logo', logoFile);
    try {
      await api.patch(`/university/${user.university_id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setUniSuccess('University updated successfully!');
      setLogoFile(null);
      fetchUniversity();
    } catch (err: any) { setUniError(err.response?.data?.message || 'Update failed'); }
    finally { setSaving(false); }
  };

  // ── Add Staff ──
  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setStaffSaving(true); setStaffError(''); setStaffSuccess('');
    try {
      await api.post('/admin/staff', { ...newStaff, university_id: user?.university_id });
      setStaffSuccess('Staff member added successfully!');
      setNewStaff({ name: '', email: '', password: '', role: 'staff' });
      setShowAddStaff(false);
      fetchStaff();
    } catch (err: any) { setStaffError(err.response?.data?.message || 'Failed to add staff'); }
    finally { setStaffSaving(false); }
  };

  // ── Delete Staff ──
  const handleDeleteStaff = async (id: string, staffName: string) => {
    if (!confirm(`Are you sure you want to remove ${staffName}? This action is irreversible.`)) return;
    try {
      await api.delete(`/admin/staff/${id}`);
      setStaffSuccess(`${staffName} has been removed.`);
      fetchStaff();
    } catch (err: any) { setStaffError(err.response?.data?.message || 'Failed to remove staff'); }
  };

  // ── Step 1: Request OTP ──
  const handleRequestOtp = async () => {
    setOtpSending(true); setPwError(''); setPwSuccess('');
    try {
      const res = await api.post('/admin/password/request-otp');
      setMaskedEmail(res.data.email);
      setOtpSent(true);
      setCooldown(60);
    } catch (err: any) { setPwError(err.response?.data?.message || 'Failed to send OTP'); }
    finally { setOtpSending(false); }
  };

  // ── Step 2: Verify OTP + Change Password ──
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(''); setPwSuccess('');
    if (newPassword.length < 8) { setPwError('New password must be at least 8 characters'); return; }
    if (newPassword !== confirmPassword) { setPwError('Passwords do not match'); return; }
    if (!otpCode || otpCode.length !== 6) { setPwError('Please enter the 6-digit OTP'); return; }

    setPwSaving(true);
    try {
      await api.post('/admin/password/verify-and-change', { otp: otpCode, current_password: currentPassword, new_password: newPassword });
      setPwSuccess('Password changed successfully!');
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
      setOtpCode(''); setOtpSent(false);
    } catch (err: any) { setPwError(err.response?.data?.message || 'Password change failed'); }
    finally { setPwSaving(false); }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full min-h-screen">
        <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const ROLE_BADGES: Record<string, string> = {
    staff: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
    admin: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/20',
    super_admin: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Settings</h1>
        <p className="text-slate-400 text-sm mt-1">Manage university profile, team members, and security</p>
      </div>

      {/* ═══ SECTION 1: University Profile ═══ */}
      {university && (
        <div className="bg-slate-900/40 backdrop-blur-md border border-slate-700/50 rounded-3xl p-8 shadow-xl">
          <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-400"><Building2 size={18} /></div>
            University Profile
          </h2>
          {uniError && <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{uniError}</div>}
          {uniSuccess && <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">{uniSuccess}</div>}
          <form onSubmit={handleUniSubmit} className="space-y-6">
            <div className="flex items-start gap-6 pb-6 border-b border-white/5">
              <div className="relative group shrink-0">
                <div className="w-20 h-20 rounded-2xl bg-slate-800 border-2 border-slate-700 overflow-hidden shadow-inner flex items-center justify-center">
                  {logoPreview ? <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" /> : <Building2 size={28} className="text-slate-500" />}
                </div>
                <label className="absolute inset-0 bg-black/50 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center cursor-pointer rounded-2xl">
                  <Camera size={18} className="text-white mb-0.5" />
                  <span className="text-white text-[10px] font-bold">Change</span>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setLogoFile(f); setLogoPreview(URL.createObjectURL(f)); } }} />
                </label>
              </div>
              <div className="flex-1 mt-1">
                <h3 className="text-white font-bold text-sm">University Logo</h3>
                <p className="text-slate-500 text-xs mt-1">Square PNG or JPG, at least 500×500px.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><Building2 size={12} className="text-indigo-400" /> Name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className="w-full px-4 py-2.5 rounded-xl bg-slate-950/50 border border-slate-800 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 shadow-inner placeholder-slate-600" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><MapPin size={12} className="text-indigo-400" /> Address</label>
                <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className="w-full px-4 py-2.5 rounded-xl bg-slate-950/50 border border-slate-800 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 shadow-inner placeholder-slate-600" />
              </div>
            </div>
            <div className="flex justify-end">
              <button type="submit" disabled={saving} className="px-6 py-2.5 rounded-xl bg-indigo-500 shadow-lg shadow-indigo-500/20 text-white text-sm font-bold hover:bg-indigo-400 transition-all disabled:opacity-50 flex items-center gap-2">
                {saving ? <><div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> Saving...</> : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ═══ SECTION 2: Staff Management ═══ */}
      <div className="bg-slate-900/40 backdrop-blur-md border border-slate-700/50 rounded-3xl p-8 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-white flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/15 text-blue-400"><Users size={18} /></div>
            Staff Accounts
          </h2>
          <button onClick={() => { setShowAddStaff(!showAddStaff); setStaffError(''); setStaffSuccess(''); }}
            className="px-4 py-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold hover:bg-indigo-500/20 transition-all flex items-center gap-2">
            <UserPlus size={14} /> Add Staff
          </button>
        </div>
        {staffError && <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{staffError}</div>}
        {staffSuccess && <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">{staffSuccess}</div>}

        {showAddStaff && (
          <form onSubmit={handleAddStaff} className="mb-6 p-6 rounded-2xl bg-slate-800/50 border border-slate-700/30 space-y-4">
            <h3 className="text-white font-bold text-sm mb-1">Create New Staff Account</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Full Name</label>
                <input type="text" value={newStaff.name} onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })} required placeholder="John Doe"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950/50 border border-slate-800 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 shadow-inner placeholder-slate-600" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><Mail size={11} /> Email</label>
                <input type="email" value={newStaff.email} onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })} required placeholder="staff@university.edu"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950/50 border border-slate-800 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 shadow-inner placeholder-slate-600" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><KeyRound size={11} /> Password</label>
                <input type="password" value={newStaff.password} onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })} required placeholder="Minimum 8 characters" minLength={8}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950/50 border border-slate-800 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 shadow-inner placeholder-slate-600" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><Shield size={11} /> Role</label>
                <select value={newStaff.role} onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950/50 border border-slate-800 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 shadow-inner appearance-none">
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowAddStaff(false)}
                className="px-5 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700/50 text-slate-300 text-sm font-bold hover:bg-slate-700 transition-all">Cancel</button>
              <button type="submit" disabled={staffSaving}
                className="px-5 py-2.5 rounded-xl bg-indigo-500 shadow-lg shadow-indigo-500/20 text-white text-sm font-bold hover:bg-indigo-400 transition-all disabled:opacity-50 flex items-center gap-2">
                {staffSaving ? <><div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> Creating...</> : <><UserPlus size={14} /> Create Account</>}
              </button>
            </div>
          </form>
        )}

        {staffLoading ? (
          <div className="flex justify-center py-8"><div className="animate-spin w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full" /></div>
        ) : staffList.length === 0 ? (
          <div className="text-center py-10"><Users size={40} className="text-slate-600 mx-auto mb-3" /><p className="text-slate-400 text-sm">No staff accounts found.</p></div>
        ) : (
          <div className="space-y-3">
            {staffList.map((s) => (
              <div key={s.id} className="flex items-center gap-4 p-4 rounded-2xl bg-slate-800/30 border border-slate-700/30 hover:bg-slate-800/60 transition-all group">
                <div className="w-10 h-10 rounded-xl bg-slate-700/50 flex items-center justify-center shrink-0 shadow-inner">
                  <span className="text-white font-bold text-sm">{s.name.charAt(0).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-bold truncate">{s.name}</p>
                  <p className="text-slate-500 text-xs truncate">{s.email}</p>
                </div>
                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-wider uppercase border ${ROLE_BADGES[s.role] || 'bg-slate-500/15 text-slate-400 border-slate-500/20'}`}>
                  {s.role.replace('_', ' ')}
                </span>
                <span className="text-slate-600 text-[10px] font-medium hidden md:block">
                  {new Date(s.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
                {s.id !== user?.id && (
                  <button onClick={() => handleDeleteStaff(s.id, s.name)}
                    className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all" title="Remove staff member">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ═══ SECTION 3: Change Password (OTP-verified) ═══ */}
      <div className="bg-slate-900/40 backdrop-blur-md border border-slate-700/50 rounded-3xl p-8 shadow-xl">
        <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-3">
          <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400"><Lock size={18} /></div>
          Change Password
        </h2>
        <p className="text-slate-500 text-xs mb-6">Password changes require email OTP verification for security.</p>

        {pwError && <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{pwError}</div>}
        {pwSuccess && <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">{pwSuccess}</div>}

        {/* Step 1: Request OTP */}
        {!otpSent ? (
          <div className="max-w-lg space-y-4">
            <p className="text-slate-300 text-sm">To change your password, we'll send a 6-digit OTP to your registered email address.</p>
            <button onClick={handleRequestOtp} disabled={otpSending}
              className="px-6 py-3 rounded-xl bg-indigo-500 shadow-lg shadow-indigo-500/20 text-white text-sm font-bold hover:bg-indigo-400 transition-all disabled:opacity-50 flex items-center gap-2">
              {otpSending ? (
                <><div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> Sending OTP...</>
              ) : (
                <><Send size={14} /> Send Verification Code</>
              )}
            </button>
          </div>
        ) : (
          /* Step 2: Enter OTP + passwords */
          <form onSubmit={handlePasswordChange} className="space-y-5 max-w-lg">
            {/* OTP sent confirmation */}
            <div className="p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/15 space-y-2">
              <p className="text-indigo-400 text-sm font-bold">OTP sent to {maskedEmail}</p>
              <p className="text-slate-400 text-xs">Enter the 6-digit code below. It expires in 10 minutes.</p>
              <div className="flex items-center gap-3 pt-1">
                <button type="button" onClick={handleRequestOtp} disabled={cooldown > 0 || otpSending}
                  className="text-xs text-indigo-400 hover:text-indigo-300 disabled:text-slate-600 font-bold transition-colors">
                  {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend OTP'}
                </button>
              </div>
            </div>

            {/* OTP Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><Mail size={12} className="text-indigo-400" /> Verification Code</label>
              <input type="text" value={otpCode} onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))} required placeholder="000000" maxLength={6}
                className="w-full px-4 py-3 rounded-xl bg-slate-950/50 border border-slate-800 text-white text-center text-2xl font-mono tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-indigo-500/50 shadow-inner placeholder-slate-700" />
            </div>

            {/* Current Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Current Password</label>
              <div className="relative">
                <input type={showCurrentPw ? 'text' : 'password'} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required placeholder="Enter current password"
                  className="w-full px-4 py-2.5 pr-11 rounded-xl bg-slate-950/50 border border-slate-800 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 shadow-inner placeholder-slate-600" />
                <button type="button" onClick={() => setShowCurrentPw(!showCurrentPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                  {showCurrentPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">New Password</label>
              <div className="relative">
                <input type={showNewPw ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required placeholder="Minimum 8 characters" minLength={8}
                  className="w-full px-4 py-2.5 pr-11 rounded-xl bg-slate-950/50 border border-slate-800 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 shadow-inner placeholder-slate-600" />
                <button type="button" onClick={() => setShowNewPw(!showNewPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                  {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Confirm */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Confirm New Password</label>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required placeholder="Re-enter new password"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950/50 border border-slate-800 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 shadow-inner placeholder-slate-600" />
            </div>

            <div className="flex justify-end pt-2">
              <button type="submit" disabled={pwSaving}
                className="px-6 py-2.5 rounded-xl bg-indigo-500 shadow-lg shadow-indigo-500/20 text-white text-sm font-bold hover:bg-indigo-400 transition-all disabled:opacity-50 flex items-center gap-2">
                {pwSaving ? <><div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> Updating...</> : <><Lock size={14} /> Update Password</>}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
