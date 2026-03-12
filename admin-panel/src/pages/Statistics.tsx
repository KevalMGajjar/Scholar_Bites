import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

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
  const maxMonthlyRevenue = Math.max(...stats.monthly_revenue.map(m => m.revenue), 1);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-slate-400 text-sm mt-1">Overview of your business performance</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard icon="📦" label="Total Orders" value={totalOrders.toLocaleString()} color="from-blue-500/20 to-blue-600/10" textColor="text-blue-400" />
        <SummaryCard icon="💰" label="Total Revenue" value={`₹${stats.total_revenue.toLocaleString()}`} color="from-emerald-500/20 to-emerald-600/10" textColor="text-emerald-400" />
        <SummaryCard icon="📊" label="Avg Order Value" value={`₹${stats.avg_order_value.toFixed(0)}`} color="from-violet-500/20 to-violet-600/10" textColor="text-violet-400" />
        <SummaryCard icon="👥" label="Total Customers" value={stats.total_customers.toLocaleString()} color="from-amber-500/20 to-amber-600/10" textColor="text-amber-400" />
      </div>

      {/* Today's Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-amber-500/20 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">🔥</span>
            <span className="text-slate-400 text-sm font-medium">Today</span>
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
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-5">
          <h3 className="text-white font-semibold text-sm mb-3">Order Status</h3>
          <div className="space-y-2">
            {Object.entries(stats.orders_by_status).map(([status, count]) => (
              <div key={status} className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[status] || '#666' }} />
                <span className="text-slate-400 text-sm capitalize flex-1">{status}</span>
                <span className="text-white text-sm font-semibold">{count}</span>
                <div className="w-20 h-1.5 rounded-full bg-slate-700 overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{
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
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-white font-semibold">Monthly Revenue</h3>
            <span className="text-slate-500 text-xs">Last 6 months</span>
          </div>
          <div className="flex items-end gap-3 h-48">
            {stats.monthly_revenue.map((m, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <span className="text-xs text-emerald-400 font-medium">₹{m.revenue.toLocaleString()}</span>
                <div className="w-full relative group">
                  <div
                    className="w-full rounded-t-lg bg-gradient-to-t from-emerald-500/80 to-emerald-400/40 transition-all hover:from-emerald-500 hover:to-emerald-400/60"
                    style={{ height: `${(m.revenue / maxMonthlyRevenue) * 140}px`, minHeight: '4px' }}
                  />
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-700 text-white text-xs px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition whitespace-nowrap z-10">
                    {m.orders} orders
                  </div>
                </div>
                <span className="text-[10px] text-slate-500 font-medium">{m.month.split(' ')[0]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Best Sellers */}
      {stats.best_sellers.length > 0 && (
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold">🏆 Best Sellers</h3>
            <span className="text-slate-500 text-xs">By quantity sold</span>
          </div>
          <div className="space-y-3">
            {stats.best_sellers.map((item, i) => (
              <div key={i} className="flex items-center gap-4 p-3 rounded-xl bg-slate-700/30 hover:bg-slate-700/50 transition">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500/20 to-amber-600/10 flex items-center justify-center shrink-0">
                  <span className="text-amber-400 font-bold text-sm">{i + 1}</span>
                </div>
                {item.image_url ? (
                  <img src={item.image_url} alt={item.name} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center shrink-0">
                    <span className="text-lg">🍽️</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{item.name}</p>
                  <p className="text-slate-500 text-xs">₹{item.price.toFixed(0)} each</p>
                </div>
                <div className="text-right">
                  <p className="text-white text-sm font-semibold">{item.total_sold} sold</p>
                  <p className="text-emerald-400 text-xs">₹{item.total_revenue.toLocaleString()}</p>
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
  icon: string; label: string; value: string; color: string; textColor: string;
}) {
  return (
    <div className={`bg-gradient-to-br ${color} border border-slate-700/50 rounded-2xl p-5 relative overflow-hidden`}>
      <div className="absolute top-3 right-3 text-3xl opacity-20">{icon}</div>
      <p className="text-slate-400 text-xs font-medium mb-1">{label}</p>
      <p className={`text-2xl font-bold ${textColor}`}>{value}</p>
    </div>
  );
}
