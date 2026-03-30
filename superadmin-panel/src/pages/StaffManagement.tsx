import { useEffect, useState } from 'react';
import api from '../services/api';
import { UserPlus, Activity, LogIn } from 'lucide-react';

interface Staff {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
  created_at: string;
}

interface StaffAnalytics {
  lastLogin: string | null;
  totalOrdersCompleted: number;
  totalRefundsHandled: number;
  recentActivity: {
    action: string;
    resource: string;
    details: string;
    created_at: string;
  }[];
}

export default function StaffManagement() {
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', password: '', role: 'staff', phone: '' });
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');

  // Analytics Slide-over State
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [analytics, setAnalytics] = useState<StaffAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  useEffect(() => {
    fetchStaff();
  }, []);

  const fetchStaff = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/superadmin/staff');
      setStaffList(data);
    } catch (err) {
      console.error('Failed to fetch staff:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadAnalytics = async (staff: Staff) => {
    setSelectedStaff(staff);
    setAnalytics(null);
    setAnalyticsLoading(true);
    try {
      const { data } = await api.get(`/superadmin/staff/${staff.id}/analytics`);
      setAnalytics(data);
    } catch (err) {
      console.error('Failed to load analytics', err);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');
    setModalLoading(true);
    try {
      await api.post('/superadmin/staff', formData);
      setShowAddModal(false);
      setFormData({ name: '', email: '', password: '', role: 'staff', phone: '' });
      fetchStaff();
    } catch (err: any) {
      setModalError(err.response?.data?.message || 'Failed to create user');
    } finally {
      setModalLoading(false);
    }
  };

  const closeSidebar = () => {
    setSelectedStaff(null);
    setAnalytics(null);
  };

  return (
    <div className="p-8 lg:p-12 max-w-7xl mx-auto space-y-10 animate-fade-up font-body flex relative min-h-[calc(100vh-2rem)]">
      <div className={`flex-1 transition-all duration-300 ${selectedStaff ? 'mr-96' : ''}`}>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-10">
          <div>
            <h1 className="text-4xl font-display font-bold text-[#e5e2e1] mb-2 tracking-tight">Access Control</h1>
            <p className="text-[#a38b88] text-sm">Manage administrative roles and audit staff activity.</p>
          </div>
          <button 
            onClick={() => setShowAddModal(true)}
            className="btn-premium px-6 py-2.5 flex items-center gap-2 shadow-[0_0_15px_rgba(255,180,168,0.2)]"
          >
            <UserPlus size={18} />
            Add Account
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center p-20">
             <div className="animate-spin w-8 h-8 flex border-2 border-indigo-500 border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="bg-[#1c1b1b] border border-[#554240]/15 rounded-2xl overflow-hidden">
             <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#2a2828] text-[#a38b88] border-b border-[#554240]/20 text-sm font-semibold">
                     <th className="p-5 font-display">Name</th>
                     <th className="p-5 font-display">Role</th>
                     <th className="p-5 font-display">Contact</th>
                     <th className="p-5 font-display text-right">Analytics</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#554240]/15">
                   {staffList.map((st) => (
                      <tr key={st.id} className="hover:bg-[#201f1f] transition cursor-pointer" onClick={() => loadAnalytics(st)}>
                         <td className="p-5">
                            <div className="flex items-center gap-4">
                               <div className="w-10 h-10 bg-[#131313] border border-[#554240]/30 rounded-full flex items-center justify-center text-[#ffb4a8] font-bold">
                                  {st.name.charAt(0)}
                               </div>
                               <span className="text-[#e5e2e1] font-semibold">{st.name}</span>
                            </div>
                         </td>
                         <td className="p-5">
                            <span className={`px-3 py-1 text-xs font-bold rounded-full ${
                               st.role === 'super_admin' ? 'bg-[#ffb4a8]/10 text-[#ffb4a8] border border-[#ffb4a8]/20' : 
                               st.role === 'admin' ? 'bg-[#eac34a]/10 text-[#eac34a] border border-[#eac34a]/20' : 
                               'bg-[#554240]/30 text-[#a38b88]'
                            }`}>
                               {st.role.toUpperCase().replace('_', ' ')}
                            </span>
                         </td>
                         <td className="p-5 text-[#a38b88] text-sm flex flex-col gap-1">
                            <span>{st.email || 'No email'}</span>
                            <span>{st.phone || 'No phone'}</span>
                         </td>
                         <td className="p-5 text-right">
                            <button className="text-[#ffb4a8] text-sm font-semibold hover:underline">View Log</button>
                         </td>
                      </tr>
                   ))}
                </tbody>
             </table>
          </div>
        )}
      </div>

      {/* Analytics Slide Over Panel */}
      <div className={`fixed top-0 right-0 w-96 h-screen bg-[#131313] border-l border-[#554240]/20 shadow-2xl transform transition-transform duration-300 z-50 ${selectedStaff ? 'translate-x-0' : 'translate-x-full'}`}>
         {selectedStaff && (
           <div className="flex flex-col h-full">
              <div className="p-6 border-b border-[#554240]/20 flex justify-between items-center bg-[#1c1b1b]">
                 <div>
                    <h2 className="text-xl font-display font-bold text-[#e5e2e1]">{selectedStaff.name}</h2>
                    <p className="text-[#a38b88] text-xs uppercase tracking-widest mt-1">{selectedStaff.role.replace('_', ' ')}</p>
                 </div>
                 <button onClick={closeSidebar} className="text-[#a38b88] hover:text-[#ffb4a8] font-bold text-2xl">&times;</button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                 {analyticsLoading ? (
                    <div className="flex justify-center mt-20"><div className="animate-spin w-6 h-6 border-2 border-[#ffb4a8] border-t-transparent rounded-full" /></div>
                 ) : analytics ? (
                    <>
                       {/* Metrics Grid */}
                       <div className="grid grid-cols-2 gap-4">
                          <div className="bg-[#1c1b1b] p-4 rounded-xl border border-[#554240]/15">
                             <p className="text-[#a38b88] text-xs font-semibold mb-1">Orders Handled</p>
                             <p className="text-2xl font-display font-bold text-[#e5e2e1]">{analytics.totalOrdersCompleted}</p>
                          </div>
                          <div className="bg-[#1c1b1b] p-4 rounded-xl border border-[#554240]/15">
                             <p className="text-[#a38b88] text-xs font-semibold mb-1">Refunds Proc.</p>
                             <p className="text-2xl font-display font-bold text-[#e5e2e1]">{analytics.totalRefundsHandled}</p>
                          </div>
                          <div className="bg-[#1c1b1b] p-4 rounded-xl border border-[#554240]/15 col-span-2 flex items-center gap-4">
                             <LogIn className="text-[#ffb4a8]" size={20} />
                             <div>
                               <p className="text-[#a38b88] text-xs font-semibold mb-0.5">Last Login</p>
                               <p className="text-sm font-display font-bold text-[#e5e2e1]">
                                 {analytics.lastLogin ? new Date(analytics.lastLogin).toLocaleString() : 'Never logged in'}
                               </p>
                             </div>
                          </div>
                       </div>

                       {/* Feed */}
                       <div>
                          <h3 className="text-[#e5e2e1] font-display font-bold mb-4 flex items-center gap-2">
                             <Activity size={16} className="text-[#ffb4a8]" /> Recent Activity
                          </h3>
                          <div className="space-y-4 relative before:absolute before:inset-0 before:ml-2.5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-[#554240]/30 before:to-transparent">
                             {analytics.recentActivity.length === 0 ? (
                                <p className="text-[#a38b88] text-sm text-center py-10">No recent audit logs.</p>
                             ) : analytics.recentActivity.map((log, i) => (
                                <div key={i} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                                   <div className="flex items-center justify-center w-5 h-5 rounded-full border border-[#554240]/50 bg-[#1c1b1b] text-[#a38b88] shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                                     <div className="w-1.5 h-1.5 bg-[#ffb4a8] rounded-full"></div>
                                   </div>
                                   <div className="w-[calc(100%-2.5rem)] md:w-[calc(50%-1.25rem)] p-3 rounded-lg bg-[#1c1b1b] border border-[#554240]/15">
                                      <p className="text-[#e5e2e1] text-xs font-bold mb-1">{log.action}</p>
                                      <p className="text-[#a38b88] text-[10px] truncate">{log.resource}</p>
                                      <p className="text-[#554240] text-[9px] mt-1">{new Date(log.created_at).toLocaleString()}</p>
                                   </div>
                                </div>
                             ))}
                          </div>
                       </div>
                    </>
                 ) : null}
              </div>
           </div>
         )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <form className="bg-[#1c1b1b] border border-[#554240]/20 w-full max-w-md rounded-2xl p-8" onSubmit={handleAddStaff}>
            <h2 className="text-xl font-display font-bold text-[#e5e2e1] mb-6">Create Account</h2>
            {modalError && <p className="text-[#ffb4a8] bg-[#4c0000]/30 p-3 rounded-lg text-sm mb-4">{modalError}</p>}
            
            <div className="space-y-4">
               <div>
                  <label className="text-[#a38b88] text-xs font-bold mb-1 block">Full Name</label>
                  <input required type="text" value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} className="w-full bg-[#131313] border border-[#554240]/30 text-[#e5e2e1] rounded-lg p-3 text-sm focus:outline-none focus:border-[#ffb4a8]" />
               </div>
               <div>
                  <label className="text-[#a38b88] text-xs font-bold mb-1 block">Email (Optional)</label>
                  <input type="email" value={formData.email} onChange={e=>setFormData({...formData, email: e.target.value})} className="w-full bg-[#131313] border border-[#554240]/30 text-[#e5e2e1] rounded-lg p-3 text-sm focus:outline-none focus:border-[#ffb4a8]" />
               </div>
               <div>
                  <label className="text-[#a38b88] text-xs font-bold mb-1 block">Phone (Optional)</label>
                  <input type="tel" value={formData.phone} onChange={e=>setFormData({...formData, phone: e.target.value})} className="w-full bg-[#131313] border border-[#554240]/30 text-[#e5e2e1] rounded-lg p-3 text-sm focus:outline-none focus:border-[#ffb4a8]" />
               </div>
               <div>
                  <label className="text-[#a38b88] text-xs font-bold mb-1 block">Password</label>
                  <input required minLength={6} type="password" value={formData.password} onChange={e=>setFormData({...formData, password: e.target.value})} className="w-full bg-[#131313] border border-[#554240]/30 text-[#e5e2e1] rounded-lg p-3 text-sm focus:outline-none focus:border-[#ffb4a8]" />
               </div>
               <div>
                  <label className="text-[#a38b88] text-xs font-bold mb-1 block">Role</label>
                  <select value={formData.role} onChange={e=>setFormData({...formData, role: e.target.value})} className="w-full bg-[#131313] border border-[#554240]/30 text-[#e5e2e1] rounded-lg p-3 text-sm focus:outline-none focus:border-[#ffb4a8]">
                     <option value="staff">Staff (Kitchen/Scanner)</option>
                     <option value="admin">Admin (Manager)</option>
                     <option value="super_admin">Super Admin (Global Head)</option>
                  </select>
               </div>
            </div>

            <div className="flex gap-4 mt-8">
               <button type="button" onClick={()=>setShowAddModal(false)} className="flex-1 py-3 text-[#a38b88] hover:text-[#e5e2e1] font-semibold text-sm transition">Cancel</button>
               <button type="submit" disabled={modalLoading} className="flex-1 bg-[#ffb4a8] text-[#410000] py-3 rounded-lg font-bold text-sm shadow-[0_0_15px_rgba(255,180,168,0.2)] disabled:opacity-50">{modalLoading ? 'Creating...' : 'Create Account'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
