import React from 'react';
import { ArrowLeft, Fan, Power, SlidersHorizontal, Snowflake } from 'lucide-react';
import { usePostharvest } from '../context/PostharvestContext';
import type { CompressorMode } from '../types/postharvest';
import { getUiCopy } from '../utils/i18n';
import { evaluateRoomStatus } from '../utils/postharvestEngine';
import { GlassCard } from '../components/ui/GlassCard';
import {
  metricStateToBadge,
  severityToTone,
  SimulatedDataNotice,
  StatusBadge,
} from '../components/ui/StatusBadge';
import { DualTrendChart } from '../components/ui/TelemetryChart';

export function RoomDetailView() {
  const {
    state,
    setView,
    openRoom,
    reviewBatch,
    editCropRules,
    setCompressorMode,
    toggleDefrost,
    toggleSensorOnline,
  } = usePostharvest();

  const copy = getUiCopy(state.language);
  const room =
    state.rooms.find((r) => r.id === state.selectedRoomId) ?? state.rooms[0];
  const rule = state.rules[room.crop];
  const evaluation = evaluateRoomStatus(room, rule);

  const roomBatches = state.batches.filter(
    (b) => b.roomId === room.id && !b.released
  );

  const tempBadge = metricStateToBadge(evaluation.tempState);
  const humBadge = metricStateToBadge(evaluation.humidityState);
  const co2Badge = metricStateToBadge(evaluation.co2State);
  const gasBadge = metricStateToBadge(evaluation.gasState);

  const compressorModes: CompressorMode[] = ['auto', 'boost', 'standby'];

  return (
    <div className="flex flex-col gap-6">
      {/* Top Breadcrumb + Quick Zone Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setView('dashboard')}
          className="inline-flex items-center gap-1.5 text-sm font-semibold link-dorfic min-h-[44px] cursor-pointer whitespace-nowrap"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={1.75} />
          <span>{copy.backToDashboard}</span>
        </button>

        <div
          className="glass-recessed rounded-full p-1 inline-flex items-center gap-1 overflow-x-auto max-w-full"
          role="tablist"
          aria-label="Storage rooms"
        >
          {state.rooms.map((r) => {
            const active = r.id === room.id;
            return (
              <button
                key={r.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => openRoom(r.id)}
                className={`motion-snap min-h-[36px] px-3.5 rounded-full text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0 ${
                  active
                    ? 'pill-active'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-white/10'
                }`}
              >
                {r.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Room Heading Row */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl sm:text-[28px] font-bold text-slate-950 dark:text-white">
          {room.name} - {room.crop}
        </h1>
        <div className="flex flex-wrap items-center gap-2.5">
          <SimulatedDataNotice label={copy.simulatedNotice} />
          <StatusBadge
            tone={severityToTone(evaluation.severity)}
            label={evaluation.statusLabel}
          />
        </div>
      </header>

      {/* Primary Sensor Telemetry (3-up + Asymmetric Spoilage Gas & Equipment Controls) */}
      <section aria-label="Room sensor readings" className="flex flex-col gap-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <GlassCard tier="surface" radius="outer" specular className="p-5 flex flex-col justify-between gap-3">
            <span className="text-xs font-semibold tracking-wide uppercase text-slate-600 dark:text-slate-400">
              Temperature
            </span>
            <div className="font-tabular text-3xl font-bold text-slate-950 dark:text-white">
              {room.online ? `${room.tempC.toFixed(1)} °C` : '--.- °C'}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-tabular text-xs text-slate-600 dark:text-slate-400">
                Target: {rule.tempMin.toFixed(1)}-{rule.tempMax.toFixed(1)} °C
              </span>
              <StatusBadge tone={tempBadge.tone} label={tempBadge.label} compact />
            </div>
          </GlassCard>

          <GlassCard tier="surface" radius="outer" specular className="p-5 flex flex-col justify-between gap-3">
            <span className="text-xs font-semibold tracking-wide uppercase text-slate-600 dark:text-slate-400">
              Humidity
            </span>
            <div className="font-tabular text-3xl font-bold text-slate-950 dark:text-white">
              {room.online ? `${room.humidityPct.toFixed(1)} %` : '--.- %'}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-tabular text-xs text-slate-600 dark:text-slate-400">
                Target: {rule.humidityMin}-{rule.humidityMax} %
              </span>
              <StatusBadge tone={humBadge.tone} label={humBadge.label} compact />
            </div>
          </GlassCard>

          <GlassCard tier="surface" radius="outer" specular className="p-5 flex flex-col justify-between gap-3">
            <span className="text-xs font-semibold tracking-wide uppercase text-slate-600 dark:text-slate-400">
              CO2
            </span>
            <div className="font-tabular text-3xl font-bold text-slate-950 dark:text-white">
              {room.online ? `${room.co2Ppm} ppm` : '--- ppm'}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-tabular text-xs text-slate-600 dark:text-slate-400">
                Target: below {rule.co2Max} ppm
              </span>
              <StatusBadge tone={co2Badge.tone} label={co2Badge.label} compact />
            </div>
          </GlassCard>
        </div>

        {/* Asymmetric Split: 55% Spoilage-Gas Index / 45% Equipment & Sensor Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <GlassCard
            tier="surface"
            radius="outer"
            specular
            className="lg:col-span-6 p-5 flex flex-wrap items-center justify-between gap-4"
          >
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold tracking-wide uppercase text-slate-600 dark:text-slate-400">
                Spoilage-gas index
              </span>
              <div className="font-tabular text-3xl font-bold text-slate-950 dark:text-white">
                {room.online ? room.gasIndex.toFixed(1) : '--.-'}
              </div>
              <span className="font-tabular text-xs text-slate-600 dark:text-slate-400">
                Target: below {rule.gasIndexMax.toFixed(1)}
              </span>
            </div>
            <StatusBadge tone={gasBadge.tone} label={gasBadge.label} />
          </GlassCard>

          <GlassCard
            tier="surface"
            radius="outer"
            className="lg:col-span-6 p-5 flex flex-col justify-between gap-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold tracking-wide uppercase text-slate-600 dark:text-slate-400">
                {copy.equipmentControls}
              </span>
              <span className="font-tabular text-xs text-slate-600 dark:text-slate-400">
                Door: {room.doorClosed ? 'Sealed' : 'Open'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <div
                className="glass-recessed rounded-full p-1 inline-flex items-center gap-1"
                role="group"
                aria-label="Compressor mode"
              >
                {compressorModes.map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setCompressorMode(room.id, mode)}
                    className={`motion-snap min-h-[36px] px-3 rounded-full text-xs font-semibold capitalize cursor-pointer whitespace-nowrap inline-flex items-center gap-1 ${
                      room.compressorMode === mode
                        ? 'pill-active'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-white/10'
                    }`}
                  >
                    <Fan className="w-3.5 h-3.5" strokeWidth={1.75} />
                    <span>{mode}</span>
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => toggleDefrost(room.id)}
                className={`min-h-[44px] px-3.5 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  room.defrostActive ? 'btn-primary' : 'btn-secondary'
                }`}
              >
                <Snowflake className="w-3.5 h-3.5" strokeWidth={1.75} />
                <span>Defrost: {room.defrostActive ? 'Active' : 'Off'}</span>
              </button>

              <button
                type="button"
                onClick={() => toggleSensorOnline(room.id)}
                className="btn-secondary min-h-[44px] px-3.5 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Power className="w-3.5 h-3.5" strokeWidth={1.75} />
                <span>{room.online ? 'Simulate offline' : 'Reconnect sensor'}</span>
              </button>
            </div>
          </GlassCard>
        </div>
      </section>

      {/* 24h Trend Charts */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <GlassCard tier="surface" radius="outer" className="p-5">
          <DualTrendChart
            title="Temperature and humidity, last 24 h"
            points={room.history24h}
            solidKey="tempC"
            solidLabel="Temp"
            solidUnit="°C"
            dashedKey="humidityPct"
            dashedLabel="Humidity"
            dashedUnit="%"
            targetMin={rule.tempMin}
            targetMax={rule.tempMax}
            legendNote="Solid: temperature. Dashed: humidity. Shaded: target range."
            offline={!room.online}
            offlineSince={room.offlineSince}
            onReconnect={() => toggleSensorOnline(room.id)}
          />
        </GlassCard>

        <GlassCard tier="surface" radius="outer" className="p-5">
          <DualTrendChart
            title="CO2 and gas index, last 24 h"
            points={room.history24h}
            solidKey="co2Ppm"
            solidLabel="CO2"
            solidUnit="ppm"
            dashedKey="gasIndex"
            dashedLabel="Gas"
            dashedUnit="idx"
            targetMin={300}
            targetMax={rule.co2Max}
            legendNote="Solid: CO2. Dashed: gas index. Shaded: acceptable range."
            offline={!room.online}
            offlineSince={room.offlineSince}
            onReconnect={() => toggleSensorOnline(room.id)}
          />
        </GlassCard>
      </section>

      {/* Bottom Asymmetric Split: 65% Batches + Rack Capacity / 35% Active Rules */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
        <GlassCard
          tier="surface"
          radius="outer"
          className="xl:col-span-8 p-5 flex flex-col gap-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold tracking-wide uppercase text-slate-700 dark:text-slate-300">
                {copy.batchesInRoom}
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Batches stored in {room.name}
              </p>
            </div>
            <span className="font-tabular text-xs text-slate-600 dark:text-slate-400">
              {roomBatches.reduce((sum, b) => sum + b.qtyKg, 0).toLocaleString()}{' '}
              kg active
            </span>
          </div>

          {/* Rack / Bay Capacity Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {room.racks.map((rack) => {
              const usedKg = roomBatches
                .filter((b) => b.rackId === rack.id)
                .reduce((sum, b) => sum + b.qtyKg, 0);
              const pct = Math.min(100, Math.round((usedKg / rack.capacityKg) * 100));
              return (
                <div
                  key={rack.id}
                  className="glass-recessed rounded-[16px] px-3.5 py-2.5 flex flex-col gap-1.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {rack.label}
                    </span>
                    <span className="font-tabular text-slate-600 dark:text-slate-400">
                      {usedKg}/{rack.capacityKg} kg
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-900/10 dark:bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#FF6B00]"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {roomBatches.length === 0 ? (
            <div className="glass-recessed rounded-[20px] p-5 flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm text-slate-600 dark:text-slate-300">
                No active batches stored in {room.name}.
              </span>
              <button
                type="button"
                onClick={() => setView('inventory')}
                className="btn-secondary min-h-[44px] px-4 rounded-full text-xs font-semibold cursor-pointer"
              >
                Open inventory planner
              </button>
            </div>
          ) : (
            <div className="glass-recessed rounded-[20px] overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-900/10 dark:border-white/10 text-xs text-slate-600 dark:text-slate-400">
                    <th className="py-3 px-4 font-semibold">Batch</th>
                    <th className="py-3 px-3 font-semibold">Crop</th>
                    <th className="py-3 px-3 font-semibold">Rack</th>
                    <th className="py-3 px-3 font-semibold text-right">Qty (kg)</th>
                    <th className="py-3 px-3 font-semibold">Harvested</th>
                    <th className="py-3 px-4 font-semibold text-right">
                      Shelf life left
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900/8 dark:divide-white/8">
                  {roomBatches.map((batch) => (
                    <tr
                      key={batch.id}
                      className="hover:bg-white/50 dark:hover:bg-white/[0.04]"
                    >
                      <td className="py-3 px-4 font-tabular font-semibold">
                        <button
                          type="button"
                          onClick={() => reviewBatch(batch.id)}
                          className="link-dorfic cursor-pointer"
                        >
                          {batch.id}
                        </button>
                      </td>
                      <td className="py-3 px-3 text-slate-800 dark:text-slate-200">
                        {batch.crop}
                      </td>
                      <td className="py-3 px-3 font-tabular text-slate-600 dark:text-slate-400">
                        {batch.rackId}
                      </td>
                      <td className="py-3 px-3 font-tabular text-right font-medium text-slate-900 dark:text-slate-100">
                        {batch.qtyKg}
                      </td>
                      <td className="py-3 px-3 font-tabular text-slate-600 dark:text-slate-400">
                        {batch.harvestedDate}
                      </td>
                      <td className="py-3 px-4 font-tabular text-right font-medium text-slate-900 dark:text-slate-100">
                        {batch.shelfLifeDays} days
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </GlassCard>

        {/* Active Rules Rail */}
        <GlassCard
          tier="surface"
          radius="outer"
          className="xl:col-span-4 p-5 flex flex-col justify-between gap-4"
        >
          <div className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold tracking-wide uppercase text-slate-700 dark:text-slate-300">
              {copy.activeRules}
            </h2>

            <div className="flex flex-col gap-3.5">
              <div className="glass-recessed rounded-[18px] p-3.5 flex flex-col gap-2">
                <p className="text-sm text-slate-800 dark:text-slate-200">
                  Temperature above{' '}
                  <span className="font-tabular font-semibold">
                    {rule.tempMax.toFixed(1)} °C
                  </span>{' '}
                  for{' '}
                  <span className="font-tabular font-semibold">
                    {rule.tempHoldMinutes} min
                  </span>
                </p>
                <div className="self-start">
                  <StatusBadge tone="critical" label="CRITICAL" compact />
                </div>
              </div>

              <div className="glass-recessed rounded-[18px] p-3.5 flex flex-col gap-2">
                <p className="text-sm text-slate-800 dark:text-slate-200">
                  Humidity outside{' '}
                  <span className="font-tabular font-semibold">
                    {rule.humidityMin}-{rule.humidityMax} %
                  </span>
                </p>
                <div className="self-start">
                  <StatusBadge tone="warning" label="WARNING" compact />
                </div>
              </div>

              <div className="glass-recessed rounded-[18px] p-3.5 flex flex-col gap-2">
                <p className="text-sm text-slate-800 dark:text-slate-200">
                  CO2 above{' '}
                  <span className="font-tabular font-semibold">
                    {rule.co2Max} ppm
                  </span>{' '}
                  or gas above{' '}
                  <span className="font-tabular font-semibold">
                    {rule.gasIndexMax.toFixed(1)}
                  </span>
                </p>
                <div className="self-start">
                  <StatusBadge tone="warning" label="WARNING" compact />
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => editCropRules(room.crop)}
            className="btn-secondary min-h-[44px] w-full px-4 rounded-full text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
          >
            <SlidersHorizontal className="w-4 h-4" strokeWidth={1.75} />
            <span>{copy.editThresholds}</span>
          </button>
        </GlassCard>
      </section>
    </div>
  );
}
