import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRestaurant } from '../context/RestaurantContext';
import { Lock, ChevronDown } from 'lucide-react';

export default function RestaurantFilter() {
  const { restaurants, selectedRestaurantId, setSelectedRestaurantId, isStaffLocked, staffRestaurantName } = useRestaurant();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });

  // Position the portal menu right under the trigger when it opens.
  useLayoutEffect(() => {
    if (open && triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 6, left: r.left, width: r.width });
    }
  }, [open]);

  // Close on outside click (the menu lives in a portal, so check BOTH refs),
  // and on scroll/resize to avoid a misaligned floating menu.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onMove = () => setOpen(false);
    document.addEventListener('mousedown', onDown);
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
    };
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
    <div className="relative" style={{ minWidth: '180px' }}>
      <button
        ref={triggerRef}
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

      {/* Rendered in a portal at <body> with a fully opaque background and a huge
          z-index — escapes every parent stacking context so cards can never sit
          on top of it or show through. */}
      {open && createPortal(
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 9999, backgroundColor: '#0c0e14' }}
          className="rounded-xl border border-white/[0.12] shadow-2xl shadow-black/70 overflow-hidden py-1 animate-scale-in"
        >
          <button
            type="button"
            onClick={() => { setSelectedRestaurantId(null); setOpen(false); }}
            className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] font-medium text-left transition-colors ${
              !selectedRestaurantId ? 'bg-indigo-500 text-white' : 'text-slate-300 hover:bg-white/[0.06]'
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
                  isSelected ? 'bg-indigo-500 text-white' : 'text-slate-300 hover:bg-white/[0.06]'
                }`}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: dotColor(isSelected, r.is_open) }} />
                <span className="truncate">{r.name}</span>
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}
