import { useState, useEffect, useCallback } from 'react';
import { Settings as SettingsIcon, Mail, Globe, Save, CheckCircle2 } from 'lucide-react';
import api from '../services/api';

const UNIVERSITY_ID = 'f6cc7c6c-9534-45c7-8658-8855f2ad087b';

export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [systemEmail, setSystemEmail] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [superAdminEmail, setSuperAdminEmail] = useState('');

  const fetchSettings = useCallback(async () => {
    try {
      const res = await api.get(`/admin/settings/${UNIVERSITY_ID}`);
      setSystemEmail(res.data.system_email || '');
      setAdminEmail(res.data.admin_email || '');
      setSuperAdminEmail(res.data.super_admin_email || '');
    } catch (err: any) {
      console.error('[Settings] fetch error:', err);
      setError('Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

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

  const inputClass = "w-full px-4 py-3 rounded-xl bg-[#131313] border border-[#554240]/20 text-[#e5e2e1] text-sm focus:outline-none focus:ring-2 focus:ring-[#f0513e]/30 focus:border-[#f0513e]/40 transition-all placeholder-[#554240]";
  const labelClass = "text-[11px] font-bold text-[#a38b88] uppercase tracking-widest mb-2 flex items-center gap-1.5";

  return (
    <div className="p-8 lg:p-12 max-w-7xl mx-auto space-y-10 animate-fade-up font-body min-h-[calc(100vh-2rem)]">
      <div>
        <h1 className="text-4xl font-display font-bold text-[#e5e2e1] mb-2 tracking-tight">System Settings</h1>
        <p className="text-[#a38b88] text-sm">Manage global email configuration and system preferences.</p>
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
          {/* General Info */}
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
              University staff are now managed from the <strong className="text-[#e5e2e1]">University Staff</strong> page. Admin accounts can be managed in <strong className="text-[#e5e2e1]">Access Control</strong>.
            </p>
          </div>

          {/* Email Configuration */}
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
        </>
      )}
    </div>
  );
}
