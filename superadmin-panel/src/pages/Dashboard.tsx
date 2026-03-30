import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { TrendingUp, Activity, Users, AlertTriangle, ArrowRight } from 'lucide-react';

interface SystemHealth {
  ordersToday: Record<string, number>;
  totalOrdersToday: number;
  systemEventsToday: number;
  activeStaffToday: number;
  recentAnomalies: {
    action: string;
    details: string;
    created_at: string;
    user_id: string;
  }[];
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHealth();
  }, []);

  const fetchHealth = async () => {
    try {
      const { data } = await api.get('/superadmin/system-health');
      setHealth(data);
    } catch (error) {
      console.error('Failed to fetch system health', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-2rem)] items-center justify-center">
        <div className="animate-spin w-8 h-8 flex border-2 border-[#f0513e] border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-8 lg:p-12 max-w-7xl mx-auto space-y-10 animate-fade-up font-body">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div>
          <h1 className="text-4xl font-display font-bold text-[#e5e2e1] mb-2 tracking-tight">System Health</h1>
          <p className="text-[#a38b88] text-sm">Real-time load and anomaly detection for Ahmedabad University Canteen.</p>
        </div>
        <div className="flex gap-4">
          <button onClick={() => navigate('/refunds')} className="btn-secondary px-6 py-2.5 flex items-center gap-2">
            Refund Queue <ArrowRight size={16} />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Large Revenue Card */}
        <div className="md:col-span-2 bg-[#1c1b1b] border border-[#554240]/15 p-8 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#f0513e]/5 rounded-full blur-[80px] -mr-20 -mt-20 pointer-events-none transition-opacity group-hover:bg-[#f0513e]/10" />
          
          <div className="flex items-center justify-between mb-8 relative z-10">
            <div className="w-14 h-14 rounded-2xl bg-[#4c0000]/50 border border-[#f0513e]/20 text-[#ffb4a8] flex items-center justify-center shadow-inner">
              <Activity size={28} />
            </div>
            <span className="text-[#ffb4a8] bg-[#4c0000]/30 px-3 py-1.5 rounded-lg label-premium">
              Today's Activity
            </span>
          </div>
          <div className="relative z-10">
            <p className="label-premium mb-2">Global System Events Logged</p>
            <p className="text-5xl font-display font-bold text-[#e5e2e1] tracking-tight">
              {(health?.systemEventsToday || 0).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Regular Cards */}
        <div className="bg-[#1c1b1b] border border-[#554240]/15 p-8 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-6">
            <div className="w-12 h-12 rounded-xl bg-[#201f1f] border border-[#554240]/20 text-[#a38b88] flex items-center justify-center">
              <TrendingUp size={24} />
            </div>
          </div>
          <div>
            <p className="label-premium mb-2">Orders Today</p>
            <p className="text-4xl font-display font-bold text-[#e5e2e1] tracking-tight">{health?.totalOrdersToday || 0}</p>
          </div>
        </div>

        <div className="bg-[#1c1b1b] border border-[#554240]/15 p-8 rounded-2xl flex flex-col justify-between relative overflow-hidden">
          <div className="absolute bottom-0 right-0 w-32 h-32 bg-[#eac34a]/5 rounded-full blur-[50px] pointer-events-none" />
          <div className="flex items-center justify-between mb-6 relative z-10">
            <div className="w-12 h-12 rounded-xl bg-[#eac34a]/10 border border-[#eac34a]/20 text-[#eac34a] flex items-center justify-center">
              <Users size={24} />
            </div>
          </div>
          <div className="relative z-10">
            <p className="label-premium mb-2">Active Staff Today</p>
            <p className="text-4xl font-display font-bold text-[#e5e2e1] tracking-tight">{health?.activeStaffToday || 0}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
         {/* Live Order Load */}
         <div className="bg-[#1c1b1b] border border-[#554240]/15 rounded-2xl overflow-hidden flex flex-col">
            <div className="p-6 border-b border-[#554240]/15 bg-[#201f1f] flex items-center gap-3">
               <Activity className="text-[#e5e2e1]" size={20} />
               <h2 className="text-[#e5e2e1] font-display font-bold text-lg tracking-tight">Active Platform Load</h2>
            </div>
            <div className="p-8 flex-1 grid grid-cols-2 gap-6">
               <div className="bg-[#131313] border border-[#554240]/20 rounded-xl p-6 text-center shadow-inner">
                  <p className="text-[#a38b88] text-xs uppercase tracking-widest font-bold mb-2">Pending</p>
                  <p className="text-5xl font-display font-bold text-[#ffb4a8]">{health?.ordersToday['pending'] || 0}</p>
               </div>
               <div className="bg-[#131313] border border-[#554240]/20 rounded-xl p-6 text-center shadow-inner">
                  <p className="text-[#a38b88] text-xs uppercase tracking-widest font-bold mb-2">Preparing</p>
                  <p className="text-5xl font-display font-bold text-[#eac34a]">{health?.ordersToday['preparing'] || 0}</p>
               </div>
            </div>
         </div>

         {/* Anomalies List */}
         <div className="bg-[#1c1b1b] border border-[#554240]/15 rounded-2xl overflow-hidden flex flex-col">
            <div className="p-6 border-b border-[#554240]/15 bg-[#201f1f] flex items-center justify-between">
               <div className="flex items-center gap-3">
                  <AlertTriangle className="text-[#f0513e]" size={20} />
                  <h2 className="text-[#e5e2e1] font-display font-bold text-lg tracking-tight">System Anomalies</h2>
               </div>
               <button onClick={() => navigate('/audit-logs')} className="text-[#ffb4a8] hover:underline text-xs font-bold uppercase tracking-wider">
                  View All Log
               </button>
            </div>
            <div className="divide-y divide-[#554240]/15 flex-1 max-h-[300px] overflow-y-auto">
               {health?.recentAnomalies.length === 0 ? (
                  <div className="p-10 text-center text-[#a38b88] text-sm">
                     System is operating smoothly. No recent anomalies detected.
                  </div>
               ) : (
                  health?.recentAnomalies.map((anom, idx) => (
                     <div key={idx} className="p-4 bg-[#131313]/20 hover:bg-[#201f1f] transition flex justify-between items-center">
                        <div>
                           <p className="text-[#ffb4a8] font-bold text-sm font-display mb-0.5">{anom.action}</p>
                           <p className="text-[#a38b88] text-xs truncate max-w-xs">{anom.details}</p>
                        </div>
                        <p className="text-[#554240] text-[10px] whitespace-nowrap">{new Date(anom.created_at).toLocaleTimeString()}</p>
                     </div>
                  ))
               )}
            </div>
         </div>
      </div>
    </div>
  );
}
