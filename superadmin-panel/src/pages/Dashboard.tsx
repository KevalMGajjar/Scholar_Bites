import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { IndianRupee, Store, TrendingUp, Plus } from 'lucide-react';
import AddUniversityModal from '../components/AddUniversityModal';

interface UniversityStat {
  id: string;
  name: string;
  logo_url: string;
  address: string;
  total_orders: number;
  total_revenue: number;
  created_at: string;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<UniversityStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const { data } = await api.get('/superadmin/universities');
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch stats', error);
    } finally {
      setLoading(false);
    }
  };

  const totalGlobalRevenue = stats.reduce((acc, curr) => acc + Number(curr.total_revenue), 0);
  const totalGlobalOrders = stats.reduce((acc, curr) => acc + curr.total_orders, 0);

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-2rem)] items-center justify-center">
        <div className="animate-spin w-8 h-8 flex border-2 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-8 lg:p-12 max-w-7xl mx-auto space-y-10 animate-fade-up font-body">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div>
          <h1 className="text-4xl font-display font-bold text-[#e5e2e1] mb-2 tracking-tight">Prestige Command</h1>
          <p className="text-[#a38b88] text-sm">High-level metrics across all onboarded institutions</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="btn-premium px-6 py-2.5 flex items-center gap-2 shadow-[0_0_15px_rgba(255,180,168,0.2)]"
        >
          <Plus size={18} />
          Add University
        </button>
      </div>

      {/* KPI Cards: Intentional Asymmetry */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Large Revenue Card */}
        <div className="md:col-span-2 bg-[#1c1b1b] border border-[#554240]/15 p-8 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#f0513e]/5 rounded-full blur-[80px] -mr-20 -mt-20 pointer-events-none transition-opacity group-hover:bg-[#f0513e]/10" />
          
          <div className="flex items-center justify-between mb-8 relative z-10">
            <div className="w-14 h-14 rounded-2xl bg-[#4c0000]/50 border border-[#f0513e]/20 text-[#ffb4a8] flex items-center justify-center shadow-inner">
              <IndianRupee size={28} />
            </div>
            <span className="text-[#ffb4a8] bg-[#4c0000]/30 px-3 py-1.5 rounded-lg label-premium">
              Global Gross
            </span>
          </div>
          <div className="relative z-10">
            <p className="label-premium mb-2">Total Platform Revenue</p>
            <p className="text-5xl font-display font-bold text-[#e5e2e1] tracking-tight">
              ₹{totalGlobalRevenue.toLocaleString()}
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
            <p className="label-premium mb-2">Total Orders</p>
            <p className="text-4xl font-display font-bold text-[#e5e2e1] tracking-tight">{totalGlobalOrders.toLocaleString()}</p>
          </div>
        </div>

        <div className="bg-[#1c1b1b] border border-[#554240]/15 p-8 rounded-2xl flex flex-col justify-between relative overflow-hidden">
          <div className="absolute bottom-0 right-0 w-32 h-32 bg-[#eac34a]/5 rounded-full blur-[50px] pointer-events-none" />
          <div className="flex items-center justify-between mb-6 relative z-10">
            <div className="w-12 h-12 rounded-xl bg-[#eac34a]/10 border border-[#eac34a]/20 text-[#eac34a] flex items-center justify-center">
              <Store size={24} />
            </div>
          </div>
          <div className="relative z-10">
            <p className="label-premium mb-2">Active Entities</p>
            <p className="text-4xl font-display font-bold text-[#e5e2e1] tracking-tight">{stats.length}</p>
          </div>
        </div>
      </div>

      {/* Universities list */}
      <div className="bg-[#1c1b1b] border border-[#554240]/15 rounded-2xl overflow-hidden mt-8">
        <div className="p-8 border-b border-[#554240]/15 bg-[#201f1f]">
          <h2 className="text-[#e5e2e1] font-display font-bold text-xl tracking-tight">Onboarded Institutions</h2>
          <p className="text-[#a38b88] text-sm mt-1">Manage and view analytics for individual universities.</p>
        </div>
        
        <div className="divide-y divide-[#554240]/15">
          {stats.length === 0 ? (
            <div className="p-12 text-center text-[#a38b88]">
               No universities onboarded yet.
            </div>
          ) : (
            stats.map((uni) => (
              <div 
                key={uni.id} 
                onClick={() => navigate(`/universities/${uni.id}`)}
                className="p-6 md:px-8 hover-ember bg-[#1c1b1b] hover:bg-[#201f1f] transition-all cursor-pointer flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
              >
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 rounded-2xl bg-[#131313] border border-[#554240]/20 overflow-hidden flex items-center justify-center flex-shrink-0 shadow-inner">
                    {uni.logo_url ? (
                      <img src={uni.logo_url} alt={uni.name} className="w-full h-full object-cover" />
                    ) : (
                      <Store className="text-[#554240]" size={24} />
                    )}
                  </div>
                  <div>
                    <h3 className="text-[#ffb4a8] font-display font-bold text-lg leading-tight mb-1">{uni.name}</h3>
                    <p className="text-[#a38b88] text-sm truncate max-w-[250px] lg:max-w-md">{uni.address}</p>
                  </div>
                </div>
                
                <div className="flex gap-10 md:text-right bg-[#131313]/50 p-4 rounded-xl border border-[#554240]/10 w-full md:w-auto">
                  <div>
                    <p className="label-premium mb-1">Orders</p>
                    <p className="text-[#e5e2e1] font-display font-semibold text-lg">{uni.total_orders}</p>
                  </div>
                  <div>
                    <p className="label-premium mb-1 text-[#eac34a]">Revenue</p>
                    <p className="text-[#eac34a] font-display font-bold text-lg tracking-tight">₹{Number(uni.total_revenue).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      
      {showModal && (
        <AddUniversityModal 
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false);
            fetchStats();
          }}
        />
      )}
    </div>
  );
}
