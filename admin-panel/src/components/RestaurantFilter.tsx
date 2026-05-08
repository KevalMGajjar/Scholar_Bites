import { useRestaurant } from '../context/RestaurantContext';
import { Lock } from 'lucide-react';

export default function RestaurantFilter() {
  const { restaurants, selectedRestaurantId, setSelectedRestaurantId, isStaffLocked, staffRestaurantName } = useRestaurant();

  if (isStaffLocked) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20">
        <Lock size={14} className="text-red-400" />
        <span className="text-[13px] font-semibold text-red-300">{staffRestaurantName}</span>
      </div>
    );
  }

  return (
    <select
      value={selectedRestaurantId || ''}
      onChange={(e) => setSelectedRestaurantId(e.target.value || null)}
      style={{
        appearance: 'none',
        WebkitAppearance: 'none',
        backgroundColor: '#111318',
        color: '#cbd5e1',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '14px',
        padding: '8px 36px 8px 14px',
        fontSize: '13px',
        fontWeight: 500,
        fontFamily: 'inherit',
        cursor: 'pointer',
        outline: 'none',
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 12px center',
        minWidth: '180px',
      }}
    >
      <option value="" style={{ backgroundColor: '#111318', color: '#cbd5e1' }}>All Restaurants</option>
      {restaurants.map((r) => (
        <option key={r.id} value={r.id} style={{ backgroundColor: '#111318', color: '#cbd5e1' }}>
          {r.name} {r.is_open ? '●' : '○'}
        </option>
      ))}
    </select>
  );
}
