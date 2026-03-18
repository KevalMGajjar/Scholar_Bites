import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { ArrowLeft, IndianRupee, PieChart, ShoppingBag, Users } from 'lucide-react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement, BarElement } from 'chart.js';
import { Line, Doughnut } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement, BarElement);

interface Stats {
  orders_by_status: Record<string, number>;
  total_revenue: number;
  monthly_revenue: { month: string; revenue: number; orders: number }[];
  best_sellers: { name: string; image_url: string; price: number; total_sold: number; total_revenue: number }[];
  avg_order_value: number;
  orders_today: number;
  revenue_today: number;
  total_customers: number;
}

export default function UniversityAnalysis() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data } = await api.get(`/superadmin/universities/${id}/statistics`);
        setStats(data);
      } catch (error) {
        console.error('Failed to fetch university stats', error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!stats) return <div className="text-white p-8">Analysis unavailable.</div>;

  const lineChartData = {
    labels: stats.monthly_revenue.map((m) => m.month),
    datasets: [
      {
        label: 'Revenue (₹)',
        data: stats.monthly_revenue.map((m) => m.revenue),
        borderColor: '#818cf8',
        backgroundColor: 'rgba(129, 140, 248, 0.5)',
        tension: 0.4,
      },
    ],
  };

  const statusColors: Record<string, string> = {
    pending: '#f59e0b',
    preparing: '#3b82f6',
    ready: '#10b981',
    completed: '#6366f1',
    cancelled: '#ef4444',
  };

  const doughnutData = {
    labels: Object.keys(stats.orders_by_status).map(l => l.toUpperCase()),
    datasets: [
      {
        data: Object.values(stats.orders_by_status),
        backgroundColor: Object.keys(stats.orders_by_status).map((s) => statusColors[s] || '#fff'),
        borderWidth: 0,
      },
    ],
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white">Deep Performance Analysis</h1>
          <p className="text-slate-400">Detailed historical insight for selected university</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50">
          <div className="text-emerald-400 mb-2"><IndianRupee size={24} /></div>
          <p className="text-slate-400 text-sm">Today's Revenue</p>
          <p className="text-3xl font-bold text-white">₹{stats.revenue_today.toLocaleString()}</p>
        </div>
        <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50">
          <div className="text-indigo-400 mb-2"><ShoppingBag size={24} /></div>
          <p className="text-slate-400 text-sm">Today's Orders</p>
          <p className="text-3xl font-bold text-white">{stats.orders_today.toLocaleString()}</p>
        </div>
        <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50">
          <div className="text-purple-400 mb-2"><PieChart size={24} /></div>
          <p className="text-slate-400 text-sm">Avg Order Value</p>
          <p className="text-3xl font-bold text-white">₹{stats.avg_order_value}</p>
        </div>
        <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50">
          <div className="text-blue-400 mb-2"><Users size={24} /></div>
          <p className="text-slate-400 text-sm">Total Customers</p>
          <p className="text-3xl font-bold text-white">{stats.total_customers.toLocaleString()}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50">
          <h2 className="text-lg font-bold text-white mb-6">Revenue Trajectory (6 Months)</h2>
          <div className="h-[300px]">
            <Line 
              data={lineChartData} 
              options={{ maintainAspectRatio: false, scales: { y: { grid: { color: '#334155' } }, x: { grid: { color: '#334155' } } }, plugins: { legend: { display: false } } }} 
            />
          </div>
        </div>
        
        <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50">
          <h2 className="text-lg font-bold text-white mb-6">Order Status Ratio</h2>
          <div className="h-[300px] flex items-center justify-center">
            <Doughnut 
              data={doughnutData} 
              options={{ maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8' } } } }} 
            />
          </div>
        </div>
      </div>

      <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50">
        <h2 className="text-lg font-bold text-white mb-6">Top 5 Best Selling Items</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {stats.best_sellers.map((item, idx) => (
            <div key={idx} className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/30">
              <div className="aspect-square rounded-lg bg-slate-800 overflow-hidden flex items-center justify-center mb-4">
                {item.image_url ? (
                   <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                ) : (
                   <span className="text-slate-600 font-bold">{idx + 1}</span>
                )}
              </div>
              <h3 className="text-white font-medium truncate mb-1">{item.name}</h3>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400">{item.total_sold} sold</span>
                <span className="text-emerald-400 font-medium">₹{item.total_revenue}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
