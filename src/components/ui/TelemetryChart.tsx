import React, { useState } from 'react';
import { Table, TrendingUp } from 'lucide-react';
import type { PricePoint, TelemetryPoint } from '../../types/postharvest';

interface DualTrendChartProps {
  title: string;
  points: TelemetryPoint[];
  solidKey: 'tempC' | 'co2Ppm';
  solidLabel: string;
  solidUnit: string;
  dashedKey: 'humidityPct' | 'gasIndex';
  dashedLabel: string;
  dashedUnit: string;
  targetMin: number;
  targetMax: number;
  legendNote: string;
  offline?: boolean;
  offlineSince?: string;
  onReconnect?: () => void;
}

export function DualTrendChart({
  title,
  points,
  solidKey,
  solidLabel,
  solidUnit,
  dashedKey,
  dashedLabel,
  dashedUnit,
  targetMin,
  targetMax,
  legendNote,
  offline = false,
  offlineSince,
  onReconnect,
}: DualTrendChartProps) {
  const [showTable, setShowTable] = useState(false);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (offline) {
    return (
      <div className="flex flex-col h-full justify-between gap-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {title}
          </h3>
        </div>
        <div className="glass-recessed rounded-[20px] p-6 flex flex-col items-start justify-center gap-3 min-h-[172px]">
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
            Sensor offline since {offlineSince ?? '05:14'}
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            24h trend data paused until telemetry link restores.
          </p>
          {onReconnect && (
            <button
              type="button"
              onClick={onReconnect}
              className="btn-secondary min-h-[44px] px-4 rounded-full text-xs font-semibold cursor-pointer whitespace-nowrap"
            >
              Reconnect sensor
            </button>
          )}
        </div>
      </div>
    );
  }

  const width = 520;
  const height = 168;
  const padL = 38;
  const padR = 16;
  const padT = 18;
  const padB = 26;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const solidVals = points.map((p) => p[solidKey]);
  const dashedVals = points.map((p) => p[dashedKey]);

  const solidMin = Math.min(...solidVals, targetMin) - (solidKey === 'tempC' ? 1.2 : 80);
  const solidMax = Math.max(...solidVals, targetMax) + (solidKey === 'tempC' ? 1.2 : 120);
  const solidSpan = Math.max(0.1, solidMax - solidMin);

  const dashedMin = Math.max(
    0,
    Math.min(...dashedVals) - (dashedKey === 'humidityPct' ? 4 : 25)
  );
  const dashedMax =
    Math.max(...dashedVals) + (dashedKey === 'humidityPct' ? 4 : 25);
  const dashedSpan = Math.max(0.1, dashedMax - dashedMin);

  const xAt = (idx: number) =>
    padL + (idx / Math.max(1, points.length - 1)) * plotW;
  const ySolid = (val: number) =>
    padT + (1 - (val - solidMin) / solidSpan) * plotH;
  const yDashed = (val: number) =>
    padT + (1 - (val - dashedMin) / dashedSpan) * plotH;

  const solidPath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(1)} ${ySolid(p[solidKey]).toFixed(1)}`)
    .join(' ');
  const dashedPath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(1)} ${yDashed(p[dashedKey]).toFixed(1)}`)
    .join(' ');

  const bandTop = Math.max(padT, ySolid(targetMax));
  const bandBottom = Math.min(padT + plotH, ySolid(targetMin));
  const bandHeight = Math.max(4, bandBottom - bandTop);

  const activePoint = hoverIdx !== null ? points[hoverIdx] : null;

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {title}
        </h3>
        <button
          type="button"
          onClick={() => setShowTable((prev) => !prev)}
          className="btn-secondary min-h-[36px] px-3.5 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
        >
          {showTable ? (
            <>
              <TrendingUp className="w-3.5 h-3.5" strokeWidth={1.75} />
              <span>View as chart</span>
            </>
          ) : (
            <>
              <Table className="w-3.5 h-3.5" strokeWidth={1.75} />
              <span>View as table</span>
            </>
          )}
        </button>
      </div>

      {showTable ? (
        <div className="glass-recessed rounded-[20px] overflow-x-auto max-h-[210px]">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-900/10 dark:border-white/10 text-slate-600 dark:text-slate-400">
                <th className="py-2.5 px-3 font-semibold">Time</th>
                <th className="py-2.5 px-3 font-semibold text-right">
                  {solidLabel} ({solidUnit})
                </th>
                <th className="py-2.5 px-3 font-semibold text-right">
                  {dashedLabel} ({dashedUnit})
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900/8 dark:divide-white/8 font-tabular">
              {points.map((pt, i) => (
                <tr key={`${pt.hourLabel}-${i}`}>
                  <td className="py-2 px-3 text-slate-700 dark:text-slate-300">
                    {pt.hourLabel}
                  </td>
                  <td className="py-2 px-3 text-right text-slate-900 dark:text-slate-100 font-medium">
                    {pt[solidKey]}
                  </td>
                  <td className="py-2 px-3 text-right text-slate-700 dark:text-slate-300">
                    {pt[dashedKey]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="glass-recessed rounded-[20px] p-3 relative">
          <div className="flex items-center justify-between text-[11px] font-tabular text-slate-600 dark:text-slate-400 mb-1 px-1">
            <span>Target range</span>
            {activePoint ? (
              <span className="text-slate-900 dark:text-slate-100 font-semibold">
                {activePoint.hourLabel} · {activePoint[solidKey]} {solidUnit} ·{' '}
                {activePoint[dashedKey]} {dashedUnit}
              </span>
            ) : (
              <span>
                {targetMin}-{targetMax} {solidUnit}
              </span>
            )}
          </div>
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-[168px] overflow-visible select-none"
            role="img"
            aria-label={title}
            onMouseLeave={() => setHoverIdx(null)}
          >
            {/* Shaded target range */}
            <rect
              x={padL}
              y={bandTop}
              width={plotW}
              height={bandHeight}
              rx={4}
              className="fill-[#0EA5E9]/14 dark:fill-[#0EA5E9]/16 stroke-[#0284C7]/40 dark:stroke-[#38BDF8]/40"
              strokeDasharray="3 3"
              strokeWidth="1"
            />

            {/* Y-axis ticks */}
            {[solidMin, (solidMin + solidMax) / 2, solidMax].map((tick, idx) => (
              <g key={idx}>
                <line
                  x1={padL}
                  x2={padL + plotW}
                  y1={ySolid(tick)}
                  y2={ySolid(tick)}
                  className="stroke-slate-900/8 dark:stroke-white/8"
                  strokeWidth="1"
                />
                <text
                  x={padL - 6}
                  y={ySolid(tick) + 3}
                  textAnchor="end"
                  className="fill-slate-500 dark:fill-slate-400 text-[10px] font-tabular"
                >
                  {solidKey === 'tempC' ? tick.toFixed(1) : Math.round(tick)}
                </text>
              </g>
            ))}

            {/* Dashed secondary line (Cool Steel) */}
            <path
              d={dashedPath}
              fill="none"
              className="stroke-[#64748B] dark:stroke-[#94A3B8]"
              strokeWidth="2"
              strokeDasharray="5 4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Solid primary line (DORFiC Tangerine) */}
            <path
              d={solidPath}
              fill="none"
              className="stroke-[#FF6B00]"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Hover crosshair & hit regions */}
            {hoverIdx !== null && (
              <g>
                <line
                  x1={xAt(hoverIdx)}
                  x2={xAt(hoverIdx)}
                  y1={padT}
                  y2={padT + plotH}
                  className="stroke-[#64748B]/55 dark:stroke-[#94A3B8]/45"
                  strokeDasharray="2 2"
                />
                <circle
                  cx={xAt(hoverIdx)}
                  cy={ySolid(points[hoverIdx][solidKey])}
                  r="4.25"
                  className="fill-[#FF6B00] stroke-white dark:stroke-[#111318]"
                  strokeWidth="1.5"
                />
                <circle
                  cx={xAt(hoverIdx)}
                  cy={yDashed(points[hoverIdx][dashedKey])}
                  r="3.5"
                  className="fill-[#64748B] dark:fill-[#94A3B8] stroke-white dark:stroke-[#111318]"
                  strokeWidth="1.5"
                />
              </g>
            )}

            {/* X-axis labels */}
            {points.map((pt, i) => (
              <g key={`${pt.hourLabel}-${i}`}>
                {i % 2 === 0 && (
                  <text
                    x={xAt(i)}
                    y={height - 6}
                    textAnchor="middle"
                    className="fill-slate-500 dark:fill-slate-400 text-[10px] font-tabular"
                  >
                    {pt.hourLabel}
                  </text>
                )}
                <rect
                  x={xAt(i) - plotW / (points.length * 2)}
                  y={padT}
                  width={plotW / points.length}
                  height={plotH}
                  fill="transparent"
                  className="cursor-crosshair"
                  onMouseEnter={() => setHoverIdx(i)}
                />
              </g>
            ))}
          </svg>
        </div>
      )}

      <p className="text-xs text-slate-600 dark:text-slate-400">{legendNote}</p>
    </div>
  );
}

interface PriceWindowChartProps {
  crop: string;
  points: PricePoint[];
  targetPricePhp: number;
  compact?: boolean;
}

export function PriceWindowChart({
  crop,
  points,
  targetPricePhp,
  compact = false,
}: PriceWindowChartProps) {
  const [showTable, setShowTable] = useState(false);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const width = 420;
  const height = compact ? 112 : 136;
  const padL = 36;
  const padR = 14;
  const padT = 14;
  const padB = 22;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const prices = points.map((p) => p.pricePhp);
  const minP = Math.min(...prices, targetPricePhp) - 10;
  const maxP = Math.max(...prices, targetPricePhp) + 10;
  const span = Math.max(1, maxP - minP);

  const xAt = (idx: number) =>
    padL + (idx / Math.max(1, points.length - 1)) * plotW;
  const yAt = (val: number) => padT + (1 - (val - minP) / span) * plotH;

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(1)} ${yAt(p.pricePhp).toFixed(1)}`)
    .join(' ');

  const windowIndices = points
    .map((p, i) => (p.inReleaseWindow ? i : -1))
    .filter((i) => i >= 0);
  const winStart = windowIndices.length ? xAt(windowIndices[0]) : padL;
  const winEnd = windowIndices.length
    ? xAt(windowIndices[windowIndices.length - 1])
    : padL;

  const hovered = hoverIdx !== null ? points[hoverIdx] : null;

  return (
    <div className="flex flex-col gap-2.5">
      {showTable ? (
        <div className="glass-recessed rounded-[18px] overflow-x-auto max-h-[164px]">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-900/10 dark:border-white/10 text-slate-600 dark:text-slate-400">
                <th className="py-2 px-3 font-semibold">Day</th>
                <th className="py-2 px-3 font-semibold text-right">PHP/kg</th>
                <th className="py-2 px-3 font-semibold text-right">Window</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900/8 dark:divide-white/8 font-tabular">
              {points.map((pt) => (
                <tr key={pt.dayLabel}>
                  <td className="py-1.5 px-3 text-slate-700 dark:text-slate-300">
                    {pt.dayLabel}
                  </td>
                  <td className="py-1.5 px-3 text-right font-medium text-slate-900 dark:text-slate-100">
                    {pt.pricePhp}
                  </td>
                  <td className="py-1.5 px-3 text-right text-slate-600 dark:text-slate-400">
                    {pt.inReleaseWindow ? 'Open' : 'Hold'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="glass-recessed rounded-[18px] p-2.5">
          <div className="flex items-center justify-between text-[11px] font-tabular text-slate-600 dark:text-slate-400 px-1 mb-1">
            <span>Target {targetPricePhp} PHP/kg</span>
            {hovered ? (
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {hovered.dayLabel}: {hovered.pricePhp} PHP/kg
              </span>
            ) : (
              <span>{crop}</span>
            )}
          </div>
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className={`w-full ${compact ? 'h-[112px]' : 'h-[136px]'} select-none`}
            role="img"
            aria-label={`Farmgate price vs release window for ${crop}`}
            onMouseLeave={() => setHoverIdx(null)}
          >
            {/* Shaded suggested release window */}
            {windowIndices.length > 0 && (
              <rect
                x={winStart}
                y={padT}
                width={Math.max(18, winEnd - winStart)}
                height={plotH}
                rx={4}
                className="fill-[#0EA5E9]/14 dark:fill-[#0EA5E9]/18 stroke-[#0284C7]/40 dark:stroke-[#38BDF8]/40"
                strokeDasharray="3 3"
                strokeWidth="1"
              />
            )}

            {/* Target price reference line */}
            <line
              x1={padL}
              x2={padL + plotW}
              y1={yAt(targetPricePhp)}
              y2={yAt(targetPricePhp)}
              className="stroke-[#64748B]/50 dark:stroke-[#94A3B8]/50"
              strokeDasharray="4 3"
              strokeWidth="1"
            />

            {/* Y ticks */}
            {[minP, maxP].map((tick, idx) => (
              <text
                key={idx}
                x={padL - 6}
                y={yAt(tick) + 3}
                textAnchor="end"
                className="fill-slate-500 dark:fill-slate-400 text-[10px] font-tabular"
              >
                {Math.round(tick)}
              </text>
            ))}

            {/* Solid price curve (DORFiC Tangerine) */}
            <path
              d={linePath}
              fill="none"
              className="stroke-[#FF6B00]"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {hoverIdx !== null && (
              <circle
                cx={xAt(hoverIdx)}
                cy={yAt(points[hoverIdx].pricePhp)}
                r="4.25"
                className="fill-[#FF6B00] stroke-white dark:stroke-[#111318]"
                strokeWidth="1.5"
              />
            )}

            {points.map((pt, i) => (
              <g key={pt.dayLabel}>
                <text
                  x={xAt(i)}
                  y={height - 5}
                  textAnchor="middle"
                  className="fill-slate-500 dark:fill-slate-400 text-[10px] font-tabular"
                >
                  {pt.dayLabel}
                </text>
                <rect
                  x={xAt(i) - plotW / (points.length * 2)}
                  y={padT}
                  width={plotW / points.length}
                  height={plotH}
                  fill="transparent"
                  className="cursor-crosshair"
                  onMouseEnter={() => setHoverIdx(i)}
                />
              </g>
            ))}
          </svg>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-slate-600 dark:text-slate-400">
          Solid: PHP/kg. Shaded: release window. Source: DA/PSA feed.
        </span>
        <button
          type="button"
          onClick={() => setShowTable((prev) => !prev)}
          className="btn-secondary min-h-[36px] px-3.5 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
        >
          {showTable ? (
            <>
              <TrendingUp className="w-3.5 h-3.5" strokeWidth={1.75} />
              <span>View as chart</span>
            </>
          ) : (
            <>
              <Table className="w-3.5 h-3.5" strokeWidth={1.75} />
              <span>View as table</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
