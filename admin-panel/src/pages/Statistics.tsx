import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useRestaurant } from '../context/RestaurantContext';
import RestaurantFilter from '../components/RestaurantFilter';
import { Package, IndianRupee, LineChart, Users, Trophy, Utensils, Clock, TrendingUp } from 'lucide-react';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Filler, Legend,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Filler, Legend);

interface Stats {
  orders_by_status: Record<string, number>;
  total_revenue: number;
  monthly_revenue: { month: string; revenue: number; orders: number }[];
  best_sellers: { name: string; image_url: string; price: number; total_sold: number; total_revenue: number }[];
  avg_order_value: number;
  orders_today: number;
  revenue_today: number;
  total_customers: number;
  daily_orders: { label: string; date: string; orders: number; revenue: number }[];
  peak_hours: { hour: number; orders: number }[];
}


export default function Statistics() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const { selectedRestaurantId } = useRestaurant();

  const fetchStats = useCallback(async () => {
    try {
      const params: any = {};
      if (selectedRestaurantId) params.restaurant_id = selectedRestaurantId;
      const res = await api.get('/admin/statistics', { params });
      setStats(res.data);
    }
    catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [selectedRestaurantId]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  if (loading || !stats) {
    return <div className="flex justify-center items-center h-full min-h-screen"><div className="animate-spin w-6 h-6 border-2 border-indigo-500/40 border-t-indigo-500 rounded-full" /></div>;
  }

  const totalOrders = Object.values(stats.orders_by_status).reduce((a, b) => a + b, 0);

  return (
    <div className="p-8 space-y-8 animate-fade-in">
      {/* ── Header ── */}
      <div className="animate-fade-up flex items-end justify-between">
        <div>
          <h1 className="text-[28px] font-extrabold text-white tracking-[-0.03em]">Dashboard</h1>
          <p className="text-slate-500 text-[14px] font-medium mt-1">Overview of your business performance</p>
        </div>
        <RestaurantFilter />
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 stagger-children">
        <MetricCard icon={<Package size={20} />} label="Total Orders" value={totalOrders.toLocaleString()} accent="blue" />
        <MetricCard icon={<IndianRupee size={20} />} label="Total Revenue" value={`₹${stats.total_revenue.toLocaleString()}`} accent="emerald" />
        <MetricCard icon={<LineChart size={20} />} label="Avg Order" value={`₹${stats.avg_order_value.toFixed(0)}`} accent="violet" />
        <MetricCard icon={<Users size={20} />} label="Customers" value={stats.total_customers.toLocaleString()} accent="amber" />
      </div>

      {/* ── 7-Day Orders Trend + Peak Hours ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Orders Trend – spans 3 cols */}
        <div className="lg:col-span-3 bg-white/[0.02] border border-white/[0.04] rounded-3xl p-8 hover-lift animate-fade-up" style={{ animationDelay: '250ms' }}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400"><TrendingUp size={18} /></div>
              <h3 className="text-[14px] font-bold text-white tracking-[-0.01em]">Orders This Week</h3>
            </div>
            <span className="text-indigo-400 text-[10px] font-bold bg-indigo-500/8 px-2.5 py-1 rounded-lg border border-indigo-500/15 uppercase tracking-widest">7 days</span>
          </div>
          <div className="h-52">
            <Line
              data={{
                labels: stats.daily_orders.map(d => d.label),
                datasets: [
                  {
                    label: 'Orders', data: stats.daily_orders.map(d => d.orders),
                    borderColor: '#818cf8', backgroundColor: (ctx) => {
                      const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, 220);
                      g.addColorStop(0, 'rgba(99,102,241,0.15)'); g.addColorStop(1, 'rgba(99,102,241,0)');
                      return g;
                    },
                    borderWidth: 2.5, pointBackgroundColor: '#060810', pointBorderColor: '#818cf8',
                    pointBorderWidth: 2, pointRadius: 5, pointHoverRadius: 8, fill: true, tension: 0.4,
                    yAxisID: 'y',
                  },
                  {
                    label: 'Revenue (₹)', data: stats.daily_orders.map(d => d.revenue),
                    borderColor: '#34d399', borderWidth: 1.5, borderDash: [5, 4],
                    pointRadius: 0, pointHoverRadius: 5, pointBackgroundColor: '#060810', pointBorderColor: '#34d399',
                    fill: false, tension: 0.4,
                    yAxisID: 'y1',
                  },
                ],
              }}
              options={{
                responsive: true, maintainAspectRatio: false,
                plugins: {
                  legend: { display: true, position: 'top', align: 'end', labels: { boxWidth: 8, boxHeight: 8, usePointStyle: true, pointStyle: 'circle', color: '#64748b', font: { size: 10, weight: 'bold' }, padding: 16 } },
                  tooltip: { backgroundColor: 'rgba(6,8,16,0.95)', titleColor: '#f1f5f9', bodyColor: '#cbd5e1', padding: 12, cornerRadius: 10, displayColors: true, boxWidth: 8, boxHeight: 8, usePointStyle: true },
                },
                scales: {
                  x: { grid: { display: false }, border: { display: false }, ticks: { color: '#475569', font: { size: 11, weight: 500 } } },
                  y: { position: 'left', grid: { color: 'rgba(255,255,255,0.03)' }, border: { display: false }, ticks: { color: '#818cf8', font: { size: 10, weight: 500 }, stepSize: 1 }, beginAtZero: true },
                  y1: { position: 'right', grid: { display: false }, border: { display: false }, ticks: { color: '#34d399', font: { size: 10, weight: 500 }, callback: (v) => `₹${Number(v) >= 1000 ? (Number(v)/1000).toFixed(1) + 'k' : v}` }, beginAtZero: true },
                },
                interaction: { intersect: false, mode: 'index' },
              }}
            />
          </div>
        </div>

        {/* Peak Hours – spans 2 cols */}
        <div className="lg:col-span-2 bg-white/[0.02] border border-white/[0.04] rounded-3xl p-8 hover-lift animate-fade-up" style={{ animationDelay: '350ms' }}>
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 rounded-xl bg-violet-500/10 text-violet-400"><Clock size={18} /></div>
            <h3 className="text-[14px] font-bold text-white tracking-[-0.01em]">Peak Hours</h3>
          </div>
          <div className="h-52">
            <Bar
              data={{
                labels: stats.peak_hours.filter((_, i) => i >= 7 && i <= 22).map(h => {
                  const hr = h.hour % 12 || 12;
                  return `${hr}${h.hour < 12 ? 'a' : 'p'}`;
                }),
                datasets: [{
                  label: 'Orders',
                  data: stats.peak_hours.filter((_, i) => i >= 7 && i <= 22).map(h => h.orders),
                  backgroundColor: stats.peak_hours.filter((_, i) => i >= 7 && i <= 22).map(h => {
                    const maxOrders = Math.max(...stats.peak_hours.map(p => p.orders), 1);
                    const intensity = h.orders / maxOrders;
                    return `rgba(139, 92, 246, ${0.15 + intensity * 0.55})`;
                  }),
                  borderColor: 'rgba(139, 92, 246, 0.3)',
                  borderWidth: 1,
                  borderRadius: 6,
                  borderSkipped: false,
                }],
              }}
              options={{
                responsive: true, maintainAspectRatio: false,
                plugins: {
                  legend: { display: false },
                  tooltip: { backgroundColor: 'rgba(6,8,16,0.95)', titleColor: '#f1f5f9', bodyColor: '#cbd5e1', padding: 12, cornerRadius: 10, displayColors: false, callbacks: { title: (items) => { const idx = items[0].dataIndex + 7; const hr = idx % 12 || 12; return `${hr}:00 ${idx < 12 ? 'AM' : 'PM'}`; }, label: (ctx) => `${ctx.raw} orders` } },
                },
                scales: {
                  x: { grid: { display: false }, border: { display: false }, ticks: { color: '#475569', font: { size: 9, weight: 500 } } },
                  y: { grid: { color: 'rgba(255,255,255,0.03)' }, border: { display: false }, ticks: { color: '#475569', font: { size: 10, weight: 500 }, stepSize: 1 }, beginAtZero: true },
                },
              }}
            />
          </div>
        </div>
      </div>

      {/* ── Revenue Chart ── */}
      {stats.monthly_revenue.length > 0 && (
        <div className="bg-white/[0.02] border border-white/[0.04] rounded-3xl p-8 hover-lift animate-fade-up" style={{ animationDelay: '300ms' }}>
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-[16px] font-bold text-white tracking-[-0.02em]">Revenue Growth</h3>
            <span className="text-indigo-400 text-[11px] font-bold bg-indigo-500/8 px-3 py-1.5 rounded-xl border border-indigo-500/15">Last 6 months</span>
          </div>
          <div className="h-72 w-full">
            <Line
              data={{
                labels: stats.monthly_revenue.map(m => m.month.split(' ')[0]),
                datasets: [{
                  label: 'Revenue (₹)', data: stats.monthly_revenue.map(m => m.revenue),
                  borderColor: '#818cf8',
                  backgroundColor: (context) => {
                    const ctx = context.chart.ctx;
                    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
                    gradient.addColorStop(0, 'rgba(99, 102, 241, 0.15)');
                    gradient.addColorStop(1, 'rgba(99, 102, 241, 0)');
                    return gradient;
                  },
                  borderWidth: 2.5, pointBackgroundColor: '#060810', pointBorderColor: '#818cf8', pointBorderWidth: 2, pointRadius: 4, pointHoverRadius: 7, fill: true, tension: 0.4,
                }]
              }}
              options={{
                responsive: true, maintainAspectRatio: false,
                plugins: {
                  legend: { display: false },
                  tooltip: { backgroundColor: 'rgba(6, 8, 16, 0.95)', titleColor: '#f1f5f9', bodyColor: '#cbd5e1', bodyFont: { weight: 'bold' }, padding: 14, cornerRadius: 12, displayColors: false, callbacks: { label: (ctx) => `₹${ctx.raw?.toLocaleString()}` } }
                },
                scales: {
                  x: { grid: { display: false }, border: { display: false }, ticks: { color: '#475569', font: { family: 'Inter', weight: 500, size: 11 } } },
                  y: { grid: { color: 'rgba(255,255,255,0.03)' }, border: { display: false }, ticks: { color: '#475569', font: { family: 'Inter', weight: 500, size: 11 }, callback: (v) => `₹${Number(v) >= 1000 ? (Number(v)/1000).toFixed(1) + 'k' : v}` }, beginAtZero: true }
                },
                interaction: { intersect: false, mode: 'index' },
              }}
            />
          </div>
        </div>
      )}

      {/* ── Best Sellers ── */}
      {stats.best_sellers.length > 0 && (
        <div className="bg-white/[0.02] border border-white/[0.04] rounded-3xl p-8 hover-lift animate-fade-up" style={{ animationDelay: '400ms' }}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400"><Trophy size={18} /></div>
              <h3 className="text-[16px] font-bold text-white tracking-[-0.02em]">Top Sellers</h3>
            </div>
            <span className="text-slate-600 text-[10px] font-bold uppercase tracking-widest">By quantity sold</span>
          </div>
          <div className="space-y-3 stagger-children">
            {stats.best_sellers.map((item, i) => (
              <div key={i} className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] hover:border-white/[0.08] transition-all duration-200 group">
                <div className="w-9 h-9 rounded-xl bg-amber-500/8 border border-amber-500/12 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                  <span className="text-amber-400 font-extrabold text-[12px]">#{i + 1}</span>
                </div>
                {item.image_url ? (
                  <img src={item.image_url} alt={item.name} className="w-11 h-11 rounded-xl object-cover shrink-0 ring-1 ring-white/[0.06]" />
                ) : (
                  <div className="w-11 h-11 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center shrink-0"><Utensils size={16} className="text-slate-700" /></div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-white text-[13px] font-bold truncate">{item.name}</p>
                  <p className="text-slate-600 text-[11px] mt-0.5">₹{item.price.toFixed(0)} <span className="opacity-60">each</span></p>
                </div>
                <div className="text-right flex flex-col items-end gap-1">
                  <span className="px-2 py-0.5 rounded-lg bg-indigo-500/8 text-indigo-400 text-[10px] font-bold tracking-wider uppercase border border-indigo-500/15">{item.total_sold} Sold</span>
                  <p className="text-emerald-400 text-[14px] font-extrabold tracking-[-0.01em]">₹{item.total_revenue.toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent: string }) {
  const accentMap: Record<string, string> = {
    blue: 'text-blue-400 bg-blue-500/8 border-blue-500/12',
    emerald: 'text-emerald-400 bg-emerald-500/8 border-emerald-500/12',
    violet: 'text-violet-400 bg-violet-500/8 border-violet-500/12',
    amber: 'text-amber-400 bg-amber-500/8 border-amber-500/12',
  };
  const colorCls = accentMap[accent] || accentMap.blue;
  const textColorMap: Record<string, string> = { blue: 'text-blue-400', emerald: 'text-emerald-400', violet: 'text-violet-400', amber: 'text-amber-400' };

  return (
    <div className="bg-white/[0.02] border border-white/[0.04] rounded-3xl p-6 relative overflow-hidden hover-lift group">
      <div className={`w-10 h-10 rounded-xl ${colorCls} border flex items-center justify-center mb-5`}>{icon}</div>
      <p className="text-slate-600 text-[10px] font-bold tracking-widest uppercase mb-1.5">{label}</p>
      <p className={`text-[26px] font-extrabold tracking-[-0.03em] ${textColorMap[accent] || 'text-white'}`}>{value}</p>
    </div>
  );
}
