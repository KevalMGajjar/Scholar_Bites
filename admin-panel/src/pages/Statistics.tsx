import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useRestaurant } from '../context/RestaurantContext';
import RestaurantFilter from '../components/RestaurantFilter';
import { Package, IndianRupee, LineChart, Users, Trophy, Utensils, Clock, TrendingUp, Download, CalendarDays, ShoppingBag } from 'lucide-react';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement,
  ArcElement, Title, Tooltip, Filler, Legend,
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Filler, Legend);

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

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b', preparing: '#818cf8', ready: '#34d399', completed: '#3b82f6', cancelled: '#ef4444',
};

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
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [selectedRestaurantId]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const exportToExcel = () => {
    if (!stats) return;
    const wb = XLSX.utils.book_new();
    const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    const mostSold = stats.best_sellers.length > 0 ? stats.best_sellers[0] : null;

    // Helper: set column widths
    const setWidths = (ws: XLSX.WorkSheet, widths: number[]) => { ws['!cols'] = widths.map(w => ({ wch: w })); };

    // ── Summary Sheet ──
    const summaryData: any[][] = [
      ['CANTEEN ANALYTICS REPORT'],
      [`Generated: ${today}`],
      [],
      ['KEY METRICS', ''],
      ['Metric', 'Value'],
      ['Total Orders', Object.values(stats.orders_by_status).reduce((a, b) => a + b, 0)],
      ['Total Revenue (₹)', stats.total_revenue],
      ['Average Order Value (₹)', Math.round(stats.avg_order_value)],
      ['Total Unique Customers', stats.total_customers],
      ['Orders Today', stats.orders_today],
      ['Revenue Today (₹)', stats.revenue_today],
      [],
      ['MOST SOLD ITEM', ''],
      ['Item Name', mostSold?.name || 'N/A'],
      ['Unit Price (₹)', mostSold?.price || 0],
      ['Total Quantity Sold', mostSold?.total_sold || 0],
      ['Total Revenue (₹)', mostSold?.total_revenue || 0],
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    wsSummary['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } }];
    setWidths(wsSummary, [28, 20]);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

    // ── Order Status Sheet ──
    const statusData: any[][] = [
      ['ORDER STATUS BREAKDOWN'],
      [],
      ['Status', 'Count', 'Percentage'],
      ...Object.entries(stats.orders_by_status).map(([s, c]) => [
        s.charAt(0).toUpperCase() + s.slice(1), c,
        totalOrders > 0 ? `${((c / totalOrders) * 100).toFixed(1)}%` : '0%',
      ]),
      [],
      ['Total', totalOrders, '100%'],
    ];
    const wsStatus = XLSX.utils.aoa_to_sheet(statusData);
    wsStatus['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }];
    setWidths(wsStatus, [18, 12, 14]);
    XLSX.utils.book_append_sheet(wb, wsStatus, 'Order Status');

    // ── Daily Orders Sheet ──
    const dailyData: any[][] = [
      ['DAILY ORDERS — LAST 7 DAYS'],
      [],
      ['Day', 'Date', 'Orders', 'Revenue (₹)'],
      ...stats.daily_orders.map(d => [d.label, d.date, d.orders, d.revenue]),
      [],
      ['Total', '', stats.daily_orders.reduce((a, d) => a + d.orders, 0), stats.daily_orders.reduce((a, d) => a + d.revenue, 0)],
    ];
    const wsDaily = XLSX.utils.aoa_to_sheet(dailyData);
    wsDaily['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }];
    setWidths(wsDaily, [10, 14, 10, 16]);
    XLSX.utils.book_append_sheet(wb, wsDaily, 'Daily Orders');

    // ── Monthly Revenue Sheet ──
    const monthlyData: any[][] = [
      ['MONTHLY REVENUE — LAST 6 MONTHS'],
      [],
      ['Month', 'Revenue (₹)', 'Orders', 'Avg per Order (₹)'],
      ...stats.monthly_revenue.map(m => [m.month, m.revenue, m.orders, m.orders > 0 ? Math.round(m.revenue / m.orders) : 0]),
    ];
    const wsMonthly = XLSX.utils.aoa_to_sheet(monthlyData);
    wsMonthly['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }];
    setWidths(wsMonthly, [14, 16, 10, 18]);
    XLSX.utils.book_append_sheet(wb, wsMonthly, 'Monthly Revenue');

    // ── Top Sellers Sheet ──
    const sellersData: any[][] = [
      ['TOP SELLING ITEMS'],
      [],
      ['Rank', 'Item Name', 'Unit Price (₹)', 'Qty Sold', 'Total Revenue (₹)', '% of Revenue'],
      ...stats.best_sellers.map((b, i) => [
        i + 1, b.name, b.price, b.total_sold, b.total_revenue,
        stats.total_revenue > 0 ? `${((b.total_revenue / stats.total_revenue) * 100).toFixed(1)}%` : '0%',
      ]),
    ];
    const wsSellers = XLSX.utils.aoa_to_sheet(sellersData);
    wsSellers['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }];
    setWidths(wsSellers, [8, 28, 16, 12, 18, 14]);
    XLSX.utils.book_append_sheet(wb, wsSellers, 'Top Sellers');

    // ── Peak Hours Sheet ──
    const activeHours = stats.peak_hours.filter(h => h.orders > 0);
    const busiestHour = activeHours.reduce((a, b) => b.orders > a.orders ? b : a, { hour: 0, orders: 0 });
    const peakData: any[][] = [
      ['PEAK HOURS — LAST 30 DAYS'],
      [`Busiest Hour: ${busiestHour.hour % 12 || 12}:00 ${busiestHour.hour < 12 ? 'AM' : 'PM'} (${busiestHour.orders} orders)`],
      [],
      ['Hour', 'Orders'],
      ...activeHours.map(h => [`${h.hour % 12 || 12}:00 ${h.hour < 12 ? 'AM' : 'PM'}`, h.orders]),
    ];
    const wsPeak = XLSX.utils.aoa_to_sheet(peakData);
    wsPeak['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } }];
    setWidths(wsPeak, [16, 12]);
    XLSX.utils.book_append_sheet(wb, wsPeak, 'Peak Hours');

    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([buf], { type: 'application/octet-stream' }), `canteen-report-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  if (loading || !stats) {
    return <div className="flex justify-center items-center h-full min-h-screen"><div className="animate-spin w-6 h-6 border-2 border-indigo-500/40 border-t-indigo-500 rounded-full" /></div>;
  }

  const totalOrders = Object.values(stats.orders_by_status).reduce((a, b) => a + b, 0);
  const statusEntries = Object.entries(stats.orders_by_status).filter(([, v]) => v > 0);

  return (
    <div className="p-8 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="animate-fade-up flex items-end justify-between">
        <div>
          <h1 className="text-[28px] font-extrabold text-white tracking-[-0.03em]">Dashboard</h1>
          <p className="text-slate-500 text-[14px] font-medium mt-1">Overview of your business performance</p>
        </div>
        <div className="flex items-center gap-3">
          <RestaurantFilter />
          <button onClick={exportToExcel} className="px-4 py-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[12px] font-bold hover:bg-emerald-500/20 transition-all btn-press flex items-center gap-2">
            <Download size={14} /> Export Report
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
        <KpiCard icon={<Package size={20} />} label="Total Orders" value={totalOrders.toLocaleString()} sub={`${stats.orders_today} today`} accent="blue" />
        <KpiCard icon={<IndianRupee size={20} />} label="Total Revenue" value={`₹${stats.total_revenue.toLocaleString()}`} sub={`₹${stats.revenue_today.toLocaleString()} today`} accent="emerald" />
        <KpiCard icon={<LineChart size={20} />} label="Avg Order Value" value={`₹${stats.avg_order_value.toFixed(0)}`} accent="violet" />
        <KpiCard icon={<Users size={20} />} label="Total Customers" value={stats.total_customers.toLocaleString()} accent="amber" />
      </div>

      {/* Most Sold Item Highlight */}
      {stats.best_sellers.length > 0 && (
        <div className="bg-gradient-to-r from-amber-500/[0.06] to-orange-500/[0.04] border border-amber-500/15 rounded-3xl p-5 flex items-center gap-5 hover-lift animate-fade-up" style={{ animationDelay: '150ms' }}>
          <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center shrink-0">
            <Trophy size={22} className="text-amber-400" />
          </div>
          <div className="flex items-center gap-4 flex-1 min-w-0">
            {stats.best_sellers[0].image_url ? (
              <img src={stats.best_sellers[0].image_url} alt={stats.best_sellers[0].name} className="w-11 h-11 rounded-xl object-cover ring-2 ring-amber-500/20 shrink-0" />
            ) : (
              <div className="w-11 h-11 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center shrink-0"><Utensils size={16} className="text-slate-600" /></div>
            )}
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-amber-400/70 uppercase tracking-widest mb-0.5">🏆 Most Sold Item</p>
              <p className="text-white text-[15px] font-extrabold truncate tracking-[-0.01em]">{stats.best_sellers[0].name}</p>
            </div>
          </div>
          <div className="flex items-center gap-6 shrink-0">
            <div className="text-right">
              <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">Sold</p>
              <p className="text-indigo-400 text-[18px] font-extrabold">{stats.best_sellers[0].total_sold}</p>
            </div>
            <div className="w-px h-8 bg-white/[0.06]" />
            <div className="text-right">
              <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">Revenue</p>
              <p className="text-emerald-400 text-[18px] font-extrabold">₹{stats.best_sellers[0].total_revenue.toLocaleString()}</p>
            </div>
          </div>
        </div>
      )}

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 bg-white/[0.02] border border-white/[0.04] rounded-3xl p-6 hover-lift animate-fade-up" style={{ animationDelay: '200ms' }}>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400"><TrendingUp size={16} /></div>
              <h3 className="text-[13px] font-bold text-white">Orders This Week</h3>
            </div>
            <span className="text-indigo-400 text-[10px] font-bold bg-indigo-500/8 px-2.5 py-1 rounded-lg border border-indigo-500/15 uppercase tracking-widest">7 days</span>
          </div>
          <div className="h-48">
            <Line
              data={{
                labels: stats.daily_orders.map(d => d.label),
                datasets: [
                  {
                    label: 'Orders', data: stats.daily_orders.map(d => d.orders),
                    borderColor: '#818cf8', backgroundColor: (ctx) => { const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, 200); g.addColorStop(0, 'rgba(99,102,241,0.18)'); g.addColorStop(1, 'rgba(99,102,241,0)'); return g; },
                    borderWidth: 2.5, pointBackgroundColor: '#060810', pointBorderColor: '#818cf8', pointBorderWidth: 2, pointRadius: 4, pointHoverRadius: 7, fill: true, tension: 0.4, yAxisID: 'y',
                  },
                  {
                    label: 'Revenue (₹)', data: stats.daily_orders.map(d => d.revenue),
                    borderColor: '#34d399', borderWidth: 1.5, borderDash: [5, 4], pointRadius: 0, pointHoverRadius: 4, fill: false, tension: 0.4, yAxisID: 'y1',
                  },
                ],
              }}
              options={{
                responsive: true, maintainAspectRatio: false,
                plugins: {
                  legend: { display: true, position: 'top', align: 'end', labels: { boxWidth: 8, boxHeight: 8, usePointStyle: true, pointStyle: 'circle', color: '#64748b', font: { size: 10, weight: 'bold' }, padding: 16 } },
                  tooltip: { backgroundColor: 'rgba(6,8,16,0.95)', titleColor: '#f1f5f9', bodyColor: '#cbd5e1', padding: 12, cornerRadius: 10, displayColors: true, boxWidth: 8, usePointStyle: true },
                },
                scales: {
                  x: { grid: { display: false }, border: { display: false }, ticks: { color: '#475569', font: { size: 11, weight: 500 } } },
                  y: { position: 'left', grid: { color: 'rgba(255,255,255,0.03)' }, border: { display: false }, ticks: { color: '#818cf8', font: { size: 10 }, stepSize: 1 }, beginAtZero: true },
                  y1: { position: 'right', grid: { display: false }, border: { display: false }, ticks: { color: '#34d399', font: { size: 10 }, callback: (v) => `₹${Number(v) >= 1000 ? (Number(v)/1000).toFixed(1) + 'k' : v}` }, beginAtZero: true },
                },
                interaction: { intersect: false, mode: 'index' },
              }}
            />
          </div>
        </div>

        <div className="lg:col-span-2 bg-white/[0.02] border border-white/[0.04] rounded-3xl p-6 hover-lift animate-fade-up" style={{ animationDelay: '300ms' }}>
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 rounded-xl bg-violet-500/10 text-violet-400"><Clock size={16} /></div>
            <h3 className="text-[13px] font-bold text-white">Peak Hours</h3>
          </div>
          <div className="h-48">
            <Bar
              data={{
                labels: stats.peak_hours.filter((_, i) => i >= 7 && i <= 22).map(h => { const hr = h.hour % 12 || 12; return `${hr}${h.hour < 12 ? 'a' : 'p'}`; }),
                datasets: [{
                  label: 'Orders', data: stats.peak_hours.filter((_, i) => i >= 7 && i <= 22).map(h => h.orders),
                  backgroundColor: stats.peak_hours.filter((_, i) => i >= 7 && i <= 22).map(h => {
                    const max = Math.max(...stats.peak_hours.map(p => p.orders), 1);
                    return `rgba(139, 92, 246, ${0.15 + (h.orders / max) * 0.55})`;
                  }),
                  borderColor: 'rgba(139,92,246,0.3)', borderWidth: 1, borderRadius: 6, borderSkipped: false,
                }],
              }}
              options={{
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { backgroundColor: 'rgba(6,8,16,0.95)', titleColor: '#f1f5f9', bodyColor: '#cbd5e1', padding: 12, cornerRadius: 10, displayColors: false, callbacks: { title: (items) => { const idx = items[0].dataIndex + 7; const hr = idx % 12 || 12; return `${hr}:00 ${idx < 12 ? 'AM' : 'PM'}`; }, label: (ctx) => `${ctx.raw} orders` } } },
                scales: {
                  x: { grid: { display: false }, border: { display: false }, ticks: { color: '#475569', font: { size: 9, weight: 500 } } },
                  y: { grid: { color: 'rgba(255,255,255,0.03)' }, border: { display: false }, ticks: { color: '#475569', font: { size: 10 }, stepSize: 1 }, beginAtZero: true },
                },
              }}
            />
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Revenue Growth */}
        {stats.monthly_revenue.length > 0 && (
          <div className="bg-white/[0.02] border border-white/[0.04] rounded-3xl p-6 hover-lift animate-fade-up" style={{ animationDelay: '350ms' }}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400"><CalendarDays size={16} /></div>
                <h3 className="text-[13px] font-bold text-white">Revenue Growth</h3>
              </div>
              <span className="text-emerald-400 text-[10px] font-bold bg-emerald-500/8 px-2.5 py-1 rounded-lg border border-emerald-500/15 uppercase tracking-widest">6 months</span>
            </div>
            <div className="h-52">
              <Line
                data={{
                  labels: stats.monthly_revenue.map(m => m.month.split(' ')[0]),
                  datasets: [{
                    label: 'Revenue (₹)', data: stats.monthly_revenue.map(m => m.revenue),
                    borderColor: '#34d399',
                    backgroundColor: (ctx) => { const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, 220); g.addColorStop(0, 'rgba(52,211,153,0.15)'); g.addColorStop(1, 'rgba(52,211,153,0)'); return g; },
                    borderWidth: 2.5, pointBackgroundColor: '#060810', pointBorderColor: '#34d399', pointBorderWidth: 2, pointRadius: 4, pointHoverRadius: 7, fill: true, tension: 0.4,
                  }],
                }}
                options={{
                  responsive: true, maintainAspectRatio: false,
                  plugins: { legend: { display: false }, tooltip: { backgroundColor: 'rgba(6,8,16,0.95)', padding: 12, cornerRadius: 10, displayColors: false, callbacks: { label: (ctx) => `₹${ctx.raw?.toLocaleString()}` } } },
                  scales: {
                    x: { grid: { display: false }, border: { display: false }, ticks: { color: '#475569', font: { size: 11, weight: 500 } } },
                    y: { grid: { color: 'rgba(255,255,255,0.03)' }, border: { display: false }, ticks: { color: '#475569', font: { size: 10 }, callback: (v) => `₹${Number(v) >= 1000 ? (Number(v)/1000).toFixed(1) + 'k' : v}` }, beginAtZero: true },
                  },
                  interaction: { intersect: false, mode: 'index' },
                }}
              />
            </div>
          </div>
        )}

        {/* Order Status Breakdown */}
        <div className="bg-white/[0.02] border border-white/[0.04] rounded-3xl p-6 hover-lift animate-fade-up" style={{ animationDelay: '400ms' }}>
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400"><ShoppingBag size={16} /></div>
            <h3 className="text-[13px] font-bold text-white">Order Status</h3>
          </div>
          <div className="flex items-center gap-6">
            <div className="w-40 h-40 shrink-0">
              <Doughnut
                data={{
                  labels: statusEntries.map(([k]) => k.charAt(0).toUpperCase() + k.slice(1)),
                  datasets: [{
                    data: statusEntries.map(([, v]) => v),
                    backgroundColor: statusEntries.map(([k]) => STATUS_COLORS[k] || '#64748b'),
                    borderWidth: 0, hoverOffset: 6,
                  }],
                }}
                options={{
                  responsive: true, maintainAspectRatio: true, cutout: '68%',
                  plugins: { legend: { display: false }, tooltip: { backgroundColor: 'rgba(6,8,16,0.95)', padding: 10, cornerRadius: 8 } },
                }}
              />
            </div>
            <div className="flex-1 space-y-2.5">
              {statusEntries.map(([status, count]) => (
                <div key={status} className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: STATUS_COLORS[status] || '#64748b' }} />
                  <span className="text-slate-400 text-[12px] capitalize flex-1">{status}</span>
                  <span className="text-white text-[13px] font-bold">{count}</span>
                  <span className="text-slate-600 text-[11px] w-10 text-right">{totalOrders > 0 ? ((count / totalOrders) * 100).toFixed(0) : 0}%</span>
                </div>
              ))}
              <div className="pt-2 border-t border-white/[0.04] flex justify-between">
                <span className="text-slate-500 text-[11px] font-bold uppercase tracking-widest">Total</span>
                <span className="text-white text-[14px] font-extrabold">{totalOrders.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Top Sellers */}
      {stats.best_sellers.length > 0 && (
        <div className="bg-white/[0.02] border border-white/[0.04] rounded-3xl p-6 hover-lift animate-fade-up" style={{ animationDelay: '450ms' }}>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400"><Trophy size={16} /></div>
              <h3 className="text-[13px] font-bold text-white">Top Sellers</h3>
            </div>
            <span className="text-slate-600 text-[10px] font-bold uppercase tracking-widest">By quantity sold</span>
          </div>

          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 px-4 py-2 text-[10px] font-bold text-slate-600 uppercase tracking-widest border-b border-white/[0.04] mb-2">
            <div className="col-span-1">#</div>
            <div className="col-span-5">Item</div>
            <div className="col-span-2 text-right">Price</div>
            <div className="col-span-2 text-right">Sold</div>
            <div className="col-span-2 text-right">Revenue</div>
          </div>

          <div className="space-y-1.5 stagger-children">
            {stats.best_sellers.map((item, i) => {
              const rankColors = ['text-amber-400 bg-amber-500/10 border-amber-500/20', 'text-slate-300 bg-slate-500/10 border-slate-500/20', 'text-orange-400 bg-orange-500/10 border-orange-500/20'];
              return (
                <div key={i} className="grid grid-cols-12 gap-4 items-center p-3 rounded-2xl bg-white/[0.01] border border-transparent hover:bg-white/[0.03] hover:border-white/[0.06] transition-all group">
                  <div className="col-span-1">
                    <div className={`w-7 h-7 rounded-lg border flex items-center justify-center text-[11px] font-extrabold ${rankColors[i] || 'text-slate-500 bg-white/[0.03] border-white/[0.06]'}`}>
                      {i + 1}
                    </div>
                  </div>
                  <div className="col-span-5 flex items-center gap-3">
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.name} className="w-9 h-9 rounded-xl object-cover ring-1 ring-white/[0.06] shrink-0" />
                    ) : (
                      <div className="w-9 h-9 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center shrink-0"><Utensils size={14} className="text-slate-700" /></div>
                    )}
                    <span className="text-white text-[13px] font-semibold truncate">{item.name}</span>
                  </div>
                  <div className="col-span-2 text-right text-slate-400 text-[13px]">₹{item.price.toFixed(0)}</div>
                  <div className="col-span-2 text-right">
                    <span className="px-2 py-0.5 rounded-lg bg-indigo-500/8 text-indigo-400 text-[11px] font-bold border border-indigo-500/15">{item.total_sold}</span>
                  </div>
                  <div className="col-span-2 text-right text-emerald-400 text-[14px] font-extrabold">₹{item.total_revenue.toLocaleString()}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({ icon, label, value, sub, accent }: { icon: React.ReactNode; label: string; value: string; sub?: string; accent: string }) {
  const styles: Record<string, { icon: string; text: string; glow: string }> = {
    blue: { icon: 'text-blue-400 bg-blue-500/8 border-blue-500/12', text: 'text-blue-400', glow: 'shadow-blue-500/5' },
    emerald: { icon: 'text-emerald-400 bg-emerald-500/8 border-emerald-500/12', text: 'text-emerald-400', glow: 'shadow-emerald-500/5' },
    violet: { icon: 'text-violet-400 bg-violet-500/8 border-violet-500/12', text: 'text-violet-400', glow: 'shadow-violet-500/5' },
    amber: { icon: 'text-amber-400 bg-amber-500/8 border-amber-500/12', text: 'text-amber-400', glow: 'shadow-amber-500/5' },
  };
  const s = styles[accent] || styles.blue;

  return (
    <div className={`bg-white/[0.02] border border-white/[0.04] rounded-3xl p-5 relative overflow-hidden hover-lift group shadow-lg ${s.glow}`}>
      <div className={`w-9 h-9 rounded-xl ${s.icon} border flex items-center justify-center mb-4`}>{icon}</div>
      <p className="text-slate-600 text-[10px] font-bold tracking-widest uppercase mb-1">{label}</p>
      <p className={`text-[24px] font-extrabold tracking-[-0.03em] ${s.text}`}>{value}</p>
      {sub && <p className="text-slate-600 text-[11px] mt-1 font-medium">{sub}</p>}
    </div>
  );
}
