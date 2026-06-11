import { useState, useRef, useEffect } from 'react';
import { useRestaurant } from '../context/RestaurantContext';
import { Lock, ChevronDown } from 'lucide-react';

export default function RestaurantFilter() {
  const { restaurants, selectedRestaurantId, setSelectedRestaurantId, isStaffLocked, staffRestaurantName } = useRestaurant();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (isStaffLocked) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20">
        <Lock size={14} className="text-red-400" />
        <span className="text-[13px] font-semibold text-red-300">{staffRestaurantName}</span>
      </div>
    );
  }

  const selectedRestaurant = restaurants.find((r) => r.id === selectedRestaurantId) || null;
  const selectedLabel = selectedRestaurant ? selectedRestaurant.name : 'All Restaurants';

  // Circle for an option: red if it's the currently selected one, otherwise
  // green when the restaurant is open and slate when closed.
  const dotColor = (isSelected: boolean, isOpen?: boolean) =>
    isSelected ? '#ef4444' : isOpen ? '#10b981' : '#64748b';

  return (
    <div ref={ref} className="relative z-50" style={{ minWidth: '180px' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 px-3.5 py-2 rounded-[14px] text-[13px] font-medium text-slate-300 bg-[#111318] border border-white/[0.08] hover:border-white/[0.15] transition-colors"
      >
        <span className="flex items-center gap-2 truncate">
          {selectedRestaurant && (
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: dotColor(true, selectedRestaurant.is_open) }} />
          )}
          <span className="truncate">{selectedLabel}</span>
        </span>
        <ChevronDown size={14} className={`text-slate-500 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-[100] mt-1.5 w-full rounded-xl bg-[#0c0e14] border border-white/[0.12] shadow-2xl shadow-black/70 overflow-hidden py-1 animate-scale-in">
          {/* All Restaurants */}
          <button
            type="button"
            onClick={() => { setSelectedRestaurantId(null); setOpen(false); }}
            className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] font-medium text-left transition-colors ${
              !selectedRestaurantId ? 'bg-indigo-500 text-white' : 'text-slate-300 hover:bg-white/[0.05]'
            }`}
          >
            {!selectedRestaurantId && <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: '#ef4444' }} />}
            <span className={!selectedRestaurantId ? '' : 'ml-[18px]'}>All Restaurants</span>
          </button>

          {restaurants.map((r) => {
            const isSelected = r.id === selectedRestaurantId;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => { setSelectedRestaurantId(r.id); setOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] font-medium text-left transition-colors ${
                  isSelected ? 'bg-indigo-500 text-white' : 'text-slate-300 hover:bg-white/[0.05]'
                }`}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: dotColor(isSelected, r.is_open) }} />
                <span className="truncate">{r.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
