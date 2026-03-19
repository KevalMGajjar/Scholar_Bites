import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { Package, IndianRupee, LineChart, Users, Flame, Trophy, Utensils } from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend
);

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

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  preparing: '#3b82f6',
  ready: '#10b981',
  completed: '#6b7280',
  cancelled: '#ef4444',
};

export default function Statistics() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get('/admin/statistics');
      setStats(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  if (loading || !stats) {
    return (
      <div className="flex justify-center items-center h-full min-h-screen">
        <div className="animate-spin w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const totalOrders = Object.values(stats.orders_by_status).reduce((a, b) => a + b, 0);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-slate-400 text-sm mt-1">Overview of your business performance</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <SummaryCard icon={<Package size={24} className="text-blue-400" />} label="Total Orders" value={totalOrders.toLocaleString()} color="from-blue-500/10 to-blue-600/5" textColor="text-blue-400" />
        <SummaryCard icon={<IndianRupee size={24} className="text-emerald-400" />} label="Total Revenue" value={`₹${stats.total_revenue.toLocaleString()}`} color="from-emerald-500/10 to-emerald-600/5" textColor="text-emerald-400" />
        <SummaryCard icon={<LineChart size={24} className="text-violet-400" />} label="Avg Order Value" value={`₹${stats.avg_order_value.toFixed(0)}`} color="from-violet-500/10 to-violet-600/5" textColor="text-violet-400" />
        <SummaryCard icon={<Users size={24} className="text-amber-400" />} label="Total Customers" value={stats.total_customers.toLocaleString()} color="from-amber-500/10 to-amber-600/5" textColor="text-amber-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-amber-500/20 rounded-3xl p-8 shadow-xl relative overflow-hidden group">
          <div className="absolute -top-10 -right-10 text-amber-500/10 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-12">
            <Flame size={180} />
          </div>
          <div className="flex items-center gap-3 mb-4 relative z-10">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-500">
              <Flame size={20} />
            </div>
            <span className="text-slate-300 text-sm font-bold tracking-wide uppercase">Today</span>
          </div>
          <div className="flex items-baseline gap-4">
            <div>
              <p className="text-3xl font-bold text-white">{stats.orders_today}</p>
              <p className="text-slate-500 text-xs">orders</p>
            </div>
            <div className="w-px h-10 bg-slate-700" />
            <div>
              <p className="text-3xl font-bold text-amber-400">₹{stats.revenue_today.toLocaleString()}</p>
              <p className="text-slate-500 text-xs">revenue</p>
            </div>
          </div>
        </div>

        {/* Order Status Breakdown */}
        <div className="bg-slate-900/40 backdrop-blur-md border border-slate-700/50 rounded-3xl p-8 shadow-xl">
          <h3 className="text-white font-bold text-lg mb-5 tracking-tight">Order Status Overview</h3>
          <div className="space-y-2">
            {Object.entries(stats.orders_by_status).map(([status, count]) => (
              <div key={status} className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[status] || '#666' }} />
                <span className="text-slate-300 text-sm capitalize flex-1 font-medium">{status}</span>
                <span className="text-white text-sm font-bold bg-slate-800/80 px-3 py-1 rounded-lg border border-slate-700/50 shadow-sm">{count}</span>
                <div className="w-24 h-2 rounded-full bg-slate-800 overflow-hidden shadow-inner">
                  <div className="h-full rounded-full transition-all duration-1000 ease-out" style={{
                    width: `${totalOrders > 0 ? (count / totalOrders) * 100 : 0}%`,
                    backgroundColor: STATUS_COLORS[status] || '#666',
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Monthly Revenue Chart */}
      {stats.monthly_revenue.length > 0 && (
        <div className="bg-slate-900/40 backdrop-blur-md border border-slate-700/50 rounded-3xl p-8 shadow-xl">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-white font-bold text-lg tracking-tight">Revenue Growth</h3>
            <span className="text-indigo-400 text-xs font-bold bg-indigo-500/10 px-3 py-1.5 rounded-xl border border-indigo-500/20">Last 6 months</span>
          </div>
          <div className="h-72 w-full">
            <Line
              data={{
                labels: stats.monthly_revenue.map(m => m.month.split(' ')[0]),
                datasets: [
                  {
                    label: 'Revenue (₹)',
                    data: stats.monthly_revenue.map(m => m.revenue),
                    borderColor: '#818cf8', // indigo-400
                    backgroundColor: (context) => {
                      const ctx = context.chart.ctx;
                      const gradient = ctx.createLinearGradient(0, 0, 0, 300);
                      gradient.addColorStop(0, 'rgba(99, 102, 241, 0.3)'); // indigo-500
                      gradient.addColorStop(1, 'rgba(99, 102, 241, 0)');
                      return gradient;
                    },
                    borderWidth: 3,
                    pointBackgroundColor: '#1e293b',
                    pointBorderColor: '#818cf8',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    fill: true,
                    tension: 0.4, // smooth lines
                  }
                ]
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleColor: '#f1f5f9',
                    bodyColor: '#cbd5e1',
                    bodyFont: { weight: 'bold' },
                    padding: 12,
                    cornerRadius: 8,
                    displayColors: false,
                    callbacks: {
                      label: (context) => `₹${context.raw?.toLocaleString()}`
                    }
                  }
                },
                scales: {
                  x: {
                    grid: { display: false },
                    border: { display: false },
                    ticks: { color: '#64748b', font: { family: 'inherit', weight: 500 } }
                  },
                  y: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)', tickLength: 0 },
                    border: { display: false },
                    ticks: {
                      color: '#64748b',
                      font: { family: 'inherit', weight: 500 },
                      callback: (value) => `₹${Number(value) >= 1000 ? (Number(value)/1000).toFixed(1) + 'k' : value}`
                    },
                    beginAtZero: true
                  }
                },
                interaction: {
                  intersect: false,
                  mode: 'index',
                },
              }}
            />
          </div>
        </div>
      )}

      {/* Best Sellers */}
      {stats.best_sellers.length > 0 && (
        <div className="bg-slate-900/40 backdrop-blur-md border border-slate-700/50 rounded-3xl p-8 shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-500">
                <Trophy size={20} />
              </div>
              <h3 className="text-white font-bold text-lg tracking-tight">Top Sellers</h3>
            </div>
            <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">By quantity sold</span>
          </div>
          <div className="space-y-4">
            {stats.best_sellers.map((item, i) => (
              <div key={i} className="flex items-center gap-4 p-4 rounded-2xl bg-slate-800/40 border border-slate-700/30 hover:bg-slate-800/80 hover:border-slate-600/50 transition-all shadow-sm group">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 shadow-inner group-hover:scale-110 transition-transform">
                  <span className="text-amber-400 font-black text-sm">#{i + 1}</span>
                </div>
                {item.image_url ? (
                  <img src={item.image_url} alt={item.name} className="w-12 h-12 rounded-xl object-cover shrink-0 shadow-md" />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700/50 flex items-center justify-center shrink-0 shadow-inner">
                    <Utensils size={20} className="text-slate-500" />
                  </div>
                )}
                <div className="flex-1 min-w-0 pr-4">
                  <p className="text-slate-200 text-sm font-bold truncate">{item.name}</p>
                  <p className="text-slate-500 text-xs mt-0.5 font-medium">₹{item.price.toFixed(0)} <span className="opacity-60">each</span></p>
                </div>
                <div className="text-right flex flex-col items-end">
                  <span className="px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-400 text-[10px] font-bold tracking-wider uppercase border border-indigo-500/20 mb-1">
                    {item.total_sold} Sold
                  </span>
                  <p className="text-emerald-400 text-sm font-black tracking-tight">₹{item.total_revenue.toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ icon, label, value, color, textColor }: {
  icon: React.ReactNode; label: string; value: string; color: string; textColor: string;
}) {
  return (
    <div className={`bg-gradient-to-br ${color} border border-slate-700/50 rounded-3xl p-6 relative overflow-hidden shadow-xl backdrop-blur-md group hover:-translate-y-1 transition-transform`}>
      <div className="absolute -top-6 -right-6 text-slate-800/10 transition-transform duration-500 group-hover:scale-110 opacity-30">
        {icon}
      </div>
      <div className="w-12 h-12 rounded-2xl bg-slate-900/50 border border-white/5 flex items-center justify-center mb-4 shadow-inner">
        {icon}
      </div>
      <p className="text-slate-400 text-xs font-bold tracking-widest uppercase mb-1.5">{label}</p>
      <p className={`text-3xl font-black tracking-tight ${textColor}`}>{value}</p>
    </div>
  );
}
