import { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';

interface DeanUser {
  id: string;
  email: string;
  university_id: string;
  total_budget: string;
  used_budget: string;
}

interface AuthContextType {
  user: DeanUser | null;
  login: (token: string, userData: DeanUser) => void;
  logout: () => void;
  isLoading: boolean;
  updateBudget: (total: string, used: string) => void;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<DeanUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('dean_token');
    const storedUser = localStorage.getItem('dean_user');
    
    if (token && storedUser) {
      setUser(JSON.parse(storedUser));
      api.get('/dean/profile')
        .then((res) => {
          setUser(res.data);
          localStorage.setItem('dean_user', JSON.stringify(res.data));
        })
        .catch(() => {
          localStorage.removeItem('dean_token');
          localStorage.removeItem('dean_user');
          setUser(null);
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = (token: string, userData: DeanUser) => {
    localStorage.setItem('dean_token', token);
    localStorage.setItem('dean_user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('dean_token');
    localStorage.removeItem('dean_user');
    setUser(null);
  };

  const updateBudget = (total: string, used: string) => {
    if (user) {
      const updated = { ...user, total_budget: total, used_budget: used };
      setUser(updated);
      localStorage.setItem('dean_user', JSON.stringify(updated));
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading, updateBudget }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
