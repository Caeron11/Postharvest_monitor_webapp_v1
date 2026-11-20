import React, { useEffect, useRef, useState } from 'react';
import { RotateCcw, SlidersHorizontal, X } from 'lucide-react';
import { CROP_LIST } from '../../data/seedData';
import type { StorageRoom } from '../../types/postharvest';
import { GlassCard } from './GlassCard';

interface FilterPopoverProps {
  label: string;
  cropFilter: string;
  roomFilter: string;
  statusFilter: string;
  rooms: StorageRoom[];
  onCropChange: (value: string) => void;
  onRoomChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onReset: () => void;
}

export function FilterPopover({
  label,
  cropFilter,
  roomFilter,
  statusFilter,
  rooms,
  onCropChange,
  onRoomChange,
  onStatusChange,
  onReset,
}: FilterPopoverProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const activeCount =
    (cropFilter !== 'all' ? 1 : 0) +
    (roomFilter !== 'all' ? 1 : 0) +
    (statusFilter !== 'all' ? 1 : 0);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', handleOutside);
    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('keydown', handleEsc);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((prev) => !prev)}
        className={`min-h-[44px] px-4 rounded-full text-sm font-semibold inline-flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0 ${
          activeCount > 0 ? 'btn-primary' : 'btn-secondary'
        }`}
      >
        <SlidersHorizontal className="w-4 h-4 shrink-0" strokeWidth={1.75} />
        <span>{label}</span>
        {activeCount > 0 && (
          <span className="font-tabular text-xs font-bold px-1.5 py-0.5 rounded-full bg-[#111318]/15 text-[#111318]">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Filter inventory batches"
          className="absolute left-0 top-[calc(100%+8px)] z-50 w-[300px] sm:w-[320px]"
        >
          <GlassCard
            tier="floating"
            radius="nested"
            refraction
            className="p-4 flex flex-col gap-3.5 !bg-none !bg-white/95 dark:!bg-[#16191F]/96"
          >
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-900/10 dark:border-white/10">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
                Filter batches
              </span>
              <button
                type="button"
                aria-label="Close filters"
                onClick={() => setOpen(false)}
                className="w-8 h-8 rounded-full inline-flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-900/8 dark:hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" strokeWidth={1.75} />
              </button>
            </div>

            <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <span>Crop</span>
              <select
                value={cropFilter}
                onChange={(e) => onCropChange(e.target.value)}
                className="glass-recessed min-h-[44px] px-3 rounded-[14px] text-sm font-medium text-slate-900 dark:text-slate-100 bg-transparent cursor-pointer"
              >
                <option value="all" className="text-slate-900">
                  All crops
                </option>
                {CROP_LIST.map((crop) => (
                  <option key={crop} value={crop} className="text-slate-900">
                    {crop}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <span>Room</span>
              <select
                value={roomFilter}
                onChange={(e) => onRoomChange(e.target.value)}
                className="glass-recessed min-h-[44px] px-3 rounded-[14px] text-sm font-medium text-slate-900 dark:text-slate-100 bg-transparent cursor-pointer"
              >
                <option value="all" className="text-slate-900">
                  All rooms
                </option>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id} className="text-slate-900">
                    {room.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <span>Status</span>
              <select
                value={statusFilter}
                onChange={(e) => onStatusChange(e.target.value)}
                className="glass-recessed min-h-[44px] px-3 rounded-[14px] text-sm font-medium text-slate-900 dark:text-slate-100 bg-transparent cursor-pointer"
              >
                <option value="all" className="text-slate-900">
                  All statuses
                </option>
                <option value="release_now" className="text-slate-900">
                  Release now
                </option>
                <option value="release_soon" className="text-slate-900">
                  Release soon
                </option>
                <option value="hold" className="text-slate-900">
                  Hold
                </option>
                <option value="released" className="text-slate-900">
                  Released
                </option>
              </select>
            </label>

            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-900/10 dark:border-white/10">
              <button
                type="button"
                onClick={onReset}
                className="btn-secondary min-h-[40px] px-3.5 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.75} />
                <span>Reset</span>
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="btn-primary min-h-[40px] px-4 rounded-full text-xs font-semibold cursor-pointer"
              >
                Apply
              </button>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
