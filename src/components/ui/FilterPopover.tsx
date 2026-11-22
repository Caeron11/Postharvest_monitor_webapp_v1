import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { RotateCcw, SlidersHorizontal, X } from 'lucide-react';
import { CROP_LIST } from '../../data/seedData';
import type { LanguageCode, StorageRoom } from '../../types/postharvest';
import { formatCropLabel } from '../../utils/i18n';
import { GlassCard } from './GlassCard';

interface FilterPopoverProps {
  label: string;
  language: LanguageCode;
  cropFilter: string;
  roomFilter: string;
  statusFilter: string;
  rooms: StorageRoom[];
  onCropChange: (value: string) => void;
  onRoomChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onReset: () => void;
}

interface PopoverPosition {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
}

export function FilterPopover({
  label,
  language,
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
  const [position, setPosition] = useState<PopoverPosition | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const activeCount =
    (cropFilter !== 'all' ? 1 : 0) +
    (roomFilter !== 'all' ? 1 : 0) +
    (statusFilter !== 'all' ? 1 : 0);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current || typeof window === 'undefined') return;
    const rect = triggerRef.current.getBoundingClientRect();
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const margin = 12;
    const desiredWidth = Math.min(320, viewportW - margin * 2);
    const left = Math.max(
      margin,
      Math.min(rect.left, viewportW - desiredWidth - margin)
    );
    const top = Math.max(margin, rect.bottom + 8);
    const maxHeight = Math.max(220, viewportH - top - margin);

    setPosition({ top, left, width: desiredWidth, maxHeight });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePosition();

    const handleOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };

    const handleReposition = () => updatePosition();

    window.addEventListener('mousedown', handleOutside);
    window.addEventListener('keydown', handleEsc);
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);

    return () => {
      window.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('keydown', handleEsc);
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [open, updatePosition]);

  const popoverPanel =
    open && position && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label="Filter inventory batches"
            style={{
              top: `${position.top}px`,
              left: `${position.left}px`,
              width: `${position.width}px`,
            }}
            className="fixed z-40"
          >
            <GlassCard
              tier="floating"
              radius="nested"
              refraction
              style={{ maxHeight: `${position.maxHeight}px` }}
              className="glass-overlay-dense flex flex-col overflow-hidden shadow-2xl border border-slate-900/12 dark:border-white/14"
            >
              {/* Fixed Popover Header */}
              <div className="px-4 pt-4 pb-3 border-b border-slate-900/10 dark:border-white/10 shrink-0 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-800 dark:text-slate-200">
                  Filter batches
                </span>
                <button
                  type="button"
                  aria-label="Close filters"
                  onClick={() => setOpen(false)}
                  className="btn-secondary w-11 h-11 rounded-full inline-flex items-center justify-center cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" strokeWidth={1.75} />
                </button>
              </div>

              {/* Scrollable Filter Controls */}
              <div className="overflow-y-auto px-4 py-4 flex-1 min-h-0 space-y-3.5">
                <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
                  <span>Crop</span>
                  <select
                    value={cropFilter}
                    onChange={(e) => onCropChange(e.target.value)}
                    className="glass-recessed min-h-[44px] px-3 rounded-[14px] text-sm font-medium text-slate-950 dark:text-white bg-transparent cursor-pointer"
                  >
                    <option value="all" className="text-slate-900">
                      All crops
                    </option>
                    {CROP_LIST.map((crop) => (
                      <option key={crop} value={crop} className="text-slate-900">
                        {formatCropLabel(crop, language)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
                  <span>Room</span>
                  <select
                    value={roomFilter}
                    onChange={(e) => onRoomChange(e.target.value)}
                    className="glass-recessed min-h-[44px] px-3 rounded-[14px] text-sm font-medium text-slate-950 dark:text-white bg-transparent cursor-pointer"
                  >
                    <option value="all" className="text-slate-900">
                      All rooms
                    </option>
                    {rooms.map((room) => (
                      <option
                        key={room.id}
                        value={room.id}
                        className="text-slate-900"
                      >
                        {room.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
                  <span>Status</span>
                  <select
                    value={statusFilter}
                    onChange={(e) => onStatusChange(e.target.value)}
                    className="glass-recessed min-h-[44px] px-3 rounded-[14px] text-sm font-medium text-slate-950 dark:text-white bg-transparent cursor-pointer"
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
              </div>

              {/* Fixed Popover Footer */}
              <div className="px-4 py-3 border-t border-slate-900/10 dark:border-white/10 shrink-0 flex items-center justify-between gap-2.5">
                <button
                  type="button"
                  onClick={onReset}
                  className="btn-secondary min-h-[44px] px-4 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.75} />
                  <span>Reset</span>
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="btn-primary min-h-[44px] px-5 rounded-full text-xs font-semibold cursor-pointer"
                >
                  Apply
                </button>
              </div>
            </GlassCard>
          </div>,
          document.body
        )
      : null;

  return (
    <div className="relative">
      <button
        ref={triggerRef}
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

      {popoverPanel}
    </div>
  );
}
