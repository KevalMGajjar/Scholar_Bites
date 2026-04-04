import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { TicketPercent, Wallet, LogOut, Plus, Trash2, ShieldCheck, Download, Users } from 'lucide-react';

interface Coupon {
  id: string;
  code: string;
  amount: number;
  discount_percentage: number;
  max_discount_amount: number;
  expires_at: string;
  is_used: boolean;
  coupon_type: string;
}

interface Distribution {
  role: string;
  count: number;
  totalAmount: number;
}

export default function Dashboard() {
  const { user, logout, updateBudget } = useAuth();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [distributions, setDistributions] = useState<Distribution[]>([]);
  const [loading, setLoading] = useState(true);

  // New Coupon Form
  const [discountPercent, setDiscountPercent] = useState('100');
  const [maxAmount, setMaxAmount] = useState('500');
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [couponsRes, fundsRes] = await Promise.all([
        api.get('/dean/coupons'),
        api.get('/dean/fund-distribution')
      ]);
      setCoupons(couponsRes.data);
      setDistributions(fundsRes.data);
    } catch (error) {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const generateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    try {
      const res = await api.post('/dean/coupons', {
        discount_percentage: parseFloat(discountPercent),
        max_discount_amount: parseFloat(maxAmount),
      });
      toast.success('Coupon generated successfully!');
      
      const newCoupon = res.data.coupon;
      setCoupons([newCoupon, ...coupons]);
      
      if (res.data.used_budget) {
         updateBudget(user?.total_budget || '0', res.data.used_budget);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to generate coupon');
    } finally {
      setIsGenerating(false);
    }
  };

  const deleteCoupon = async (id: string, amount: string) => {
    if (!confirm('Are you sure you want to delete this unused coupon? The funds will be returned to your budget.')) return;
    try {
      await api.delete(`/dean/coupons/${id}`);
      toast.success('Coupon deleted, funds returned.');
      setCoupons(coupons.filter(c => c.id !== id));
      
      const newUsed = parseFloat(user?.used_budget || '0') - parseFloat(amount);
      updateBudget(user?.total_budget || '0', newUsed.toString());
    } catch (error) {
      toast.error('Failed to delete coupon');
    }
  };

  const downloadCSV = async () => {
    try {
      const response = await api.get(`/dean/fund-distribution/export`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `fund_distribution.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      toast.error('Failed to download CSV');
    }
  };

  const totalBudget = parseFloat(user?.total_budget || '0');
  const usedBudget = parseFloat(user?.used_budget || '0');
  const availableBudget = totalBudget - usedBudget;
  const usagePercentage = totalBudget > 0 ? (usedBudget / totalBudget) * 100 : 0;

  return (
    <div className="min-h-screen bg-[#060810] text-slate-200">
      {/* Navbar */}
      <nav className="bg-[#0a0c16] border-b border-indigo-500/10 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center">
                <ShieldCheck size={20} className="text-white" />
              </div>
              <span className="font-bold text-white text-lg tracking-tight">Dean Portal</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm text-slate-400 hidden sm:block">
                Logged in as <span className="text-white font-medium">{user?.email}</span>
              </div>
              <button 
                onClick={logout}
                className="flex items-center gap-2 text-sm text-slate-400 hover:text-red-400 hover:bg-red-500/10 px-3 py-1.5 rounded-lg transition-colors"
              >
                <LogOut size={16} /> Sign out
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in">
        
        {/* Budget Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 bg-[#0a0c16] rounded-2xl border border-indigo-500/10 p-6 flex flex-col justify-center relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-[80px] group-hover:bg-indigo-500/10 transition-colors" />
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold text-slate-300 flex items-center gap-2">
                <Wallet className="text-indigo-400" size={20} /> Budget Allocation
              </h2>
              <span className="text-sm font-medium text-slate-500">Fixed Session Budget</span>
            </div>
            
            <div className="flex items-end gap-2 mb-6">
              <span className="text-4xl font-extrabold text-white tracking-tight">₹{availableBudget.toFixed(2)}</span>
              <span className="text-slate-400 font-medium mb-1">available / ₹{totalBudget.toFixed(2)}</span>
            </div>

            <div className="w-full h-3 bg-[#060810] rounded-full overflow-hidden border border-white/5">
              <div 
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-1000"
                style={{ width: `${Math.min(usagePercentage, 100)}%` }}
              />
            </div>
            <div className="flex justify-between mt-2 text-xs font-semibold text-slate-500">
              <span>{usagePercentage.toFixed(1)}% Used</span>
              <span>100% Total</span>
            </div>
          </div>

          <div className="bg-[#0a0c16] rounded-2xl border border-indigo-500/10 p-6 flex flex-col">
            <h2 className="text-lg font-semibold text-slate-300 flex items-center gap-2 mb-4">
              <TicketPercent className="text-purple-400" size={20} /> Generate Coupon
            </h2>
            <form onSubmit={generateCoupon} className="flex-1 flex flex-col">
              <div className="space-y-4 flex-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Discount %</label>
                  <input type="number" value={discountPercent} onChange={(e) => setDiscountPercent(e.target.value)} required min="1" max="100"
                    className="w-full bg-[#060810] border border-white/10 rounded-xl py-2 px-3 text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Max Amount (₹)</label>
                  <input type="number" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} required min="1"
                    className="w-full bg-[#060810] border border-white/10 rounded-xl py-2 px-3 text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
                </div>
              </div>
              <button 
                type="submit" disabled={isGenerating || availableBudget < parseFloat(maxAmount) || !maxAmount}
                className="w-full mt-4 bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold py-2.5 rounded-xl transition-all flex justify-center items-center gap-2"
              >
                {isGenerating ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Plus size={16} /> Generate</>}
              </button>
            </form>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Coupons List */}
          <div className="lg:col-span-2 bg-[#0a0c16] rounded-2xl border border-indigo-500/10 overflow-hidden">
            <div className="p-6 border-b border-white/5">
              <h2 className="text-lg font-semibold text-slate-300">Active & Generated Coupons</h2>
            </div>
            <div className="overflow-x-auto">
              {loading ? (
                <div className="p-8 text-center text-slate-500">Loading coupons...</div>
              ) : coupons.length === 0 ? (
                <div className="p-8 text-center text-slate-500 border-t border-white/5">No coupons generated yet.</div>
              ) : (
                <table className="w-full text-left">
                  <thead className="bg-[#060810]">
                    <tr>
                      <th className="py-3 px-6 text-xs font-semibold text-slate-500 uppercase">Code</th>
                      <th className="py-3 px-6 text-xs font-semibold text-slate-500 uppercase">Discount</th>
                      <th className="py-3 px-6 text-xs font-semibold text-slate-500 uppercase">Status</th>
                      <th className="py-3 px-6 text-xs font-semibold text-slate-500 uppercase">Expires</th>
                      <th className="py-3 px-6 text-xs font-semibold text-slate-500 uppercase text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {coupons.map((c) => (
                      <tr key={c.id} className="hover:bg-white/[0.02]">
                        <td className="py-4 px-6 text-sm font-mono font-bold text-white tracking-widest">{c.code}</td>
                        <td className="py-4 px-6 text-sm text-slate-300">{c.discount_percentage}% (Max ₹{c.max_discount_amount})</td>
                        <td className="py-4 px-6">
                          {c.is_used ? (
                            <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-500/10 text-slate-400">Used</span>
                          ) : new Date(c.expires_at) < new Date() ? (
                            <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-red-500/10 text-red-500">Expired</span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/10 text-emerald-400">Active</span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-sm text-slate-400">{new Date(c.expires_at).toLocaleDateString()}</td>
                        <td className="py-4 px-6 text-right">
                          {!c.is_used && new Date(c.expires_at) >= new Date() && (
                            <button onClick={() => deleteCoupon(c.id, c.max_discount_amount.toString())} className="text-slate-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10">
                              <Trash2 size={16} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Fund Distribution */}
          <div className="bg-[#0a0c16] rounded-2xl border border-indigo-500/10 overflow-hidden flex flex-col">
            <div className="p-6 border-b border-white/5 flex justify-between items-center bg-[#060810]/50">
              <h2 className="text-lg font-semibold text-slate-300 flex items-center gap-2">
                <Users size={18} className="text-indigo-400"/> Spending by Role
              </h2>
              <button onClick={downloadCSV} className="text-slate-400 hover:text-white" title="Export to CSV">
                <Download size={18} />
              </button>
            </div>
            <div className="p-6 flex-1 bg-gradient-to-b from-transparent to-[#060810]/30 border-b border-indigo-500/5">
              {loading ? (
                <div className="text-center text-slate-500 py-8">Loading distribution...</div>
              ) : distributions.length === 0 ? (
                <div className="text-center text-slate-500 py-8 text-sm">No fund usage recorded yet.</div>
              ) : (
                <div className="space-y-4">
                  {distributions.map((d, i) => {
                    const totalDistAmount = distributions.reduce((acc, curr) => acc + curr.totalAmount, 0);
                    const percent = totalDistAmount > 0 ? (d.totalAmount / totalDistAmount) * 100 : 0;
                    return (
                      <div key={i} className="bg-[#060810] p-4 rounded-xl border border-white/5 shadow-sm hover:border-indigo-500/20 transition-colors">
                        <div className="flex justify-between mb-2">
                          <span className="text-sm font-bold text-white capitalize">{d.role.replace('_', ' ')}</span>
                          <span className="text-sm font-semibold text-indigo-400">₹{d.totalAmount.toFixed(2)}</span>
                        </div>
                        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden mb-2">
                          <div className={`h-full rounded-full ${i % 2 === 0 ? 'bg-indigo-500' : 'bg-purple-500'}`} style={{ width: `${percent}%` }} />
                        </div>
                        <p className="text-xs text-slate-500 font-medium">{d.count} transactions recorded</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="p-4 bg-indigo-500/5 min-h-[60px] flex items-center justify-center">
              <p className="text-xs text-indigo-400/80 font-medium text-center">
                Download the CSV report to view individual student transactions.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
