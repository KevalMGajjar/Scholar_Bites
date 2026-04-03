import { useRestaurant } from '../context/RestaurantContext';
import { Store, Lock, ChevronDown } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

export default function RestaurantFilter() {
  const { restaurants, selectedRestaurantId, setSelectedRestaurantId, isStaffLocked, staffRestaurantName } = useRestaurant();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Staff locked — show locked pill
  if (isStaffLocked) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
        <Lock size={14} className="text-indigo-400" />
        <span className="text-[13px] font-semibold text-indigo-300">{staffRestaurantName}</span>
      </div>
    );
  }

  const selectedName = selectedRestaurantId
    ? restaurants.find(r => r.id === selectedRestaurantId)?.name || 'Restaurant'
    : 'All Restaurants';

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] hover:border-white/[0.08] transition-all duration-200 group"
      >
        <Store size={15} className="text-slate-500 group-hover:text-indigo-400 transition-colors" />
        <span className="text-[13px] font-medium text-slate-300">{selectedName}</span>
        <ChevronDown
          size={14}
          className={`text-slate-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-64 bg-[#0c0e16] border border-white/[0.08] rounded-2xl shadow-2xl shadow-black/50 z-50 overflow-hidden animate-fade-up">
          {/* All Restaurants option */}
          <button
            onClick={() => { setSelectedRestaurantId(null); setIsOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all duration-150 hover:bg-white/[0.04] ${
              !selectedRestaurantId
                ? 'bg-indigo-500/10 text-indigo-300'
                : 'text-slate-400'
            }`}
          >
            <div className={`w-2 h-2 rounded-full ${!selectedRestaurantId ? 'bg-indigo-500' : 'bg-transparent'}`} />
            <Store size={14} />
            <span className="text-[13px] font-medium">All Restaurants</span>
          </button>

          <div className="h-px bg-white/[0.04]" />

          {/* Individual restaurants */}
          <div className="max-h-64 overflow-y-auto">
            {restaurants.map((r) => (
              <button
                key={r.id}
                onClick={() => { setSelectedRestaurantId(r.id); setIsOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all duration-150 hover:bg-white/[0.04] ${
                  selectedRestaurantId === r.id
                    ? 'bg-indigo-500/10 text-indigo-300'
                    : 'text-slate-400'
                }`}
              >
                <div className={`w-2 h-2 rounded-full ${selectedRestaurantId === r.id ? 'bg-indigo-500' : 'bg-transparent'}`} />
                {r.logo_url ? (
                  <img src={r.logo_url} alt="" className="w-5 h-5 rounded-md object-cover" />
                ) : (
                  <Store size={14} />
                )}
                <span className="text-[13px] font-medium flex-1">{r.name}</span>
                <div className={`w-1.5 h-1.5 rounded-full ${r.is_open ? 'bg-emerald-500' : 'bg-red-500'}`} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
