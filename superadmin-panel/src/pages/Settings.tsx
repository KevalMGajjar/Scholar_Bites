import { useState, useEffect, useCallback } from 'react';
import { Settings as SettingsIcon, Mail, Globe, Save, CheckCircle2, Building2, Camera, MapPin, Phone, Users } from 'lucide-react';
import api from '../services/api';

const UNIVERSITY_ID = 'f6cc7c6c-9534-45c7-8658-8855f2ad087b';

interface University {
  id: string;
  name: string;
  address: string;
  logo_url: string;
  support_phone?: string;
  support_email?: string;
  support_staff?: string;
}

export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [systemEmail, setSystemEmail] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [superAdminEmail, setSuperAdminEmail] = useState('');

  // ── University Profile state ──
  const [university, setUniversity] = useState<University | null>(null);
  const [uniName, setUniName] = useState('');
  const [address, setAddress] = useState('');
  const [supportPhone, setSupportPhone] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [supportStaff, setSupportStaff] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [groupOrderVisible, setGroupOrderVisible] = useState(false);
  const [preOrderCutoff, setPreOrderCutoff] = useState('22:00');
  const [uniSaving, setUniSaving] = useState(false);
  const [uniError, setUniError] = useState('');
  const [uniSuccess, setUniSuccess] = useState('');

  // ── Per-restaurant preparing limits ──
  const [restaurants, setRestaurants] = useState<{ id: string; name: string; prep_limit: number; is_event_restaurant: boolean }[]>([]);
  const [limitInputs, setLimitInputs] = useState<Record<string, string>>({});
  const [savingLimit, setSavingLimit] = useState<string | null>(null);
  const [limitMsg, setLimitMsg] = useState('');

  const fetchSettings = useCallback(async () => {
    try {
      const res = await api.get(`/admin/settings/${UNIVERSITY_ID}`);
      setSystemEmail(res.data.system_email || '');
      setAdminEmail(res.data.admin_email || '');
      setSuperAdminEmail(res.data.super_admin_email || '');
      setGroupOrderVisible(!!res.data.group_order_visible_students);
      if (res.data.pre_order_cutoff) setPreOrderCutoff(String(res.data.pre_order_cutoff).slice(0, 5));
    } catch (err: any) {
      console.error('[Settings] fetch error:', err);
      setError('Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUniversity = useCallback(async () => {
    try {
      const res = await api.get(`/university/${UNIVERSITY_ID}`);
      setUniversity(res.data);
      setUniName(res.data.name || '');
      setAddress(res.data.address || '');
      setSupportPhone(res.data.support_phone || '');
      setSupportEmail(res.data.support_email || '');
      setSupportStaff(res.data.support_staff || '');
      setLogoPreview(res.data.logo_url || null);
    } catch (err: any) {
      console.error('[Settings] university fetch error:', err);
    }
  }, []);

  const fetchRestaurants = useCallback(async () => {
    try {
      const res = await api.get('/superadmin/restaurants');
      setRestaurants(res.data);
      const inputs: Record<string, string> = {};
      res.data.forEach((r: any) => { inputs[r.id] = String(r.prep_limit ?? 0); });
      setLimitInputs(inputs);
    } catch (err) {
      console.error('[Settings] restaurants fetch error:', err);
    }
  }, []);

  useEffect(() => { fetchSettings(); fetchUniversity(); fetchRestaurants(); }, [fetchSettings, fetchUniversity, fetchRestaurants]);

  const handleSaveLimit = async (id: string) => {
    setSavingLimit(id); setLimitMsg('');
    try {
      const val = Math.max(0, parseInt(limitInputs[id]) || 0);
      await api.patch(`/superadmin/restaurants/${id}/prep-limit`, { prep_limit: val });
      setRestaurants((prev) => prev.map((r) => (r.id === id ? { ...r, prep_limit: val } : r)));
      setLimitMsg('Saved');
      setTimeout(() => setLimitMsg(''), 2500);
    } catch (err: any) {
      setLimitMsg(err.response?.data?.message || 'Failed to save');
    } finally {
      setSavingLimit(null);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError(''); setSuccess('');
    try {
      await api.patch(`/admin/settings/${UNIVERSITY_ID}`, {
        system_email: systemEmail || undefined,
        admin_email: adminEmail || undefined,
        super_admin_email: superAdminEmail || undefined,
      });
      setSuccess('Email configuration saved successfully!');
      setTimeout(() => setSuccess(''), 4000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleUniSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUniSaving(true); setUniError(''); setUniSuccess('');
    const fd = new FormData();
    fd.append('name', uniName);
    fd.append('address', address);
    fd.append('support_phone', supportPhone);
    fd.append('support_email', supportEmail);
    fd.append('support_staff', supportStaff);
    if (logoFile) fd.append('logo', logoFile);
    try {
      await api.patch(`/university/${UNIVERSITY_ID}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      await api.patch(`/admin/settings/${UNIVERSITY_ID}`, { group_order_visible_students: groupOrderVisible, pre_order_cutoff: preOrderCutoff });
      setUniSuccess('University profile updated successfully!');
      setLogoFile(null);
      fetchUniversity();
      setTimeout(() => setUniSuccess(''), 4000);
    } catch (err: any) {
      setUniError(err.response?.data?.message || 'Update failed');
    } finally {
      setUniSaving(false);
    }
  };

  const inputClass = "w-full px-4 py-3 rounded-xl bg-[#131313] border border-[#554240]/20 text-[#e5e2e1] text-sm focus:outline-none focus:ring-2 focus:ring-[#f0513e]/30 focus:border-[#f0513e]/40 transition-all placeholder-[#554240]";
  const labelClass = "text-[11px] font-bold text-[#a38b88] uppercase tracking-widest mb-2 flex items-center gap-1.5";

  return (
    <div className="p-8 lg:p-12 max-w-7xl mx-auto space-y-10 animate-fade-up font-body min-h-[calc(100vh-2rem)]">
      <div>
        <h1 className="text-4xl font-display font-bold text-[#e5e2e1] mb-2 tracking-tight">System Settings</h1>
        <p className="text-[#a38b88] text-sm">Manage the university profile, global email configuration, and system preferences.</p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-[#93000a]/20 border border-[#93000a]/50 text-[#ffb4ab] text-sm font-medium">
          {error}
        </div>
      )}
      {success && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm font-medium flex items-center gap-2">
          <CheckCircle2 size={16} /> {success}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center p-20">
          <div className="animate-spin w-8 h-8 flex border-2 border-[#f0513e] border-t-transparent rounded-full" />
        </div>
      ) : (
        <>
          {/* ═══ University Profile ═══ */}
          {university && (
            <form onSubmit={handleUniSubmit} className="bg-[#1c1b1b] border border-[#554240]/15 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-[#4c0000]/40 border border-[#f0513e]/20 rounded-xl flex items-center justify-center">
                  <Building2 size={20} className="text-[#ffb4a8]" />
                </div>
                <div>
                  <h2 className="text-lg font-display font-bold text-[#e5e2e1]">University Profile</h2>
                  <p className="text-[#a38b88] text-xs">Identity, branding & support contacts shown across the app</p>
                </div>
              </div>

              {uniError && <div className="mb-4 p-3.5 rounded-xl bg-[#93000a]/20 border border-[#93000a]/50 text-[#ffb4ab] text-sm">{uniError}</div>}
              {uniSuccess && <div className="mb-4 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm flex items-center gap-2"><CheckCircle2 size={15} /> {uniSuccess}</div>}

              {/* Logo */}
              <div className="flex items-start gap-6 pb-6 mb-6 border-b border-[#554240]/15">
                <div className="relative group shrink-0">
                  <div className="w-20 h-20 rounded-2xl bg-[#131313] border-2 border-[#554240]/20 overflow-hidden flex items-center justify-center p-2.5">
                    {logoPreview ? <img src={logoPreview} alt="Logo" className="w-full h-full object-contain" /> : <Building2 size={28} className="text-[#554240]" />}
                  </div>
                  <label className="absolute inset-0 bg-black/60 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center cursor-pointer rounded-2xl">
                    <Camera size={16} className="text-white mb-0.5" /><span className="text-white text-[10px] font-bold">Change</span>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setLogoFile(f); setLogoPreview(URL.createObjectURL(f)); } }} />
                  </label>
                </div>
                <div className="flex-1 mt-1">
                  <h3 className="text-[#e5e2e1] font-bold text-[13px]">University Logo</h3>
                  <p className="text-[#554240] text-[11px] mt-1">Square PNG or JPG, at least 500×500px.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div><label className={labelClass}><Building2 size={11} className="text-[#ffb4a8]" /> Name</label>
                  <input type="text" value={uniName} onChange={(e) => setUniName(e.target.value)} required className={inputClass} /></div>
                <div><label className={labelClass}><MapPin size={11} className="text-[#ffb4a8]" /> Address</label>
                  <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className={inputClass} /></div>
                <div><label className={labelClass}><Phone size={11} className="text-[#ffb4a8]" /> Support Phone</label>
                  <input type="text" value={supportPhone} onChange={(e) => setSupportPhone(e.target.value)} placeholder="+91 ..." className={inputClass} /></div>
                <div><label className={labelClass}><Mail size={11} className="text-[#ffb4a8]" /> Support Email</label>
                  <input type="email" value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} placeholder="help@university.edu" className={inputClass} /></div>
                <div className="md:col-span-2"><label className={labelClass}><Users size={11} className="text-[#ffb4a8]" /> Staff Contact <span className="text-[#554240] normal-case font-medium">(shown in the app's Help → Staff)</span></label>
                  <textarea value={supportStaff} onChange={(e) => setSupportStaff(e.target.value)} rows={2} placeholder="e.g. Canteen Manager — Counter 3, 9 AM–6 PM" className={`${inputClass} resize-none`} /></div>
              </div>

              {/* System toggles */}
              <div className="pt-6 mt-6 border-t border-[#554240]/15">
                <h3 className="text-[#e5e2e1] font-bold text-[13px] mb-4">System Settings</h3>
                <div className="flex items-center justify-between p-4 rounded-xl bg-[#131313] border border-[#554240]/20 max-w-md">
                  <div>
                    <h4 className="text-[13px] font-bold text-[#e5e2e1] mb-1">Group Order for Students</h4>
                    <p className="text-[11px] text-[#a38b88]">Allow students to initiate group orders.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={groupOrderVisible} onChange={(e) => setGroupOrderVisible(e.target.checked)} />
                    <div className="w-11 h-6 bg-[#554240] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#f0513e]"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 rounded-xl bg-[#131313] border border-[#554240]/20 max-w-md mt-3">
                  <div>
                    <h4 className="text-[13px] font-bold text-[#e5e2e1] mb-1">Daily Pre-Order Cutoff</h4>
                    <p className="text-[11px] text-[#a38b88]">Last time delegates can place a daily pre-order (today). Does not affect catering.</p>
                  </div>
                  <input
                    type="time"
                    value={preOrderCutoff}
                    onChange={(e) => setPreOrderCutoff(e.target.value)}
                    className="px-3 py-2 rounded-lg bg-[#1c1b1b] border border-[#554240]/30 text-[#e5e2e1] text-sm font-mono focus:outline-none focus:border-[#f0513e]/40"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-6 mt-6 border-t border-[#554240]/15">
                <button type="submit" disabled={uniSaving}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#f0513e] to-[#d32f2f] text-white text-sm font-bold hover:shadow-lg hover:shadow-[#f0513e]/20 transition-all disabled:opacity-50 flex items-center gap-2">
                  {uniSaving ? (
                    <><div className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" /> Saving...</>
                  ) : (
                    <><Save size={14} /> Save University Profile</>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* ═══ Email Configuration ═══ */}
          <form onSubmit={handleSave} className="bg-[#1c1b1b] border border-[#554240]/15 rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center">
                <Globe size={20} className="text-emerald-400" />
              </div>
              <div>
                <h2 className="text-lg font-display font-bold text-[#e5e2e1]">Email Configuration</h2>
                <p className="text-[#a38b88] text-xs">Configure email addresses used across the canteen management system</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div>
                <label className={labelClass}><Mail size={11} className="text-emerald-400" /> System Email (FROM)</label>
                <input type="email" value={systemEmail} onChange={(e) => setSystemEmail(e.target.value)} placeholder="canteen@university.edu" className={inputClass} />
                <p className="text-[10px] text-[#554240] mt-1.5">Sender address for all outgoing system emails</p>
              </div>
              <div>
                <label className={labelClass}><Mail size={11} className="text-blue-400" /> Admin Email</label>
                <input type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} placeholder="admin@university.edu" className={inputClass} />
                <p className="text-[10px] text-[#554240] mt-1.5">Receives catering requests & admin notifications</p>
              </div>
              <div>
                <label className={labelClass}><Mail size={11} className="text-purple-400" /> Super Admin Email</label>
                <input type="email" value={superAdminEmail} onChange={(e) => setSuperAdminEmail(e.target.value)} placeholder="superadmin@university.edu" className={inputClass} />
                <p className="text-[10px] text-[#554240] mt-1.5">Receives refund requests & critical system alerts</p>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-[#554240]/15">
              <button type="submit" disabled={saving}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#f0513e] to-[#d32f2f] text-white text-sm font-bold hover:shadow-lg hover:shadow-[#f0513e]/20 transition-all disabled:opacity-50 flex items-center gap-2">
                {saving ? (
                  <><div className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" /> Saving...</>
                ) : (
                  <><Save size={14} /> Save Email Configuration</>
                )}
              </button>
            </div>
          </form>

          {/* ═══ Preparing Capacity (per restaurant) ═══ */}
          <div className="bg-[#1c1b1b] border border-[#554240]/15 rounded-2xl p-8">
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#4c0000]/40 border border-[#f0513e]/20 rounded-xl flex items-center justify-center">
                  <SettingsIcon size={20} className="text-[#ffb4a8]" />
                </div>
                <div>
                  <h2 className="text-lg font-display font-bold text-[#e5e2e1]">Preparing Capacity</h2>
                  <p className="text-[#a38b88] text-xs">Max orders a restaurant can have in <strong className="text-[#e5e2e1]">Preparing</strong> at once. 0 = unlimited.</p>
                </div>
              </div>
              {limitMsg && <span className="text-xs font-semibold text-emerald-400">{limitMsg}</span>}
            </div>

            {restaurants.length === 0 ? (
              <p className="text-[#a38b88] text-sm mt-4">No restaurants found.</p>
            ) : (
              <div className="mt-4 divide-y divide-[#554240]/15">
                {restaurants.map((r) => (
                  <div key={r.id} className="flex items-center justify-between py-3 gap-4">
                    <div className="min-w-0">
                      <p className="text-[#e5e2e1] text-sm font-semibold truncate">{r.name}</p>
                      {r.is_event_restaurant && <span className="text-[10px] font-bold uppercase tracking-wider text-purple-300">Catering</span>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <input
                        type="number"
                        min="0"
                        value={limitInputs[r.id] ?? ''}
                        onChange={(e) => setLimitInputs((prev) => ({ ...prev, [r.id]: e.target.value }))}
                        className="w-24 px-3 py-2 rounded-lg bg-[#131313] border border-[#554240]/20 text-[#e5e2e1] text-sm font-mono text-center focus:outline-none focus:border-[#f0513e]/40"
                      />
                      <button
                        onClick={() => handleSaveLimit(r.id)}
                        disabled={savingLimit === r.id || String(r.prep_limit) === (limitInputs[r.id] ?? '')}
                        className="px-4 py-2 rounded-lg bg-[#f0513e]/15 border border-[#f0513e]/25 text-[#ffb4a8] text-xs font-bold hover:bg-[#f0513e]/25 transition disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {savingLimit === r.id ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ═══ General Info ═══ */}
          <div className="bg-[#1c1b1b] border border-[#554240]/15 rounded-2xl p-8 max-w-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-[#4c0000]/40 border border-[#f0513e]/20 rounded-xl flex items-center justify-center">
                <SettingsIcon size={20} className="text-[#ffb4a8]" />
              </div>
              <div>
                <h2 className="text-lg font-display font-bold text-[#e5e2e1]">General</h2>
                <p className="text-[#a38b88] text-xs">Core system configuration</p>
              </div>
            </div>
            <p className="text-[#a38b88] text-sm">
              University staff are now managed from the <strong className="text-[#e5e2e1]">Delegates</strong> page. Admin accounts can be managed in <strong className="text-[#e5e2e1]">Access Control</strong>.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
