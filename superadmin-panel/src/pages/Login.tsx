import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, ArrowLeft, ShieldCheck, Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const { login, verifyOtp, resendOtp, cancelOtp, otpPending } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
      const responseData = err.response?.data;
      const serverLocked = responseData?.locked === true;
      const serverRemaining = responseData?.attempts_remaining;

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
    <div className="min-h-screen bg-[#131313] flex items-center justify-center p-4 relative overflow-hidden font-body">
      {/* Ambient glowing orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-[#4c0000]/30 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-[#f0513e]/10 rounded-full blur-[150px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10 animate-fade-up">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-[#0c0f18] shadow-[0_0_30px_rgba(240,81,62,0.3)] mb-6 border border-[#f0513e]/20 overflow-hidden">
            <img src="/superadmin/logo.png" alt="Ahmedabad University Canteen" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-3xl font-display font-bold text-[#e5e2e1] mb-2 tracking-tight">
            {otpPending ? 'Verify Your Identity' : 'Super Admin Access'}
          </h1>
          <p className="text-[#a38b88]">
            {otpPending
              ? <>We sent a 6-digit code to <span className="text-[#ffb4a8] font-semibold">{otpPending.email}</span></>
              : 'Sign in to manage the main platform'
            }
          </p>
        </div>

        {/* Glass Card */}
        <div className="glass-panel rounded-2xl p-8 shadow-2xl relative">
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent rounded-2xl pointer-events-none" />

          {error && (
            <div className="bg-[#93000a]/20 border border-[#93000a]/50 text-[#ffb4ab] p-4 rounded-xl mb-6 text-sm text-center relative z-20">
              {error}
            </div>
          )}

          {otpPending ? (
            /* ── OTP Step ── */
            <div className="space-y-6 relative z-20">
              <div className="flex items-center gap-3 p-4 rounded-xl bg-[#4c0000]/30 border border-[#f0513e]/20">
                <ShieldCheck size={20} className="text-[#ffb4a8] shrink-0" />
                <p className="text-[#dcc0bd] text-sm font-medium">Enter the 6-digit code from your email</p>
              </div>

              {/* OTP Input Boxes */}
              <div>
                <div
                  className={`flex gap-3 justify-center ${otpShake ? 'animate-shake' : ''}`}
                  onPaste={handleOtpPaste}
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
                      className={`w-12 h-16 sm:w-14 text-center text-2xl font-bold font-display text-[#e5e2e1] bg-[#1c1b1b]/50 border-0 border-b-2 rounded-t-lg rounded-b-none focus:outline-none focus:border-[#f0513e] focus:bg-[#2a2a2a]/80 transition-all disabled:opacity-40 shadow-inner ${
                        otpError ? 'border-[#ffb4ab]' : 'border-[#554240]'
                      }`}
                      autoFocus={i === 0}
                    />
                  ))}
                </div>
                {otpError && (
                  <p className="text-[#ffb4ab] text-sm font-medium text-center mt-4">
                    {otpError}
                  </p>
                )}
              </div>

              {/* Resend + Back */}
              <div className="flex items-center justify-between">
                <button
                  onClick={handleBack}
                  className="flex items-center gap-1.5 text-[#a38b88] text-sm font-medium hover:text-[#e5e2e1] transition-colors"
                >
                  <ArrowLeft size={14} /> Back
                </button>
                <button
                  onClick={handleResend}
                  disabled={resendTimer > 0 || resending}
                  className="text-sm font-semibold transition-colors disabled:text-[#554240] text-[#ffb4a8] hover:text-[#e5e2e1]"
                >
                  {resending ? 'Sending...' : resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend code'}
                </button>
              </div>

              {otpLoading && (
                <div className="flex justify-center pt-2">
                  <div className="w-6 h-6 border-2 border-[#f0513e]/40 border-t-[#f0513e] rounded-full animate-spin" />
                </div>
              )}
            </div>
          ) : (
            /* ── Credentials Step ── */
            <form onSubmit={handleSubmit} className="space-y-6 relative z-20">
              <div>
                <label className="block label-premium mb-2">Email Address</label>
                <div className="relative group">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-[#1c1b1b]/50 border-0 border-b-2 border-[#554240] text-[#e5e2e1] rounded-t-lg rounded-b-none pl-12 pr-4 py-3 focus:outline-none focus:border-[#f0513e] focus:bg-[#2a2a2a] transition-all"
                    placeholder="admin@ahduni.edu.in"
                  />
                  <Mail className="absolute left-4 top-3.5 text-[#a38b88] group-focus-within:text-[#ffb4a8] transition-colors" size={20} />
                </div>
              </div>

              <div>
                <label className="block label-premium mb-2">Password</label>
                <div className="relative group">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-[#1c1b1b]/50 border-0 border-b-2 border-[#554240] text-[#e5e2e1] rounded-t-lg rounded-b-none pl-12 pr-12 py-3 focus:outline-none focus:border-[#f0513e] focus:bg-[#2a2a2a] transition-all"
                    placeholder="••••••••"
                  />
                  <Lock className="absolute left-4 top-3.5 text-[#a38b88] group-focus-within:text-[#ffb4a8] transition-colors" size={20} />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-3.5 text-[#554240] hover:text-[#a38b88] transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full btn-premium py-3 mt-4 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center"
              >
                {loading ? (
                  <span className="flex items-center gap-2.5">
                    <div className="w-5 h-5 border-2 border-[#410000]/30 border-t-[#410000] rounded-full animate-spin" />
                    Authenticating...
                  </span>
                ) : 'Secure Sign In'}
              </button>
            </form>
          )}
        </div>

        <p className="text-[#554240] text-xs font-medium text-center mt-8">
          {otpPending ? "Didn't receive the email? Check your spam folder." : 'Contact your administrator if you don\'t have access.'}
        </p>
      </div>
    </div>
  );
}
