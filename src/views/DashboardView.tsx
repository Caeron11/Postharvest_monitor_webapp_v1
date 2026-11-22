import React from 'react';
import { ArrowRight, RefreshCw } from 'lucide-react';
import { usePostharvest } from '../context/PostharvestContext';
import { formatCropLabel, getUiCopy } from '../utils/i18n';
import {
  computeBatchRecommendation,
  evaluateRoomStatus,
  sortRoomsBySeverity,
} from '../utils/postharvestEngine';
import { GlassCard } from '../components/ui/GlassCard';
import {
  recommendationToTone,
  severityToTone,
  SimulatedDataNotice,
  StatusBadge,
} from '../components/ui/StatusBadge';
import { PriceWindowChart } from '../components/ui/TelemetryChart';

export function DashboardView() {
  const {
    state,
    kpis,
    isHydrating,
    openRoom,
    reviewBatch,
    setView,
    acknowledgeAlert,
    toggleAutoRefresh,
  } = usePostharvest();

  const copy = getUiCopy(state.language);
  const sortedRooms = sortRoomsBySeverity(state.rooms, state.rules);

  const openAlerts = state.alerts.filter((a) => !a.acknowledged);
  const topCriticalAlert =
    openAlerts.find((a) => a.severity === 'critical') ?? null;

  const activeBatches = state.batches.filter((b) => !b.released);
  const batchWithRecs = activeBatches
    .map((batch) => {
      const room = state.rooms.find((r) => r.id === batch.roomId);
      const roomEval = room
        ? evaluateRoomStatus(room, state.rules[room.crop])
        : {
            severity: 'in_range' as const,
            primaryMetric: null,
            statusLabel: 'IN RANGE',
            tempState: 'in_range' as const,
            humidityState: 'in_range' as const,
            co2State: 'in_range' as const,
            gasState: 'in_range' as const,
          };
      const recommendation = computeBatchRecommendation(batch, roomEval);
      return { batch, recommendation };
    })
    .sort((a, b) => a.recommendation.urgencyScore - b.recommendation.urgencyScore);

  const focalCrop = batchWithRecs[0]?.batch.crop ?? 'Broccoli';
  const focalTargetPrice = batchWithRecs[0]?.batch.targetPricePhp ?? 145;

  if (isHydrating) {
    return (
      <div className="flex flex-col gap-5" aria-busy="true">
        <div className="h-10 w-64 rounded-full skeleton-shimmer" />
        <div className="h-20 w-full rounded-[24px] skeleton-shimmer" />
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-4 h-32 rounded-[28px] skeleton-shimmer" />
          <div className="md:col-span-4 h-32 rounded-[28px] skeleton-shimmer" />
          <div className="md:col-span-4 h-32 rounded-[28px] skeleton-shimmer" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Top Header Strip */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl sm:text-[28px] font-bold text-slate-950 dark:text-white">
          {copy.navDashboard}
        </h1>

        <div className="flex flex-wrap items-center gap-2.5">
          <SimulatedDataNotice label={copy.simulatedNotice} />
          <span className="font-tabular text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
            {copy.updatedLabel} {state.lastUpdated}
          </span>
          <button
            type="button"
            onClick={toggleAutoRefresh}
            className="btn-secondary min-h-[44px] px-4 rounded-full text-xs font-semibold inline-flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.75} />
            <span>
              {copy.autoRefreshLabel}:{' '}
              {state.autoRefresh ? copy.onLabel : copy.offLabel}
            </span>
          </button>
        </div>
      </header>

      {/* Critical Alert Banner */}
      {topCriticalAlert && (
        <GlassCard
          tier="surface"
          radius="nested"
          refraction
          className="px-4 sm:px-5 py-3.5 bg-[#F43F5E]/[0.08] dark:bg-[#F43F5E]/[0.14] border border-[#BE123C]/30 dark:border-[#FB7185]/35 flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex flex-wrap items-center gap-3 min-w-0">
            <StatusBadge tone="critical" label="CRITICAL" />
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {topCriticalAlert.message}
              {(() => {
                const room = state.rooms.find(
                  (r) => r.id === topCriticalAlert.roomId
                );
                return room && room.breachDurationMin > 0
                  ? ` for ${room.breachDurationMin} min`
                  : '';
              })()}
            </p>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => openRoom(topCriticalAlert.roomId)}
              className="text-sm font-semibold link-dorfic min-h-[44px] px-2 cursor-pointer whitespace-nowrap"
            >
              Open {topCriticalAlert.roomName}
            </button>
            <button
              type="button"
              onClick={() => acknowledgeAlert(topCriticalAlert.id)}
              className="btn-primary min-h-[44px] px-5 rounded-full text-sm font-semibold cursor-pointer whitespace-nowrap"
            >
              Acknowledge
            </button>
          </div>
        </GlassCard>
      )}

      {/* Synced KPI Bento */}
      <section aria-label="Facility KPI summary" className="flex flex-col gap-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <GlassCard
            tier="surface"
            radius="outer"
            specular
            className="md:col-span-4 p-5 flex flex-col justify-between gap-2"
          >
            <span className="text-xs font-semibold tracking-wide uppercase text-slate-600 dark:text-slate-400">
              {copy.activeAlerts}
            </span>
            <div
              data-testid="kpi-active-alerts"
              className="font-tabular text-3xl font-bold text-slate-950 dark:text-white"
            >
              {kpis.openAlertsCount}
            </div>
            <span className="font-tabular text-xs text-slate-600 dark:text-slate-400">
              {kpis.criticalAlertsCount} critical, {kpis.warningAlertsCount}{' '}
              warning
              {kpis.noDataAlertsCount > 0
                ? `, ${kpis.noDataAlertsCount} offline`
                : ''}
            </span>
          </GlassCard>

          <GlassCard
            tier="surface"
            radius="outer"
            specular
            className="md:col-span-4 p-5 flex flex-col justify-between gap-2"
          >
            <span className="text-xs font-semibold tracking-wide uppercase text-slate-600 dark:text-slate-400">
              {copy.roomsInRange}
            </span>
            <div
              data-testid="kpi-rooms-in-range"
              className="font-tabular text-3xl font-bold text-slate-950 dark:text-white"
            >
              {kpis.roomsInRangeCount} of {kpis.totalRoomsCount}
            </div>
            <span className="font-tabular text-xs text-slate-600 dark:text-slate-400">
              {kpis.offlineRoomsCount === 0
                ? 'All sensors online'
                : `${kpis.offlineRoomsCount} sensor offline`}
            </span>
          </GlassCard>

          <GlassCard
            tier="surface"
            radius="outer"
            specular
            className="md:col-span-4 p-5 flex flex-col justify-between gap-2"
          >
            <span className="text-xs font-semibold tracking-wide uppercase text-slate-600 dark:text-slate-400">
              {copy.batchesInStorage}
            </span>
            <div
              data-testid="kpi-batches-count"
              className="font-tabular text-3xl font-bold text-slate-950 dark:text-white"
            >
              {kpis.activeBatchesCount}
            </div>
            <span className="font-tabular text-xs text-slate-600 dark:text-slate-400">
              {kpis.totalStorageKg.toLocaleString()} kg total
            </span>
          </GlassCard>
        </div>

        {/* Full-Width Release Window Opening Strip */}
        <GlassCard
          tier="surface"
          radius="outer"
          specular
          className="px-5 py-4 flex flex-wrap items-center justify-between gap-4"
        >
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="text-xs font-semibold tracking-wide uppercase text-slate-600 dark:text-slate-400">
              {copy.releaseWindowOpening}
            </span>
            <span className="font-tabular text-2xl font-bold text-slate-950 dark:text-white">
              {kpis.releaseOpeningCount}{' '}
              {kpis.releaseOpeningCount === 1 ? 'batch' : 'batches'}
            </span>
            <span className="text-xs text-slate-600 dark:text-slate-400">
              this week
            </span>
          </div>
          <button
            type="button"
            onClick={() => setView('inventory')}
            className="inline-flex items-center gap-1.5 text-sm font-semibold link-dorfic min-h-[44px] px-2 cursor-pointer whitespace-nowrap"
          >
            <span>{copy.reviewRecommendations}</span>
            <ArrowRight className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </GlassCard>
      </section>

      {/* Main Asymmetric Split: 65% Storage Rooms / 35% Active Alerts Rail */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
        <GlassCard
          tier="surface"
          radius="outer"
          className="xl:col-span-8 p-5 flex flex-col gap-4"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold tracking-wide uppercase text-slate-700 dark:text-slate-300">
              {copy.storageRoomsHeading}
            </h2>
            <span className="font-tabular text-xs text-slate-500 dark:text-slate-400">
              {kpis.totalRoomsCount} zones
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {sortedRooms.map((room) => {
              const evaluation = evaluateRoomStatus(room, state.rules[room.crop]);
              return (
                <div
                  key={room.id}
                  className="glass-recessed rounded-[20px] p-4 flex flex-col justify-between gap-3.5"
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-base font-bold text-slate-950 dark:text-white whitespace-nowrap">
                          {room.name}
                        </h3>
                        <StatusBadge
                          tone={severityToTone(evaluation.severity)}
                          label={evaluation.statusLabel}
                          compact
                        />
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 truncate">
                        {formatCropLabel(room.crop, state.language)}
                        {room.variety ? ` (${room.variety})` : ''}
                      </p>
                    </div>

                    {room.online ? (
                      <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 pt-1 text-xs">
                        <div className="flex items-center justify-between gap-1.5">
                          <dt className="text-slate-600 dark:text-slate-400 whitespace-nowrap">
                            Temp
                          </dt>
                          <dd className="font-tabular font-semibold text-slate-950 dark:text-white whitespace-nowrap">
                            {room.tempC.toFixed(1)} °C
                          </dd>
                        </div>
                        <div className="flex items-center justify-between gap-1.5">
                          <dt className="text-slate-600 dark:text-slate-400 whitespace-nowrap">
                            Humidity
                          </dt>
                          <dd className="font-tabular font-semibold text-slate-950 dark:text-white whitespace-nowrap">
                            {room.humidityPct.toFixed(1)} %
                          </dd>
                        </div>
                        <div className="flex items-center justify-between gap-1.5">
                          <dt className="text-slate-600 dark:text-slate-400 whitespace-nowrap">
                            CO2
                          </dt>
                          <dd className="font-tabular font-semibold text-slate-950 dark:text-white whitespace-nowrap">
                            {room.co2Ppm} ppm
                          </dd>
                        </div>
                        <div className="flex items-center justify-between gap-1.5">
                          <dt className="text-slate-600 dark:text-slate-400 whitespace-nowrap">
                            Gas index
                          </dt>
                          <dd className="font-tabular font-semibold text-slate-950 dark:text-white whitespace-nowrap">
                            {room.gasIndex.toFixed(1)}
                          </dd>
                        </div>
                      </dl>
                    ) : (
                      <p className="text-xs text-slate-600 dark:text-slate-400 pt-1 leading-relaxed">
                        Sensor offline since {room.offlineSince ?? '05:14'}. Last
                        known values hidden.
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => openRoom(room.id)}
                    className="self-start text-xs font-semibold link-dorfic min-h-[36px] inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                  >
                    <span>View {room.name} details</span>
                    <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.75} />
                  </button>
                </div>
              );
            })}
          </div>
        </GlassCard>

        {/* Active Alerts Rail */}
        <GlassCard
          tier="surface"
          radius="outer"
          className="xl:col-span-4 p-5 flex flex-col justify-between gap-4"
        >
          <div className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold tracking-wide uppercase text-slate-700 dark:text-slate-300">
              {copy.activeAlerts}
            </h2>

            {openAlerts.length === 0 ? (
              <div className="glass-recessed rounded-[20px] p-5 text-sm text-slate-600 dark:text-slate-300">
                All active alerts acknowledged.
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-slate-900/10 dark:divide-white/10">
                {openAlerts.slice(0, 3).map((alert) => (
                  <div
                    key={alert.id}
                    className="py-3.5 first:pt-0 flex flex-col gap-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <StatusBadge
                        tone={severityToTone(alert.severity)}
                        label={
                          alert.severity === 'no_data'
                            ? 'NO DATA'
                            : alert.severity.toUpperCase()
                        }
                        compact
                      />
                      <span className="font-tabular text-xs text-slate-500 dark:text-slate-400">
                        {alert.timestamp}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {alert.message}
                    </p>
                    <button
                      type="button"
                      onClick={() => acknowledgeAlert(alert.id)}
                      className="btn-secondary self-start min-h-[40px] px-4 rounded-full text-xs font-semibold cursor-pointer whitespace-nowrap"
                    >
                      Acknowledge {alert.roomName}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setView('alerts')}
            className="self-start text-xs font-semibold link-dorfic min-h-[36px] inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
          >
            <span>View all alerts</span>
            <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.75} />
          </button>
        </GlassCard>
      </section>

      {/* Bottom Asymmetric Split: 60% Decisions Today / 40% Farmgate Price Chart */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
        <GlassCard
          tier="surface"
          radius="outer"
          className="xl:col-span-7 p-5 flex flex-col gap-4"
        >
          <h2 className="text-sm font-semibold tracking-wide uppercase text-slate-700 dark:text-slate-300">
            {copy.decisionsToday}
          </h2>

          {batchWithRecs.length === 0 ? (
            <div className="glass-recessed rounded-[20px] p-5 flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm text-slate-600 dark:text-slate-300">
                No active batches remaining in storage.
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
            <div className="glass-recessed rounded-[20px] divide-y divide-slate-900/10 dark:divide-white/10">
              {batchWithRecs.slice(0, 4).map(({ batch, recommendation }) => (
                <div
                  key={batch.id}
                  className="px-4 py-3 flex flex-wrap items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-950 dark:text-white">
                      <span className="font-tabular">{batch.id}</span> ·{' '}
                      {formatCropLabel(batch.crop, state.language)}
                    </div>
                    <div className="font-tabular text-xs text-slate-600 dark:text-slate-400">
                      Shelf life left: {batch.shelfLifeDays} days ·{' '}
                      {batch.qtyKg} kg
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <StatusBadge
                      tone={recommendationToTone(recommendation.status)}
                      label={recommendation.badgeLabel}
                      compact
                    />
                    <button
                      type="button"
                      onClick={() => reviewBatch(batch.id)}
                      className="text-xs font-semibold link-dorfic min-h-[40px] px-1 cursor-pointer whitespace-nowrap"
                    >
                      Review {batch.id}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassCard>

        <GlassCard
          tier="surface"
          radius="outer"
          className="xl:col-span-5 p-5 flex flex-col gap-3"
        >
          <h2 className="text-sm font-semibold tracking-wide uppercase text-slate-700 dark:text-slate-300">
            {copy.farmgatePriceHeading}
          </h2>
          <PriceWindowChart
            crop={formatCropLabel(focalCrop, state.language)}
            points={state.priceSeriesByCrop[focalCrop]}
            targetPricePhp={focalTargetPrice}
          />
        </GlassCard>
      </section>
    </div>
  );
}
