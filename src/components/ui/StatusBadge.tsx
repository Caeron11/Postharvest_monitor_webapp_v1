import React from 'react';
import type {
  MetricState,
  RecommendationStatus,
  SeverityLevel,
} from '../../types/postharvest';

export type BadgeTone = 'critical' | 'warning' | 'nominal' | 'offline';

interface StatusBadgeProps {
  tone: BadgeTone;
  label: string;
  compact?: boolean;
}

const TONE_STYLES: Record<
  BadgeTone,
  { wrapper: string; glyph: string }
> = {
  critical: {
    wrapper:
      'bg-[#F43F5E]/16 text-[#BE123C] border-[#BE123C]/35 dark:bg-[#F43F5E]/18 dark:text-[#FB7185] dark:border-[#FB7185]/40',
    glyph: '■',
  },
  warning: {
    wrapper:
      'bg-[#F59E0B]/16 text-[#B45309] border-[#B45309]/40 border-dashed dark:bg-[#F59E0B]/18 dark:text-[#FBBF24] dark:border-[#FBBF24]/45',
    glyph: '▲',
  },
  nominal: {
    wrapper:
      'bg-[#0EA5E9]/14 text-[#0369A1] border-[#0284C7]/35 dark:bg-[#0EA5E9]/16 dark:text-[#38BDF8] dark:border-[#38BDF8]/35',
    glyph: '●',
  },
  offline: {
    wrapper:
      'bg-[#94A3B8]/16 text-[#475569] border-[#64748B]/35 dark:bg-[#94A3B8]/16 dark:text-[#94A3B8] dark:border-[#94A3B8]/35',
    glyph: '○',
  },
};

export function severityToTone(severity: SeverityLevel): BadgeTone {
  if (severity === 'critical') return 'critical';
  if (severity === 'warning') return 'warning';
  if (severity === 'no_data') return 'offline';
  return 'nominal';
}

export function metricStateToBadge(
  state: MetricState
): { tone: BadgeTone; label: string } {
  switch (state) {
    case 'above':
      return { tone: 'critical', label: 'ABOVE RANGE' };
    case 'below':
      return { tone: 'warning', label: 'BELOW RANGE' };
    case 'rising':
      return { tone: 'warning', label: 'RISING' };
    case 'no_data':
      return { tone: 'offline', label: 'NO DATA' };
    default:
      return { tone: 'nominal', label: 'IN RANGE' };
  }
}

export function recommendationToTone(status: RecommendationStatus): BadgeTone {
  switch (status) {
    case 'release_now':
      return 'critical';
    case 'release_soon':
      return 'warning';
    case 'released':
      return 'offline';
    default:
      return 'nominal';
  }
}

export function StatusBadge({
  tone,
  label,
  compact = false,
}: StatusBadgeProps) {
  const style = TONE_STYLES[tone];
  return (
    <span
      className={`inline-flex items-center gap-1.5 border font-tabular font-semibold tracking-tight whitespace-nowrap shrink-0 rounded-full ${
        compact ? 'px-2.5 py-0.5 text-[11px]' : 'px-3 py-1 text-xs'
      } ${style.wrapper}`}
    >
      <span aria-hidden="true" className="text-[9px] leading-none">
        {style.glyph}
      </span>
      <span>{label}</span>
    </span>
  );
}

export function SimulatedDataNotice({
  label = 'Simulated data: not live sensor readings',
}: {
  label?: string;
}) {
  return (
    <span
      className="inline-flex items-center px-3 py-1.5 rounded-full border border-dashed border-slate-500/45 dark:border-slate-400/40 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white/40 dark:bg-white/[0.04] whitespace-nowrap shrink-0"
      title="Telemetry readings are generated from deterministic postharvest models"
    >
      {label}
    </span>
  );
}
