import { useEffect, useState, useCallback } from 'react';
import api from '../services/api';
import { Activity, CheckCircle2, XCircle, MinusCircle, RefreshCw, Database, Mail, HardDrive, CreditCard, Bell } from 'lucide-react';

type HealthStatus = 'ok' | 'down' | 'not_configured';
interface ServiceResult {
  service: string;
  status: HealthStatus;
  detail: string;
  latencyMs: number;
}
interface HealthResponse {
  overall: 'healthy' | 'degraded';
  checkedAt: string;
  services: ServiceResult[];
}

const ICONS: Record<string, typeof Database> = {
  'Database': Database,
  'Email (SMTP)': Mail,
  'File Storage': HardDrive,
  'Payments (Razorpay)': CreditCard,
  'Push (Firebase)': Bell,
};

export default function ServiceStatus() {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/superadmin/service-health');
      setData(res.data);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchHealth(); }, [fetchHealth]);

  const statusMeta = (s: HealthStatus) => {
    switch (s) {
      case 'ok': return { Icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', label: 'Operational' };
      case 'down': return { Icon: XCircle, color: 'text-[#ffb4ab]', bg: 'bg-[#93000a]/20 border-[#93000a]/40', label: 'Down' };
      default: return { Icon: MinusCircle, color: 'text-[#a38b88]', bg: 'bg-[#554240]/20 border-[#554240]/30', label: 'Not configured' };
    }
  };

  return (
    <div className="p-8 lg:p-12 max-w-5xl mx-auto space-y-8 animate-fade-up font-body min-h-[calc(100vh-2rem)]">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-4xl font-display font-bold text-[#e5e2e1] mb-2 tracking-tight">Service Status</h1>
          <p className="text-[#a38b88] text-sm">Live health of the systems the app depends on.</p>
        </div>
        <button onClick={fetchHealth} disabled={loading}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1c1b1b] border border-[#554240]/20 text-[#dcc0bd] text-sm font-semibold hover:text-[#ffb4a8] hover:border-[#f0513e]/30 transition disabled:opacity-50">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> {loading ? 'Checking...' : 'Re-run checks'}
        </button>
      </div>

      {/* Overall banner */}
      {data && (
        <div className={`p-5 rounded-2xl border flex items-center gap-3 ${data.overall === 'healthy' ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-[#93000a]/20 border-[#93000a]/40'}`}>
          <Activity size={20} className={data.overall === 'healthy' ? 'text-emerald-400' : 'text-[#ffb4ab]'} />
          <div>
            <p className={`text-sm font-bold ${data.overall === 'healthy' ? 'text-emerald-400' : 'text-[#ffb4ab]'}`}>
              {data.overall === 'healthy' ? 'All systems operational' : 'One or more services are down'}
            </p>
            <p className="text-[#a38b88] text-xs">Last checked {new Date(data.checkedAt).toLocaleTimeString()}</p>
          </div>
        </div>
      )}

      {loading && !data ? (
        <div className="flex justify-center p-20"><div className="animate-spin w-8 h-8 border-2 border-[#f0513e] border-t-transparent rounded-full" /></div>
      ) : !data ? (
        <div className="bg-[#1c1b1b] border border-[#554240]/15 rounded-2xl p-10 text-center text-[#a38b88]">Failed to load service status.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.services.map((svc) => {
            const meta = statusMeta(svc.status);
            const Icon = ICONS[svc.service] || Activity;
            return (
              <div key={svc.service} className="bg-[#1c1b1b] border border-[#554240]/15 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#131313] border border-[#554240]/20 flex items-center justify-center">
                      <Icon size={16} className="text-[#ffb4a8]" />
                    </div>
                    <span className="text-[#e5e2e1] font-semibold text-sm">{svc.service}</span>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${meta.bg} ${meta.color}`}>
                    <meta.Icon size={12} /> {meta.label}
                  </span>
                </div>
                <p className="text-[#a38b88] text-xs leading-relaxed">{svc.detail}</p>
                {svc.status !== 'not_configured' && (
                  <p className="text-[#554240] text-[10px] mt-2 font-mono">{svc.latencyMs} ms</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
