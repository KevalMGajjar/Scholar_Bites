import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, ArrowLeft, ShieldCheck } from 'lucide-react';

export default function Login() {
  const { login, verifyOtp, resendOtp, cancelOtp, otpPending } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // OTP state
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [otpAttempts, setOtpAttempts] = useState(0);
  const [otpShake, setOtpShake] = useState(false);
  const [resendTimer, setResendTimer] = useState(30);
  const [resending, setResending] = useState(false);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const MAX_OTP_ATTEMPTS = 5;

  // Countdown timer for resend
  useEffect(() => {
    if (!otpPending) return;
    setResendTimer(30);
    const interval = setInterval(() => {
      setResendTimer((t) => {
        if (t <= 1) { clearInterval(interval); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [otpPending]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError('');
      setLoading(true);
      await login(email, password);
      // If no OTP required (shouldn't happen with 2FA), navigate directly
      if (!otpPending) {
        navigate('/');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to login');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newDigits = [...otpDigits];
    newDigits[index] = value.slice(-1);
    setOtpDigits(newDigits);

    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }

    const fullOtp = newDigits.join('');
    if (fullOtp.length === 6) {
      submitOtp(fullOtp);
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pastedData.length === 0) return;
    const newDigits = [...otpDigits];
    for (let i = 0; i < 6; i++) {
      newDigits[i] = pastedData[i] || '';
    }
    setOtpDigits(newDigits);
    if (pastedData.length === 6) {
      submitOtp(pastedData);
    } else {
      otpRefs.current[pastedData.length]?.focus();
    }
  };

  const submitOtp = async (otp: string) => {
    setError('');
    setOtpError('');
    setOtpLoading(true);
    try {
      await verifyOtp(otp);
      navigate('/');
    } catch (err: any) {
      const newAttempts = otpAttempts + 1;
      setOtpAttempts(newAttempts);

      setOtpShake(true);
      setTimeout(() => setOtpShake(false), 600);

      if (newAttempts >= MAX_OTP_ATTEMPTS) {
        setOtpError('Too many failed attempts. Please log in again.');
        setTimeout(() => {
          cancelOtp();
          setOtpDigits(['', '', '', '', '', '']);
          setOtpError('');
          setOtpAttempts(0);
          setError('Session expired due to too many failed OTP attempts. Please sign in again.');
        }, 2000);
      } else {
        const remaining = MAX_OTP_ATTEMPTS - newAttempts;
        const msg = err.response?.data?.message || 'Incorrect verification code';
        setOtpError(`${msg}. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`);
      }

      setOtpDigits(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setOtpError('');
    setResending(true);
    try {
      await resendOtp();
    } catch (err: any) {
      setOtpError(err.response?.data?.message || 'Failed to resend code');
    } finally {
      setResending(false);
    }
  };

  const handleBack = () => {
    cancelOtp();
    setOtpDigits(['', '', '', '', '', '']);
    setError('');
    setOtpError('');
    setOtpAttempts(0);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-xl shadow-indigo-500/20 mb-6">
            <span className="text-3xl text-white font-bold">SA</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            {otpPending ? 'Verify Your Identity' : 'Super Admin Access'}
          </h1>
          <p className="text-slate-400">
            {otpPending
              ? <>We sent a 6-digit code to <span className="text-indigo-400 font-semibold">{otpPending.email}</span></>
              : 'Sign in to manage the main platform'
            }
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-4 rounded-xl mb-6 text-sm text-center">
              {error}
            </div>
          )}

          {otpPending ? (
            /* ── OTP Step ── */
            <div className="space-y-6">
              <div className="flex items-center gap-3 p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                <ShieldCheck size={20} className="text-indigo-400 shrink-0" />
                <p className="text-indigo-300 text-sm">Enter the 6-digit code from your email</p>
              </div>

              {/* OTP Input Boxes */}
              <div>
                <div
                  className={`flex gap-3 justify-center ${otpShake ? 'animate-shake' : ''}`}
                  onPaste={handleOtpPaste}
                  style={otpShake ? { animation: 'shake 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97) both' } : {}}
                >
                  {otpDigits.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => { otpRefs.current[i] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      disabled={otpLoading || otpAttempts >= MAX_OTP_ATTEMPTS}
                      className={`w-14 h-16 text-center text-2xl font-bold text-white bg-slate-950 border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition disabled:opacity-40 ${
                        otpError ? 'border-red-500/50' : 'border-slate-700'
                      }`}
                      autoFocus={i === 0}
                    />
                  ))}
                </div>
                {otpError && (
                  <p className="text-red-400 text-sm font-medium text-center mt-3">
                    {otpError}
                  </p>
                )}
              </div>

              {/* Resend + Back */}
              <div className="flex items-center justify-between">
                <button
                  onClick={handleBack}
                  className="flex items-center gap-1.5 text-slate-500 text-sm font-medium hover:text-white transition-colors"
                >
                  <ArrowLeft size={14} /> Back to login
                </button>
                <button
                  onClick={handleResend}
                  disabled={resendTimer > 0 || resending}
                  className="text-sm font-semibold transition-colors disabled:text-slate-600 text-indigo-400 hover:text-indigo-300"
                >
                  {resending ? 'Sending...' : resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend code'}
                </button>
              </div>

              {otpLoading && (
                <div className="flex justify-center">
                  <div className="w-6 h-6 border-2 border-indigo-500/40 border-t-indigo-500 rounded-full animate-spin" />
                </div>
              )}
            </div>
          ) : (
            /* ── Credentials Step ── */
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Email Address</label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl pl-12 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                    placeholder="admin@scholarbites.com"
                  />
                  <Mail className="absolute left-4 top-3.5 text-slate-500" size={20} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Password</label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl pl-12 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                    placeholder="••••••••"
                  />
                  <Lock className="absolute left-4 top-3.5 text-slate-500" size={20} />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-medium py-3 rounded-xl transition shadow-lg shadow-indigo-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2.5">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Verifying…
                  </span>
                ) : 'Secure Sign In'}
              </button>
            </form>
          )}
        </div>

        <p className="text-slate-600 text-xs text-center mt-6">
          {otpPending ? "Didn't receive the email? Check your spam folder." : 'Contact your administrator if you don\'t have access.'}
        </p>
      </div>

      {/* Inline shake animation (no Tailwind config needed) */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          15%, 45%, 75% { transform: translateX(-6px); }
          30%, 60%, 90% { transform: translateX(6px); }
        }
        .animate-shake {
          animation: shake 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
        }
      `}</style>
    </div>
  );
}
