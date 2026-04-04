import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { Lock, Mail } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/dean/login', { email, password });
      login(res.data.token, res.data.dean);
      navigate('/');
      toast.success('Welcome back!');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#060810] flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden text-slate-200">
      <div className="fixed top-[-50%] left-[-20%] w-[80%] h-[80%] bg-indigo-500/[0.04] rounded-full blur-[180px] pointer-events-none" />
      <div className="fixed bottom-[-50%] right-[-20%] w-[80%] h-[80%] bg-purple-500/[0.04] rounded-full blur-[180px] pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 animate-fade-up">
        {/* Logo Area */}
        <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-xl shadow-indigo-500/20 p-3 mb-6 relative group overflow-hidden">
          <div className="absolute inset-0 bg-white/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Logo" className="w-full h-full object-contain filter brightness-110 drop-shadow-md z-10" />
        </div>
        <h2 className="mt-2 text-center text-[28px] font-extrabold text-white tracking-[-0.03em]">Dean Portal</h2>
        <p className="mt-2 text-center text-[14px] text-slate-500 font-medium">Please sign in to your faculty account</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10 animate-fade-up" style={{ animationDelay: '100ms' }}>
        <div className="bg-[#0a0c14] py-8 px-4 shadow-[0_8px_30px_rgb(0,0,0,0.5)] border border-white/[0.05] sm:rounded-3xl sm:px-10 backdrop-blur-xl relative overflow-hidden">
          <form className="space-y-6 relative z-10" onSubmit={handleLogin}>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5"><Mail size={12} className="text-indigo-400" /> Email address</label>
              <div className="mt-1">
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none block w-full px-4 py-3 rounded-2xl bg-[#060810] border border-white/[0.08] text-white text-[14px] placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all font-medium" placeholder="dean@university.edu" />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5"><Lock size={12} className="text-indigo-400" /> Password</label>
              <div className="mt-1">
                <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full px-4 py-3 rounded-2xl bg-[#060810] border border-white/[0.08] text-white text-[14px] placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all font-medium" placeholder="••••••••" />
              </div>
            </div>

            <div>
              <button type="submit" disabled={loading}
                className="w-full flex justify-center py-3.5 px-4 rounded-2xl shadow-sm text-[14px] font-bold text-white bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 focus:ring-offset-[#0a0c14] transition-all duration-300 disabled:opacity-50 hover:shadow-lg hover:shadow-indigo-500/25 active:scale-[0.98] group relative overflow-hidden">
                <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
                {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Secure Sign In'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
