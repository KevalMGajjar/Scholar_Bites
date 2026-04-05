import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { TicketPercent, Wallet, LogOut, Plus, Trash2, Download, Users } from 'lucide-react';

interface Coupon {
  id: string;
  code: string;
  amount: number;
  discount_percentage: number;
  max_discount_amount: number;
  expires_at: string;
  is_used: boolean;
  coupon_type: string;
  event_name?: string;
  redeemed_by_phone?: string;
  redeemed_at?: string;
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
  const [couponAmount, setCouponAmount] = useState('500');
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
      setDistributions(fundsRes.data.distributions || []);
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
        amount: parseFloat(couponAmount),
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
    <div className="min-h-screen bg-surface-base text-content-primary">
      {/* Navbar */}
      <nav className="glass-panel sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex justify-between h-20">
            <div className="flex items-center gap-4">
              <img src="/dean/logo.png" alt="University Logo" className="w-10 h-10 object-contain drop-shadow-md filter brightness-110" />
              <span className="font-display font-bold text-content-primary text-xl tracking-tight">Dean Portal</span>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-sm font-medium text-content-secondary hidden sm:block">
                Curator: <span className="text-tertiary-main">{user?.email}</span>
              </div>
              <button 
                onClick={logout}
                className="flex items-center gap-2 text-sm font-bold text-content-secondary hover:text-primary-light px-4 py-2 rounded-lg transition-colors border border-transparent hover:border-ghost-border hover:bg-surface-lowest"
              >
                <LogOut size={16} /> Exit
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-12 space-y-12 animate-fade-up">
        
