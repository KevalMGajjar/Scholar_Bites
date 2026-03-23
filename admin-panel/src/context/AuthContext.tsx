import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import api from '../services/api';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'staff' | 'admin' | 'super_admin';
  university_id: string;
  university_name: string;
}

interface OtpPending {
  otp_session_id: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  otpPending: OtpPending | null;
  login: (email: string, password: string) => Promise<void>;
  verifyOtp: (otp: string) => Promise<void>;
  loginWithGoogle: (credential: string) => Promise<void>;
  resendOtp: () => Promise<void>;
  cancelOtp: () => void;
  logout: () => void;
  isAdmin: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [otpPending, setOtpPending] = useState<OtpPending | null>(null);

  // Store credentials temporarily for OTP resend
  const [pendingCredentials, setPendingCredentials] = useState<{ email: string; password: string } | null>(null);

  useEffect(() => {
    const savedToken = localStorage.getItem('admin_token');
    const savedUser = localStorage.getItem('admin_user');
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
    setIsLoading(false);
  }, []);

  const completeLogin = (newToken: string, newUser: User) => {
    localStorage.setItem('admin_token', newToken);
    localStorage.setItem('admin_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    setOtpPending(null);
    setPendingCredentials(null);
  };

  const login = async (email: string, password: string) => {
    const res = await api.post('/admin/login', { email, password });

    if (res.data.requires_otp) {
      setOtpPending({ otp_session_id: res.data.otp_session_id, email });
      setPendingCredentials({ email, password });
      return;
    }

    // Fallback: if server somehow returns token directly
    const { token: newToken, user: newUser } = res.data;
    completeLogin(newToken, newUser);
  };

  const verifyOtp = async (otp: string) => {
    if (!otpPending) throw new Error('No OTP session active');

    const res = await api.post('/admin/login/verify-otp', {
      otp_session_id: otpPending.otp_session_id,
      otp,
    });

    const { token: newToken, user: newUser } = res.data;
    completeLogin(newToken, newUser);
  };

  const loginWithGoogle = async (credential: string) => {
    const res = await api.post('/admin/login/google', { credential });
    const { token: newToken, user: newUser } = res.data;
    completeLogin(newToken, newUser);
  };

  const resendOtp = async () => {
    if (!pendingCredentials) throw new Error('No pending login to resend OTP for');
    // Re-trigger login which generates a fresh OTP
    await login(pendingCredentials.email, pendingCredentials.password);
  };

  const cancelOtp = () => {
    setOtpPending(null);
    setPendingCredentials(null);
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Backend logout failed, clearing local session anyway.', error);
    }
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    setToken(null);
    setUser(null);
  };

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  return (
    <AuthContext.Provider value={{ user, token, otpPending, login, verifyOtp, loginWithGoogle, resendOtp, cancelOtp, logout, isAdmin, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};
