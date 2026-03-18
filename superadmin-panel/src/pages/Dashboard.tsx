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
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Platform Overview</h1>
          <p className="text-slate-400">High-level metrics across all onboarded institutions</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 transition font-medium"
        >
          <Plus size={20} />
          Add University
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-slate-800/50 border border-slate-700/50 p-6 rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <IndianRupee size={24} />
            </div>
            <span className="text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-lg text-sm font-medium">
              Global
            </span>
          </div>
          <p className="text-slate-400 text-sm mb-1">Total Platform Revenue</p>
          <p className="text-3xl font-bold text-white">₹{totalGlobalRevenue.toLocaleString()}</p>
        </div>

        <div className="bg-slate-800/50 border border-slate-700/50 p-6 rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
              <TrendingUp size={24} />
            </div>
            <span className="text-purple-400 bg-purple-500/10 px-2.5 py-1 rounded-lg text-sm font-medium">
              Global
            </span>
          </div>
          <p className="text-slate-400 text-sm mb-1">Total Platform Orders</p>
          <p className="text-3xl font-bold text-white">{totalGlobalOrders.toLocaleString()}</p>
        </div>

        <div className="bg-slate-800/50 border border-slate-700/50 p-6 rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Store size={24} />
            </div>
          </div>
          <p className="text-slate-400 text-sm mb-1">Active Universities</p>
          <p className="text-3xl font-bold text-white">{stats.length}</p>
        </div>
      </div>

      {/* Universities list */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-slate-700/50 flex justify-between items-center">
          <h2 className="text-white font-bold text-lg">Onboarded Institutions</h2>
        </div>
        <div className="divide-y divide-slate-700/50">
          {stats.map((uni) => (
             <div 
               key={uni.id} 
               onClick={() => navigate(`/universities/${uni.id}`)}
               className="p-6 flex items-center justify-between hover:bg-slate-700/20 transition cursor-pointer"
             >
               <div className="flex items-center gap-4">
                 <div className="w-12 h-12 rounded-xl bg-slate-700 overflow-hidden flex items-center justify-center flex-shrink-0">
                   {uni.logo_url ? (
                     <img src={uni.logo_url} alt={uni.name} className="w-full h-full object-cover" />
                   ) : (
                     <Store className="text-slate-400" />
                   )}
                 </div>
                 <div>
                   <h3 className="text-indigo-400 font-semibold mb-1">{uni.name}</h3>
                   <p className="text-slate-400 text-sm truncate max-w-sm">{uni.address}</p>
                 </div>
               </div>
               
               <div className="flex gap-12 text-right">
                 <div>
                   <p className="text-slate-400 text-xs mb-1 uppercase tracking-wider">Orders</p>
                   <p className="text-white font-medium">{uni.total_orders}</p>
                 </div>
                 <div>
                   <p className="text-slate-400 text-xs mb-1 uppercase tracking-wider">Revenue</p>
                   <p className="text-emerald-400 font-medium">₹{Number(uni.total_revenue).toLocaleString()}</p>
                 </div>
               </div>
             </div>
          ))}
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
