import { useState, useRef, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, ArrowLeft, ShieldCheck, Eye, EyeOff } from 'lucide-react';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

export default function Login() {
  const { login, verifyOtp, loginWithGoogle, resendOtp, cancelOtp, otpPending } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // OTP state
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(30);
  const [resending, setResending] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [otpAttempts, setOtpAttempts] = useState(0);
  const [otpShake, setOtpShake] = useState(false);
  const MAX_OTP_ATTEMPTS = 5;
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const googleBtnRef = useRef<HTMLDivElement>(null);

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

  // Initialize Google Identity Services
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || otpPending) return;

    const initGoogle = () => {
      if (!(window as any).google?.accounts?.id) return;
      (window as any).google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleResponse,
      });
      if (googleBtnRef.current) {
        (window as any).google.accounts.id.renderButton(googleBtnRef.current, {
          theme: 'filled_black',
          size: 'large',
          width: 400,
          text: 'signin_with',
          shape: 'pill',
        });
      }
    };

    // If script already loaded
    if ((window as any).google?.accounts?.id) {
      initGoogle();
      return;
    }

    // Load the script
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = initGoogle;
    document.head.appendChild(script);

    return () => {
      // Cleanup if needed
    };
  }, [otpPending]);

  const handleGoogleResponse = async (response: any) => {
    setError('');
    setLoading(true);
    try {
      await loginWithGoogle(response.credential);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Google sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      // If login returns without throwing and no otpPending, it means direct login (shouldn't happen with 2FA)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return; // digits only
    const newDigits = [...otpDigits];
    newDigits[index] = value.slice(-1);
    setOtpDigits(newDigits);

    // Auto-advance to next input
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits are filled
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
      const responseData = err.response?.data;
      const serverLocked = responseData?.locked === true;
      const serverRemaining = responseData?.attempts_remaining;

      // Shake animation
      setOtpShake(true);
      setTimeout(() => setOtpShake(false), 600);

      if (serverLocked) {
        // Server has burned this OTP session — force back to credentials
        setOtpError('Too many failed attempts. This code has been invalidated.');
        setTimeout(() => {
          cancelOtp();
          setOtpDigits(['', '', '', '', '', '']);
          setOtpError('');
          setOtpAttempts(0);
          setError('Verification code invalidated due to too many failed attempts. Please sign in again.');
        }, 2000);
      } else {
        const newAttempts = otpAttempts + 1;
        setOtpAttempts(newAttempts);

        // Use server-provided remaining count if available, fallback to local
        const remaining = typeof serverRemaining === 'number' ? serverRemaining : (MAX_OTP_ATTEMPTS - newAttempts);
        const msg = responseData?.message || 'Incorrect verification code';

        if (remaining <= 0) {
          setOtpError('Too many failed attempts. Please log in again.');
          setTimeout(() => {
            cancelOtp();
            setOtpDigits(['', '', '', '', '', '']);
            setOtpError('');
            setOtpAttempts(0);
            setError('Session expired due to too many failed OTP attempts. Please sign in again.');
          }, 2000);
        } else {
          setOtpError(`${msg}. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`);
        }
      }

      setOtpDigits(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setResending(true);
    try {
      await resendOtp();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to resend code');
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
    <div className="min-h-screen bg-[#060810] flex relative overflow-hidden">
      {/* ── Ambient layers ── */}
      <div className="absolute inset-0">
        <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-indigo-500/[0.06] rounded-full blur-[180px]" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] bg-purple-500/[0.04] rounded-full blur-[150px]" />
        <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
      </div>

      {/* ── Center Content ── */}
      <div className="relative z-10 flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-[400px] space-y-10 animate-fade-up">
          {/* Brand */}
          <div className="space-y-6">
            <div className="w-20 h-20 rounded-3xl bg-[#0c0f18] border border-white/[0.06] flex items-center justify-center shadow-2xl p-3.5 overflow-hidden animate-pulse-glow">
              <img src="/admin/logo.png" alt="Ahmedabad University Canteen" className="w-full h-full object-contain" />
            </div>
            <div className="space-y-2">
              <h1 className="text-[32px] font-extrabold text-white tracking-[-0.03em] leading-[1.1]">
                {otpPending ? 'Verify your identity' : 'Welcome back'}
              </h1>
              <p className="text-slate-500 text-[15px] leading-relaxed">
                {otpPending
                  ? <>We sent a code to <span className="text-indigo-400 font-semibold">{otpPending.email}</span></>
                  : 'Sign in to your Ahmedabad University Canteen admin account'
                }
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

            {otpPending ? (
              /* ── OTP Step ── */
              <div className="space-y-6 animate-fade-up">
                <div className="flex items-center gap-3 p-4 rounded-2xl bg-indigo-500/[0.06] border border-indigo-500/15">
                  <ShieldCheck size={20} className="text-indigo-400 shrink-0" />
                  <p className="text-indigo-300 text-[13px]">Enter the 6-digit code from your email to continue</p>
                </div>

                {/* OTP Input Boxes */}
                <div>
                  <div className={`flex gap-3 justify-center ${otpShake ? 'animate-shake' : ''}`} onPaste={handleOtpPaste}>
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
                        className={`w-14 h-16 text-center text-[24px] font-extrabold text-white bg-white/[0.03] border rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/40 transition-all duration-200 disabled:opacity-40 ${
                          otpError ? 'border-red-500/50' : 'border-white/[0.08]'
                        }`}
                        autoFocus={i === 0}
                      />
                    ))}
                  </div>
                  {otpError && (
                    <p className="text-red-400 text-[13px] font-medium text-center mt-3 animate-fade-up">
                      {otpError}
                    </p>
                  )}
                </div>

                {/* Resend + Back */}
                <div className="flex items-center justify-between">
                  <button
                    onClick={handleBack}
                    className="flex items-center gap-1.5 text-slate-500 text-[13px] font-medium hover:text-white transition-colors"
                  >
                    <ArrowLeft size={14} /> Back to login
                  </button>
                  <button
                    onClick={handleResend}
                    disabled={resendTimer > 0 || resending}
                    className="text-[13px] font-semibold transition-colors disabled:text-slate-600 text-indigo-400 hover:text-indigo-300"
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
              <>
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
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="w-full px-5 py-3.5 pr-12 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-white text-[15px] placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/30 transition-all duration-300"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-[15px] font-bold tracking-[-0.01em] hover:shadow-xl hover:shadow-indigo-500/20 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed btn-press mt-2"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2.5">
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Verifying…
                      </span>
                    ) : 'Sign In'}
                  </button>
                </form>

                {/* Divider */}
                {GOOGLE_CLIENT_ID && (
                  <>
                    <div className="flex items-center gap-4">
                      <div className="flex-1 h-px bg-white/[0.06]" />
                      <span className="text-slate-600 text-[11px] font-bold uppercase tracking-widest">or</span>
                      <div className="flex-1 h-px bg-white/[0.06]" />
                    </div>

                    {/* Google Sign-In Button */}
                    <div className="flex justify-center">
                      <div ref={googleBtnRef} />
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          <p className="text-slate-600 text-[12px] text-center">
            {otpPending ? "Didn't receive the email? Check your spam folder." : 'Contact your administrator if you don\'t have access.'}
          </p>
        </div>
      </div>
    </div>
  );
}
