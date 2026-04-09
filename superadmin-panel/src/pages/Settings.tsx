import { useState, useEffect } from 'react';
import { Settings as SettingsIcon } from 'lucide-react';

export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [error] = useState('');

  useEffect(() => {
    // Placeholder — fetch any system settings if needed
    const timer = setTimeout(() => setLoading(false), 300);
    return () => clearTimeout(timer);
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
      )}
    </div>
  );
}
