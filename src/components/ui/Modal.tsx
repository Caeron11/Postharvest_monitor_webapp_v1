import React, { useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { GlassCard } from './GlassCard';

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

export function Modal({ open, title, onClose, footer, children }: ModalProps) {
  const headingId = useId();

  useEffect(() => {
    if (!open || typeof document === 'undefined') return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKey);
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/65 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby={headingId}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <GlassCard
        tier="floating"
        radius="outer"
        refraction
        className="glass-overlay-dense w-full max-w-lg max-h-[88vh] flex flex-col overflow-hidden shadow-2xl text-slate-900 dark:text-slate-100"
      >
        {/* Fixed Modal Header */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-900/10 dark:border-white/10 shrink-0 flex items-center justify-between gap-4">
          <h2 id={headingId} className="text-lg font-semibold leading-snug">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="btn-secondary w-11 h-11 rounded-full inline-flex items-center justify-center cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>

        {/* Scrollable Modal Body */}
        <div className="overflow-y-auto px-6 py-5 flex-1 min-h-0">{children}</div>

        {/* Optional Fixed Modal Footer */}
        {footer && (
          <div className="px-6 py-4 border-t border-slate-900/10 dark:border-white/10 shrink-0 flex items-center justify-end gap-3">
            {footer}
          </div>
        )}
      </GlassCard>
    </div>,
    document.body
  );
}
