import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';

interface Restaurant {
  id: string;
  name: string;
  logo_url?: string;
  is_open: boolean;
}

interface RestaurantContextType {
  restaurants: Restaurant[];
  selectedRestaurantId: string | null;
  setSelectedRestaurantId: (id: string | null) => void;
  isStaffLocked: boolean;
  staffRestaurantName: string | null;
  isLoading: boolean;
}

const RestaurantContext = createContext<RestaurantContextType>({
  restaurants: [],
  selectedRestaurantId: null,
  setSelectedRestaurantId: () => {},
  isStaffLocked: false,
  staffRestaurantName: null,
  isLoading: true,
});

export const useRestaurant = () => useContext(RestaurantContext);

export const RestaurantProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Staff members are locked to their restaurant
  const isStaffLocked = user?.role === 'staff' && !!(user as any)?.restaurant_id;
  const staffRestaurantName = (user as any)?.restaurant_name || null;

  useEffect(() => {
    if (!user) return;

    // If staff is locked, auto-set their restaurant
    if (isStaffLocked) {
      setSelectedRestaurantId((user as any).restaurant_id);
      setIsLoading(false);
      return;
    }

    // Fetch all restaurants for admins
    const fetchRestaurants = async () => {
      try {
        const res = await api.get(`/admin/restaurants/${user.university_id}`);
        setRestaurants(res.data);
      } catch (error) {
        console.error('Failed to fetch restaurants:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRestaurants();
  }, [user, isStaffLocked]);

  return (
    <RestaurantContext.Provider
      value={{
        restaurants,
        selectedRestaurantId,
        setSelectedRestaurantId,
        isStaffLocked,
        staffRestaurantName,
        isLoading,
      }}
    >
      {children}
    </RestaurantContext.Provider>
  );
};
