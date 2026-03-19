import { useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail } from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#060810] flex relative overflow-hidden">
      {/* ── Ambient layers ── */}
      <div className="absolute inset-0">
        <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-indigo-500/[0.06] rounded-full blur-[180px]" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] bg-purple-500/[0.04] rounded-full blur-[150px]" />
        {/* Grid pattern overlay */}
        <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
      </div>

      {/* ── Center Content ── */}
      <div className="relative z-10 flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-[400px] space-y-10 animate-fade-up">
          {/* Brand */}
          <div className="space-y-6">
            <div className="w-20 h-20 rounded-3xl bg-[#0c0f18] border border-white/[0.06] flex items-center justify-center shadow-2xl p-3.5 overflow-hidden animate-pulse-glow">
              <img src="/admin/logo.png" alt="Scholar Bites" className="w-full h-full object-contain" />
            </div>
            <div className="space-y-2">
              <h1 className="text-[32px] font-extrabold text-white tracking-[-0.03em] leading-[1.1]">
                Welcome back
              </h1>
              <p className="text-slate-500 text-[15px] leading-relaxed">
                Sign in to your Scholar Bites admin account
              </p>
            </div>
          </div>

          {/* Form */}
          <div className="space-y-6">
            {error && (
              <div className="p-4 rounded-2xl bg-red-500/[0.06] border border-red-500/15 text-red-400 text-sm font-medium animate-scale-in">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label className="text-[12px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Mail size={11} className="text-slate-500" /> Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-5 py-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-white text-[15px] placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/30 transition-all duration-300"
                  placeholder="admin@scholarbites.in"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[12px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Lock size={11} className="text-slate-500" /> Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-5 py-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-white text-[15px] placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/30 transition-all duration-300"
                  placeholder="••••••••"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-[15px] font-bold tracking-[-0.01em] hover:shadow-xl hover:shadow-indigo-500/20 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed btn-press mt-2"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2.5">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Signing in…
                  </span>
                ) : 'Sign In'}
              </button>
            </form>
          </div>

          <p className="text-slate-600 text-[12px] text-center">
            Contact your administrator if you don't have access.
          </p>
        </div>
      </div>
    </div>
  );
}
