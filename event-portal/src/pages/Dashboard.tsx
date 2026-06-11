import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { TicketPercent, Wallet, LogOut, Plus, Trash2, Download, Users, Mail, Phone, ChevronDown, ChevronUp, UserCheck, TrendingUp, Clock } from 'lucide-react';

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

interface Representative {
  id: string;
  name: string;
  phone: string;
  email: string;
  created_at: string;
  redeemed_count: number;
  redeemed_amount: number;
  last_redeemed_at: string | null;
  recent_vouchers: { code: string; amount: number; event_name: string; redeemed_at: string; status: string }[];
  issued_count: number;
  issued_amount: number;
  active_vouchers: number;
  revoked_vouchers: number;
}

interface RepTotals {
  total_reps: number;
  total_redeemed: number;
  total_issued: number;
  total_vouchers_redeemed: number;
}

export default function Dashboard() {
  const { user, logout, updateBudget } = useAuth();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);

  // New Coupon Form
  const [couponAmount, setCouponAmount] = useState('500');
  const [staffEmail, setStaffEmail] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [representatives, setRepresentatives] = useState<Representative[]>([]);
  const [repTotals, setRepTotals] = useState<RepTotals | null>(null);
  const [expandedRep, setExpandedRep] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [couponsRes, repsRes] = await Promise.all([
        api.get('/event/coupons'),
        api.get('/event/representatives')
      ]);
      setCoupons(couponsRes.data);
      setRepresentatives(repsRes.data.representatives || []);
      setRepTotals(repsRes.data.totals || null);
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
      const res = await api.post('/event/coupons', {
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
      await api.patch(`/event/coupons/${id}/revoke`);
      toast.success('Coupon deleted, funds returned.');
      setCoupons(coupons.filter(c => c.id !== id));

      const newUsed = parseFloat(user?.used_budget || '0') - parseFloat(amount);
      updateBudget(user?.total_budget || '0', newUsed.toString());
    } catch (error) {
      toast.error('Failed to delete coupon');
    }
  };

  const downloadExcel = async () => {
    try {
      const response = await api.get(`/event/fund-distribution/export`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `delegate_vouchers.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      toast.error('Failed to download Excel');
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
              <div className="w-11 h-11 rounded-xl bg-surface-lowest border border-ghost-border flex items-center justify-center p-1.5 overflow-hidden shadow-md">
                <img src="/event/logo.png" alt="University Logo" className="w-full h-full object-contain drop-shadow-md filter brightness-110" />
              </div>
              <span className="font-display font-bold text-content-primary text-xl tracking-tight">Event Head Portal</span>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-sm font-medium text-content-secondary hidden sm:block">
                Event Head: <span className="text-tertiary-main">{user?.email}</span>
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
                  <label className="label-premium block mb-2 flex items-center gap-2"><Mail size={12} /> Staff Email</label>
                  <input
                    type="email"
                    value={staffEmail}
                    onChange={(e) => setStaffEmail(e.target.value)}
                    placeholder="staff@ahduni.edu.in"
                    required
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

        {/* Active Directory — full-width coupon ledger */}
        <div className="surface-container rounded-2xl overflow-hidden shadow-2xl">
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
                          <span className="px-3 py-1.5 rounded-md text-xs font-bold bg-primary-container text-primary-light border border-primary-dark">Expired</span>
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

        {/* ═══ Delegates Section ═══ */}
        <div className="surface-container rounded-2xl shadow-2xl overflow-hidden">
          <div className="p-6 border-b border-ghost-border bg-surface-highest/30 flex justify-between items-center">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-display font-bold text-content-primary flex items-center gap-3">
                <UserCheck size={22} className="text-tertiary-main" /> Delegates
              </h2>
              <button
                onClick={downloadExcel}
                className="flex items-center gap-2 text-sm font-bold text-content-secondary hover:text-tertiary-main px-4 py-2 rounded-lg border border-ghost-border hover:bg-surface-container transition-colors"
                title="Export voucher ledger to Excel"
              >
                <Download size={16} /> Export Excel
              </button>
            </div>
            {repTotals && (
              <span className="label-premium">{repTotals.total_reps} Assigned</span>
            )}
          </div>

          {/* Rep Summary Stats */}
          {repTotals && repTotals.total_reps > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-6 border-b border-ghost-border/50">
              <div className="bg-surface-lowest rounded-xl p-4 border border-ghost-border/30 text-center">
                <Users size={18} className="mx-auto text-tertiary-main mb-1.5" />
                <p className="text-2xl font-display font-bold text-content-primary">{repTotals.total_reps}</p>
                <p className="text-[10px] font-bold text-content-tertiary uppercase tracking-wider mt-1">Delegates</p>
              </div>
              <div className="bg-surface-lowest rounded-xl p-4 border border-ghost-border/30 text-center">
                <TrendingUp size={18} className="mx-auto text-primary-light mb-1.5" />
                <p className="text-2xl font-display font-bold text-content-primary">₹{repTotals.total_issued.toFixed(0)}</p>
                <p className="text-[10px] font-bold text-content-tertiary uppercase tracking-wider mt-1">Total Issued</p>
              </div>
              <div className="bg-surface-lowest rounded-xl p-4 border border-ghost-border/30 text-center">
                <TicketPercent size={18} className="mx-auto text-[#a3f69c] mb-1.5" />
                <p className="text-2xl font-display font-bold text-content-primary">₹{repTotals.total_redeemed.toFixed(0)}</p>
                <p className="text-[10px] font-bold text-content-tertiary uppercase tracking-wider mt-1">Total Redeemed</p>
              </div>
              <div className="bg-surface-lowest rounded-xl p-4 border border-ghost-border/30 text-center">
                <Wallet size={18} className="mx-auto text-tertiary-main mb-1.5" />
                <p className="text-2xl font-display font-bold text-content-primary">{repTotals.total_vouchers_redeemed}</p>
                <p className="text-[10px] font-bold text-content-tertiary uppercase tracking-wider mt-1">Vouchers Used</p>
              </div>
            </div>
          )}

          {/* Rep Cards */}
          <div className="p-6 space-y-4">
            {loading ? (
              <div className="text-center text-content-tertiary py-12 font-medium">Loading delegates...</div>
            ) : representatives.length === 0 ? (
              <div className="text-center text-content-tertiary py-12">
                <UserCheck size={40} className="mx-auto mb-4 opacity-30" />
                <p className="font-medium">No delegates assigned yet.</p>
                <p className="text-xs mt-2">Delegates are assigned via the Super Admin panel.</p>
              </div>
            ) : (
              representatives.map((rep) => {
                const isExpanded = expandedRep === rep.id;
                const usagePercent = repTotals && repTotals.total_redeemed > 0
                  ? (rep.redeemed_amount / repTotals.total_redeemed) * 100 : 0;
                return (
                  <div
                    key={rep.id}
                    className="bg-surface-base rounded-xl border border-ghost-border hover:border-primary-dark/50 transition-all cursor-pointer"
                    onClick={() => setExpandedRep(isExpanded ? null : rep.id)}
                  >
                    <div className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary-container border border-primary-dark flex items-center justify-center flex-shrink-0">
                            <span className="text-primary-light font-bold text-sm">{rep.name.charAt(0).toUpperCase()}</span>
                          </div>
                          <div>
                            <p className="text-sm font-bold text-content-primary">{rep.name}</p>
                            <div className="flex items-center gap-3 mt-0.5">
                              <span className="flex items-center gap-1 text-xs text-content-secondary">
                                <Mail size={10} /> {rep.email}
                              </span>
                              <span className="flex items-center gap-1 text-xs text-content-secondary">
                                <Phone size={10} /> {rep.phone}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-lg font-display font-extrabold text-tertiary-main">₹{rep.redeemed_amount.toFixed(0)}</span>
                          <span className="text-[10px] font-bold text-content-tertiary uppercase tracking-wider">redeemed</span>
                        </div>
                      </div>

                      {/* Stats Row */}
                      <div className="grid grid-cols-4 gap-3 mb-3">
                        <div className="bg-surface-lowest rounded-lg p-2 text-center border border-ghost-border/30">
                          <p className="text-sm font-bold text-content-primary">{rep.issued_count}</p>
                          <p className="text-[9px] font-bold text-content-tertiary uppercase">Issued</p>
                        </div>
                        <div className="bg-surface-lowest rounded-lg p-2 text-center border border-ghost-border/30">
                          <p className="text-sm font-bold text-[#a3f69c]">{rep.redeemed_count}</p>
                          <p className="text-[9px] font-bold text-content-tertiary uppercase">Redeemed</p>
                        </div>
                        <div className="bg-surface-lowest rounded-lg p-2 text-center border border-ghost-border/30">
                          <p className="text-sm font-bold text-primary-light">{rep.active_vouchers}</p>
                          <p className="text-[9px] font-bold text-content-tertiary uppercase">Active</p>
                        </div>
                        <div className="bg-surface-lowest rounded-lg p-2 text-center border border-ghost-border/30">
                          <p className="text-sm font-bold text-content-tertiary">{rep.revoked_vouchers}</p>
                          <p className="text-[9px] font-bold text-content-tertiary uppercase">Revoked</p>
                        </div>
                      </div>

                      {/* Usage Bar */}
                      <div className="w-full h-1.5 bg-surface-lowest rounded-full overflow-hidden border border-ghost-border/30">
                        <div className="h-full bg-tertiary-main rounded-full transition-all duration-500" style={{ width: `${usagePercent}%` }} />
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[10px] font-bold text-content-tertiary uppercase tracking-wider">
                          {usagePercent.toFixed(1)}% of total redeemed
                        </span>
                        <div className="flex items-center gap-1 text-content-tertiary">
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </div>
                      </div>
                    </div>

                    {/* Expanded: Recent Vouchers */}
                    {isExpanded && (
                      <div className="border-t border-ghost-border/50 px-5 py-4 bg-surface-lowest/30">
                        <div className="flex items-center justify-between mb-3">
                          <p className="label-premium text-[10px] flex items-center gap-1.5">
                            <Clock size={10} /> Recent Voucher Activity
                          </p>
                          {rep.last_redeemed_at && (
                            <span className="text-[10px] text-content-tertiary">
                              Last: {new Date(rep.last_redeemed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                            </span>
                          )}
                        </div>
                        {rep.recent_vouchers.length > 0 ? (
                          <div className="space-y-2">
                            {rep.recent_vouchers.map((v, i) => (
                              <div key={i} className="flex items-center justify-between bg-surface-base rounded-lg px-3 py-2 border border-ghost-border/30">
                                <div>
                                  <span className="text-xs font-mono font-bold text-primary-light tracking-wider">{v.code}</span>
                                  {v.event_name && (
                                    <span className="ml-2 text-[10px] text-content-tertiary">{v.event_name}</span>
                                  )}
                                </div>
                                <div className="text-right">
                                  <span className="text-sm font-bold text-tertiary-main">₹{Number(v.amount).toFixed(0)}</span>
                                  {v.redeemed_at && (
                                    <span className="block text-[9px] text-content-tertiary">
                                      {new Date(v.redeemed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-content-tertiary text-center py-3">No vouchers redeemed yet.</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

      </main>
    </div>
  );
}
