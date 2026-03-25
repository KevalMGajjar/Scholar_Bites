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
      <div className="flex h-screen items-center justify-center bg-[#131313]">
        <div className="animate-spin w-8 h-8 flex border-2 border-[#f0513e] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!stats) return <div className="text-[#e5e2e1] p-8 font-body">Analysis unavailable.</div>;

  const lineChartData = {
    labels: stats.monthly_revenue.map((m) => m.month),
    datasets: [
      {
        label: 'Revenue (₹)',
        data: stats.monthly_revenue.map((m) => m.revenue),
        borderColor: '#f0513e',
        backgroundColor: 'rgba(240, 81, 62, 0.2)',
        tension: 0.4,
        fill: true,
      },
    ],
  };

  const statusColors: Record<string, string> = {
    pending: '#eac34a',
    preparing: '#ffb4a8',
    ready: '#f0513e',
    completed: '#4c0000',
    cancelled: '#93000a',
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
    <div className="p-8 lg:p-12 max-w-7xl mx-auto space-y-10 animate-fade-up font-body">
      <div className="flex items-center gap-6 mb-8">
        <button 
          onClick={() => navigate(-1)} 
          className="w-12 h-12 rounded-xl bg-[#1c1b1b] border border-[#554240]/20 flex items-center justify-center text-[#a38b88] hover:text-[#e5e2e1] hover:bg-[#201f1f] transition-all shadow-inner"
        >
          <ArrowLeft size={22} />
        </button>
        <div>
          <h1 className="text-3xl lg:text-4xl font-display font-bold text-[#e5e2e1] tracking-tight mb-1">Deep Performance Analysis</h1>
          <p className="text-[#a38b88] text-sm font-medium">Detailed historical insight for selected university</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-[#1c1b1b] p-8 rounded-2xl border border-[#554240]/15 hover-ember transition-all relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#eac34a]/10 rounded-full blur-[40px] -mr-10 -mt-10 pointer-events-none group-hover:bg-[#eac34a]/20 transition-all" />
          <div className="w-12 h-12 rounded-xl bg-[#eac34a]/10 border border-[#eac34a]/20 text-[#eac34a] flex items-center justify-center mb-6 relative z-10">
            <IndianRupee size={24} />
          </div>
          <div className="relative z-10">
            <p className="label-premium mb-2">Today's Revenue</p>
            <p className="text-4xl font-display font-bold text-[#e5e2e1] tracking-tight">₹{stats.revenue_today.toLocaleString()}</p>
          </div>
        </div>

        <div className="bg-[#1c1b1b] p-8 rounded-2xl border border-[#554240]/15 hover-ember transition-all relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#ffb4a8]/10 rounded-full blur-[40px] -mr-10 -mt-10 pointer-events-none group-hover:bg-[#ffb4a8]/20 transition-all" />
          <div className="w-12 h-12 rounded-xl bg-[#ffb4a8]/10 border border-[#ffb4a8]/20 text-[#ffb4a8] flex items-center justify-center mb-6 relative z-10">
            <ShoppingBag size={24} />
          </div>
          <div className="relative z-10">
            <p className="label-premium mb-2">Today's Orders</p>
            <p className="text-4xl font-display font-bold text-[#e5e2e1] tracking-tight">{stats.orders_today.toLocaleString()}</p>
          </div>
        </div>

        <div className="bg-[#1c1b1b] p-8 rounded-2xl border border-[#554240]/15 hover-ember transition-all relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#f0513e]/10 rounded-full blur-[40px] -mr-10 -mt-10 pointer-events-none group-hover:bg-[#f0513e]/20 transition-all" />
          <div className="w-12 h-12 rounded-xl bg-[#f0513e]/10 border border-[#f0513e]/20 text-[#f0513e] flex items-center justify-center mb-6 relative z-10">
            <PieChart size={24} />
          </div>
          <div className="relative z-10">
            <p className="label-premium mb-2">Avg Order Value</p>
            <p className="text-4xl font-display font-bold text-[#e5e2e1] tracking-tight">₹{stats.avg_order_value}</p>
          </div>
        </div>

        <div className="bg-[#1c1b1b] p-8 rounded-2xl border border-[#554240]/15 hover-ember transition-all relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#4c0000]/30 rounded-full blur-[40px] -mr-10 -mt-10 pointer-events-none group-hover:bg-[#4c0000]/50 transition-all" />
          <div className="w-12 h-12 rounded-xl bg-[#4c0000]/50 border border-[#f0513e]/20 text-[#ffb4a8] flex items-center justify-center mb-6 relative z-10 shadow-inner">
            <Users size={24} />
          </div>
          <div className="relative z-10">
            <p className="label-premium mb-2">Total Customers</p>
            <p className="text-4xl font-display font-bold text-[#e5e2e1] tracking-tight">{stats.total_customers.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-[#1c1b1b] p-8 rounded-2xl border border-[#554240]/15 shadow-xl">
          <h2 className="text-xl font-display font-bold text-[#e5e2e1] mb-6 tracking-tight">Revenue Trajectory (6 Months)</h2>
          <div className="h-[300px]">
            <Line 
              data={lineChartData} 
              options={{ 
                maintainAspectRatio: false, 
                scales: { 
                  y: { grid: { color: 'rgba(85, 66, 64, 0.2)' }, ticks: { color: '#a38b88', font: { family: 'Inter' } } }, 
                  x: { grid: { color: 'rgba(85, 66, 64, 0.2)' }, ticks: { color: '#a38b88', font: { family: 'Inter' } } } 
                }, 
                plugins: { legend: { display: false } } 
              }} 
            />
          </div>
        </div>
        
        <div className="bg-[#1c1b1b] p-8 rounded-2xl border border-[#554240]/15 shadow-xl">
          <h2 className="text-xl font-display font-bold text-[#e5e2e1] mb-6 tracking-tight">Order Status Ratio</h2>
          <div className="h-[300px] flex items-center justify-center">
            <Doughnut 
              data={doughnutData} 
              options={{ 
                maintainAspectRatio: false, 
                plugins: { legend: { position: 'bottom', labels: { color: '#a38b88', font: { family: 'Inter' }, padding: 20 } } } 
              }} 
            />
          </div>
        </div>
      </div>

      <div className="bg-[#1c1b1b] p-8 rounded-2xl border border-[#554240]/15 shadow-xl">
        <h2 className="text-xl font-display font-bold text-[#e5e2e1] mb-8 tracking-tight">Top 5 Best Selling Items</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          {stats.best_sellers.map((item, idx) => (
            <div key={idx} className="bg-[#131313] rounded-2xl p-5 border border-[#554240]/20 hover:-translate-y-1 hover:shadow-[0_10px_30px_rgba(240,81,62,0.1)] transition-all duration-300">
              <div className="aspect-square rounded-xl bg-[#201f1f] border border-[#554240]/10 overflow-hidden flex items-center justify-center mb-5 relative group">
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity z-10" />
                {item.image_url ? (
                   <img src={item.image_url} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                ) : (
                   <span className="text-[#a38b88] font-display font-bold text-3xl opacity-50">{idx + 1}</span>
                )}
              </div>
              <h3 className="text-[#e5e2e1] font-display font-semibold truncate mb-2 text-lg">{item.name}</h3>
              <div className="flex justify-between items-center text-sm font-medium">
                <span className="text-[#a38b88] bg-[#1c1b1b] px-2.5 py-1 rounded-md border border-[#554240]/20">{item.total_sold} sold</span>
                <span className="text-[#eac34a]">₹{item.total_revenue}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