        {/* Budget Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2 surface-container rounded-2xl p-8 flex flex-col justify-center relative overflow-hidden group shadow-2xl">
            <div className="absolute -top-32 -right-32 w-96 h-96 bg-primary-container rounded-full blur-[100px] opacity-40 group-hover:opacity-70 transition-opacity duration-700" />
            <div className="flex items-center justify-between mb-4 z-10">
              <h2 className="text-xl font-display font-bold text-content-primary flex items-center gap-3">
                <Wallet className="text-primary-light" size={24} /> Financial Endowment
              </h2>
              <span className="label-premium">Operational Budget</span>
            </div>
            
            <div className="flex items-end gap-3 mb-8 z-10">
              <span className="text-6xl font-display font-bold text-primary-light tracking-tight">₹{availableBudget.toFixed(2)}</span>
              <span className="text-content-secondary font-medium mb-2 text-lg">available / ₹{totalBudget.toFixed(2)}</span>
            </div>

            <div className="w-full h-2 bg-surface-lowest rounded-full overflow-hidden border border-ghost-border z-10">
              <div 
                className="h-full bg-gradient-to-r from-primary-dark to-primary-light rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${Math.min(usagePercentage, 100)}%` }}
              />
            </div>
            <div className="flex justify-between mt-3 text-sm font-bold text-content-tertiary z-10 uppercase tracking-widest">
              <span>{usagePercentage.toFixed(1)}% Allocated</span>
              <span>100% Capacity</span>
            </div>
          </div>

          <div className="surface-elevated rounded-2xl p-8 flex flex-col shadow-2xl hover-ember relative overflow-hidden">
            <h2 className="text-xl font-display font-bold text-content-primary flex items-center gap-3 mb-6 relative z-10">
              <TicketPercent className="text-tertiary-main" size={24} /> Issue Voucher
            </h2>
            <form onSubmit={generateCoupon} className="flex-1 flex flex-col relative z-10">
              <div className="space-y-5 flex-1">
                <div>
                  <label className="label-premium block mb-2">Voucher Value (₹)</label>
                  <input type="number" value={couponAmount} onChange={(e) => setCouponAmount(e.target.value)} required min="10"
                    className="w-full bg-surface-lowest border border-ghost-border rounded-xl py-3 px-4 text-content-primary focus:border-primary-light focus:ring-1 focus:ring-primary-light transition-colors font-medium font-mono text-lg" />
                </div>
              </div>
              <button 
                type="submit" disabled={isGenerating || availableBudget < parseFloat(couponAmount) || !couponAmount}
                className="w-full mt-6 btn-premium py-4 flex justify-center items-center gap-2 text-lg shadow-xl shadow-primary-container/20 disabled:scale-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGenerating ? <div className="w-5 h-5 border-2 border-primary-container border-t-transparent rounded-full animate-spin" /> : <><Plus size={20} /> Authorize</>}
              </button>
            </form>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Coupons List */}
          <div className="lg:col-span-2 surface-container rounded-2xl overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-ghost-border bg-surface-highest/30">
              <h2 className="text-xl font-display font-bold text-content-primary">Active Directory</h2>
            </div>
            <div className="overflow-x-auto min-h-[300px]">
              {loading ? (
                <div className="p-12 text-center text-content-tertiary text-lg font-medium">Synchronizing records...</div>
              ) : coupons.length === 0 ? (
                <div className="p-12 text-center text-content-tertiary text-lg font-medium">The ledger is currently empty.</div>
              ) : (
                <table className="w-full text-left">
                  <thead className="bg-surface-lowest/50 border-b border-ghost-border">
                    <tr>
                      <th className="py-4 px-6 label-premium">Access Key</th>
                      <th className="py-4 px-6 label-premium">Event Name</th>
                      <th className="py-4 px-6 label-premium">Phone Number</th>
                      <th className="py-4 px-6 label-premium">Redeemed At</th>
                      <th className="py-4 px-6 label-premium">Value Cap</th>
                      <th className="py-4 px-6 label-premium">State</th>
                      <th className="py-4 px-6 label-premium text-right">Admin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ghost-border/50">
                    {coupons.map((c, i) => (
                      <tr key={c.id} className={`hover:bg-surface-highest/20 transition-colors stagger-${(i%4)+1}`}>
                        <td className="py-5 px-6 font-mono font-bold text-primary-light tracking-widest text-lg">{c.code}</td>
                        <td className="py-5 px-6 font-medium text-content-secondary">{c.event_name || '-'}</td>
                        <td className="py-5 px-6 font-medium text-content-secondary">{c.redeemed_by_phone || '-'}</td>
                        <td className="py-5 px-6 font-medium text-content-secondary">
                          {c.redeemed_at ? new Date(c.redeemed_at).toLocaleString() : '-'}
                        </td>
                        <td className="py-5 px-6 font-medium text-content-secondary">₹{c.amount}</td>
                        <td className="py-5 px-6">
                          {c.is_used ? (
                            <span className="px-3 py-1.5 rounded-md text-xs font-bold bg-surface-highest text-content-tertiary border border-ghost-border">Redeemed</span>
                          ) : new Date(c.expires_at) < new Date() ? (
                            <span className="px-3 py-1.5 rounded-md text-xs font-bold bg-primary-container text-primary-light border border-primary-dark">Voided</span>
                          ) : (
                            <span className="px-3 py-1.5 rounded-md text-xs font-bold bg-[#004d00]/30 text-[#a3f69c] border border-[#005512]">Active</span>
                          )}
                        </td>
                        <td className="py-5 px-6 text-right">
                          {!c.is_used && new Date(c.expires_at) >= new Date() && (
                            <button onClick={() => deleteCoupon(c.id, c.amount.toString())} className="text-content-tertiary hover:text-primary-light p-2 rounded-lg hover:bg-surface-high border border-transparent hover:border-ghost-border transition-all">
                              <Trash2 size={18} />
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
          <div className="surface-elevated rounded-2xl flex flex-col shadow-2xl relative overflow-hidden">
            <div className="absolute bottom-0 right-0 w-64 h-64 bg-tertiary-main/5 rounded-full blur-[80px]" />
            <div className="p-6 border-b border-ghost-border flex justify-between items-center bg-surface-highest/30 relative z-10">
              <h2 className="text-xl font-display font-bold text-content-primary flex items-center gap-3">
                <Users size={20} className="text-tertiary-main"/> Demographic Metrics
              </h2>
              <button onClick={downloadCSV} className="text-content-secondary hover:text-tertiary-main transition-colors p-2 rounded-lg hover:bg-surface-container" title="Export Ledger">
                <Download size={20} />
              </button>
            </div>
            
            <div className="p-6 flex-1 relative z-10">
              {loading ? (
                <div className="text-center text-content-tertiary py-12 font-medium">Analyzing patterns...</div>
              ) : distributions.length === 0 ? (
                <div className="text-center text-content-tertiary py-12 font-medium">No demographic data available.</div>
              ) : (
                <div className="space-y-6">
                  {distributions.map((d, i) => {
                    const totalDistAmount = distributions.reduce((acc, curr) => acc + curr.totalAmount, 0);
                    const percent = totalDistAmount > 0 ? (d.totalAmount / totalDistAmount) * 100 : 0;
                    return (
                      <div key={i} className="bg-surface-base p-5 rounded-xl border border-ghost-border shadow-inner hover:border-primary-dark transition-colors">
                        <div className="flex justify-between mb-3 items-end">
                          <span className="text-base font-bold text-content-primary capitalize">{d.role.replace('_', ' ')}</span>
                          <span className="text-lg font-display font-extrabold text-tertiary-main tracking-tight">₹{d.totalAmount.toFixed(2)}</span>
                        </div>
                        <div className="w-full h-2 bg-surface-lowest rounded-full overflow-hidden mb-3 border border-ghost-border/30">
                          <div className={`h-full rounded-full ${i % 2 === 0 ? 'bg-tertiary-main' : 'bg-primary-main'}`} style={{ width: `${percent}%` }} />
                        </div>
                        <p className="label-premium text-[10px] text-content-tertiary">{d.count} Registered Events</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="p-5 border-t border-ghost-border bg-surface-lowest/50 backdrop-blur-md relative z-10">
              <p className="text-xs text-content-secondary font-medium text-center leading-relaxed">
                Download the master ledger CSV to forensically review transaction-level student engagement.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
