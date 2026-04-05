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
    <div className="min-h-screen bg-surface-base flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden text-content-primary">
      <div className="fixed top-[-50%] left-[-20%] w-[80%] h-[80%] bg-primary-container/[0.1] rounded-full blur-[180px] pointer-events-none" />
      <div className="fixed bottom-[-50%] right-[-20%] w-[80%] h-[80%] bg-tertiary-main/[0.05] rounded-full blur-[180px] pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 animate-fade-up">
        {/* Logo Area */}
        <div className="w-20 h-20 mx-auto bg-transparent flex items-center justify-center p-2 mb-4 relative group overflow-hidden">
          <img src="/logo.png" alt="University Logo" className="w-full h-full object-contain filter brightness-110 drop-shadow-md z-10" />
        </div>
        <h2 className="mt-2 text-center text-4xl font-display font-bold text-content-primary tracking-tight">Dean Portal</h2>
        <p className="mt-2 text-center text-sm text-content-secondary font-medium">Please authenticate to access the ledger</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10 animate-fade-up stagger-1">
        <div className="surface-container py-10 px-4 shadow-2xl sm:rounded-2xl sm:px-10 relative overflow-hidden">
          <form className="space-y-8 relative z-10" onSubmit={handleLogin}>
            <div>
              <label className="block label-premium mb-3 flex items-center gap-2"><Mail size={14} className="text-primary-light" /> Authority Email</label>
              <div className="mt-1">
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none block w-full px-5 py-4 rounded-xl bg-surface-lowest border border-ghost-border text-content-primary text-base placeholder-content-tertiary focus:outline-none focus:ring-1 focus:ring-primary-light focus:border-primary-light transition-all font-medium" placeholder="dean@university.edu" />
              </div>
            </div>

            <div>
              <label className="block label-premium mb-3 flex items-center gap-2"><Lock size={14} className="text-primary-light" /> Security Passphrase</label>
              <div className="mt-1">
                <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full px-5 py-4 rounded-xl bg-surface-lowest border border-ghost-border text-content-primary text-base placeholder-content-tertiary focus:outline-none focus:ring-1 focus:ring-primary-light focus:border-primary-light transition-all font-medium" placeholder="••••••••" />
              </div>
            </div>

            <div className="pt-2">
              <button type="submit" disabled={loading}
                className="w-full btn-premium py-4 flex justify-center items-center text-lg shadow-xl shadow-primary-container/30 transition-all duration-300 disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed group relative overflow-hidden">
                <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
                {loading ? <div className="w-5 h-5 border-2 border-primary-container border-t-white rounded-full animate-spin" /> : 'Secure Sign In'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
