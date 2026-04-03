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
      <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20">
        <Lock size={14} className="text-red-400" />
        <span className="text-[13px] font-semibold text-red-300">{staffRestaurantName}</span>
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
        <Store size={15} className="text-slate-500 group-hover:text-red-400 transition-colors" />
        <span className="text-[13px] font-medium text-slate-300">{selectedName}</span>
        <ChevronDown
          size={14}
          className={`text-slate-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-64 bg-[#1d1f28]/95 backdrop-blur-xl border border-white/[0.08] rounded-2xl shadow-[0_20px_40px_-10px_rgba(0,0,0,0.5)] z-50 overflow-hidden animate-fade-up">
          {/* All Restaurants option */}
          <button
            onClick={() => { setSelectedRestaurantId(null); setIsOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all duration-200 hover:bg-red-500/15 ${
              !selectedRestaurantId
                ? 'bg-red-500/10 text-red-300'
                : 'text-slate-300'
            }`}
          >
            <div className={`w-2.5 h-2.5 rounded-full ${!selectedRestaurantId ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]' : 'bg-transparent'}`} />
            <Store size={15} />
            <span className="text-[14px] font-medium">All Restaurants</span>
          </button>

          <div className="h-px bg-white/[0.06]" />

          {/* Individual restaurants */}
          <div className="max-h-72 overflow-y-auto">
            {restaurants.map((r) => (
              <button
                key={r.id}
                onClick={() => { setSelectedRestaurantId(r.id); setIsOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all duration-200 hover:bg-red-500/15 ${
                  selectedRestaurantId === r.id
                    ? 'bg-red-500/10 text-red-300'
                    : 'text-slate-300'
                }`}
              >
                <div className={`w-2.5 h-2.5 rounded-full ${selectedRestaurantId === r.id ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]' : 'bg-transparent'}`} />
                {r.logo_url ? (
                  <img src={r.logo_url} alt="" className="w-6 h-6 rounded-md object-cover shadow-sm" />
                ) : (
                  <Store size={15} />
                )}
                <span className="text-[14px] font-medium flex-1 truncate">{r.name}</span>
                <div className={`w-2 h-2 rounded-full shadow-sm ${r.is_open ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.4)]' : 'bg-red-500 opacity-60'}`} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
