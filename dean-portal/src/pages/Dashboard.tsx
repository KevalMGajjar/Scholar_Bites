import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { TicketPercent, Wallet, LogOut, Plus, Trash2, Download, Users, Mail, Phone, User, Calendar, ChevronDown, ChevronUp } from 'lucide-react';

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
  staff_email?: string;
  redeemed_by_phone?: string;
  redeemed_at?: string;
}

interface UserDistribution {
  name: string;
  phone: string;
  role: string;
  count: number;
  totalAmount: number;
  events: string[];
}

export default function Dashboard() {
  const { user, logout, updateBudget } = useAuth();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [distributions, setDistributions] = useState<UserDistribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  // New Coupon Form
  const [couponAmount, setCouponAmount] = useState('500');
  const [staffEmail, setStaffEmail] = useState('');
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
        staff_email: staffEmail.trim() || undefined,
      });
      toast.success(staffEmail ? 'Voucher issued & email sent!' : 'Voucher generated successfully!');
      
      const newCoupon = res.data.coupon;
      setCoupons([newCoupon, ...coupons]);
      setStaffEmail('');
      
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
              <div className="space-y-4 flex-1">
                <div>
                  <label className="label-premium block mb-2">Voucher Value (₹)</label>
                  <input type="number" value={couponAmount} onChange={(e) => setCouponAmount(e.target.value)} required min="10"
                    className="w-full bg-surface-lowest border border-ghost-border rounded-xl py-3 px-4 text-content-primary focus:border-primary-light focus:ring-1 focus:ring-primary-light transition-colors font-medium font-mono text-lg" />
                </div>
                <div>
                  <label className="label-premium block mb-2 flex items-center gap-2"><Mail size={12} /> Staff Email <span className="text-content-tertiary font-normal">(optional)</span></label>
                  <input 
                    type="email" 
                    value={staffEmail} 
                    onChange={(e) => setStaffEmail(e.target.value)} 
                    placeholder="staff@ahduni.edu.in"
                    className="w-full bg-surface-lowest border border-ghost-border rounded-xl py-3 px-4 text-content-primary focus:border-primary-light focus:ring-1 focus:ring-primary-light transition-colors font-medium text-sm placeholder:text-content-tertiary/50" 
                  />
                  <p className="text-[10px] text-content-tertiary mt-1.5 leading-relaxed">Voucher code & instructions will be emailed to this address</p>
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
                      <th className="py-4 px-6 label-premium">Issued To</th>
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
                        <td className="py-5 px-6 font-medium text-content-secondary text-sm">{c.staff_email || <span className="text-content-tertiary">—</span>}</td>
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

          {/* Fund Distribution — Per-User Demographics */}
          <div className="surface-elevated rounded-2xl flex flex-col shadow-2xl relative overflow-hidden">
            <div className="absolute bottom-0 right-0 w-64 h-64 bg-tertiary-main/5 rounded-full blur-[80px]" />
            <div className="p-6 border-b border-ghost-border flex justify-between items-center bg-surface-highest/30 relative z-10">
              <h2 className="text-xl font-display font-bold text-content-primary flex items-center gap-3">
                <Users size={20} className="text-tertiary-main"/> Staff Engagement
              </h2>
              <button onClick={downloadCSV} className="text-content-secondary hover:text-tertiary-main transition-colors p-2 rounded-lg hover:bg-surface-container" title="Export Ledger">
                <Download size={20} />
              </button>
            </div>
            
            <div className="p-4 flex-1 relative z-10 overflow-y-auto max-h-[500px]" style={{ scrollbarWidth: 'thin' }}>
              {loading ? (
                <div className="text-center text-content-tertiary py-12 font-medium">Analyzing patterns...</div>
              ) : distributions.length === 0 ? (
                <div className="text-center text-content-tertiary py-12 font-medium">
                  <Users size={40} className="mx-auto mb-4 opacity-30" />
                  <p>No redemption data yet.</p>
                  <p className="text-xs mt-2">Staff engagement metrics will appear here after vouchers are redeemed.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {distributions.map((d, i) => {
                    const totalDistAmount = distributions.reduce((acc, curr) => acc + curr.totalAmount, 0);
                    const percent = totalDistAmount > 0 ? (d.totalAmount / totalDistAmount) * 100 : 0;
                    const isExpanded = expandedUser === d.phone;
                    const roleColors: Record<string, string> = {
                      'university_staff': 'bg-tertiary-main/20 text-tertiary-main border-tertiary-main/30',
                      'student': 'bg-primary-container text-primary-light border-primary-dark',
                      'unknown': 'bg-surface-highest text-content-tertiary border-ghost-border',
                    };
                    const roleColor = roleColors[d.role] || roleColors['unknown'];

                    return (
                      <div 
                        key={i} 
                        className="bg-surface-base rounded-xl border border-ghost-border shadow-inner hover:border-primary-dark/50 transition-all cursor-pointer"
                        onClick={() => setExpandedUser(isExpanded ? null : d.phone)}
                      >
                        {/* User Header */}
                        <div className="p-4">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div className="w-9 h-9 rounded-full bg-surface-highest border border-ghost-border flex items-center justify-center flex-shrink-0">
                                <User size={16} className="text-content-tertiary" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-content-primary truncate">{d.name}</p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <Phone size={10} className="text-content-tertiary flex-shrink-0" />
                                  <span className="text-xs font-mono text-content-secondary">{d.phone}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                              <span className="text-lg font-display font-extrabold text-tertiary-main tracking-tight">₹{d.totalAmount.toFixed(0)}</span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${roleColor}`}>
                                {d.role.replace('_', ' ')}
                              </span>
                            </div>
                          </div>

                          {/* Progress Bar */}
                          <div className="w-full h-1.5 bg-surface-lowest rounded-full overflow-hidden border border-ghost-border/30 mt-3">
                            <div 
                              className={`h-full rounded-full transition-all duration-500 ${i % 3 === 0 ? 'bg-tertiary-main' : i % 3 === 1 ? 'bg-primary-main' : 'bg-primary-light'}`} 
                              style={{ width: `${percent}%` }} 
                            />
                          </div>

                          {/* Stats Row */}
                          <div className="flex items-center justify-between mt-2.5">
                            <span className="text-[10px] font-bold text-content-tertiary uppercase tracking-wider">{d.count} voucher{d.count !== 1 ? 's' : ''} redeemed</span>
                            <div className="flex items-center gap-1 text-content-tertiary">
                              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </div>
                          </div>
                        </div>

                        {/* Expanded Events */}
                        {isExpanded && d.events.length > 0 && (
                          <div className="border-t border-ghost-border/50 px-4 py-3 bg-surface-lowest/30">
                            <p className="label-premium text-[10px] mb-2 flex items-center gap-1.5"><Calendar size={10} /> Events Registered</p>
                            <div className="flex flex-wrap gap-1.5">
                              {d.events.map((evt, j) => (
                                <span key={j} className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-surface-highest text-content-secondary border border-ghost-border/50">
                                  {evt}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="p-5 border-t border-ghost-border bg-surface-lowest/50 backdrop-blur-md relative z-10">
              <p className="text-xs text-content-secondary font-medium text-center leading-relaxed">
                Individual staff engagement with phone numbers and event history.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
