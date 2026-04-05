import { useState, useEffect } from 'react';
import api from '../services/api';
import { Lock } from 'lucide-react';

export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [staffAccessCode, setStaffAccessCode] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        // Ahmedabad University ID
        const uniId = '453dcc78-486d-4d80-b59a-b5c578260bc4';
        const res = await api.get(`/admin/settings/${uniId}`);
        setStaffAccessCode(res.data?.staff_access_code || '------');
      } catch (err) {
        console.error(err);
        setError('Failed to fetch system settings.');
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  return (
    <div className="p-8 lg:p-12 max-w-7xl mx-auto space-y-10 animate-fade-up font-body min-h-[calc(100vh-2rem)]">
      <div>
        <h1 className="text-4xl font-display font-bold text-[#e5e2e1] mb-2 tracking-tight">System Settings</h1>
        <p className="text-[#a38b88] text-sm">Manage global administrative settings and access.</p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-[#93000a]/20 border border-[#93000a]/50 text-[#ffb4ab] text-sm font-medium">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center p-20">
          <div className="animate-spin w-8 h-8 flex border-2 border-[#f0513e] border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="bg-[#1c1b1b] border border-[#554240]/15 rounded-2xl p-8 max-w-2xl">
          <div className="space-y-6">
            <div className="p-5 rounded-xl bg-[#eac34a]/10 border border-[#eac34a]/20">
              <h4 className="text-[14px] font-bold text-[#eac34a] mb-2 flex items-center gap-2">
                <Lock size={16} /> Staff Access Code
              </h4>
              <p className="text-[#a38b88] text-sm mb-4">
                This code is required for university staff to authenticate in the mobile app. It rotates daily automatically.
              </p>
              <div className="inline-flex items-center justify-center bg-[#131313] border border-[#554240]/30 rounded-xl py-3 px-6">
                <span className="font-mono text-2xl font-bold text-[#e5e2e1] tracking-[0.2em]">
                  {staffAccessCode}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
