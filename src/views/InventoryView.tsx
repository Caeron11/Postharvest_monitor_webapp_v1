import React, { useMemo, useState } from 'react';
import { ArrowUpDown, CalendarClock, Plus, RotateCcw } from 'lucide-react';
import { usePostharvest } from '../context/PostharvestContext';
import { CROP_LIST } from '../data/seedData';
import type { CropType, RecommendationStatus } from '../types/postharvest';
import { formatCropLabel, getUiCopy } from '../utils/i18n';
import {
  computeBatchRecommendation,
  evaluateRoomStatus,
} from '../utils/postharvestEngine';
import { FilterPopover } from '../components/ui/FilterPopover';
import { GlassCard } from '../components/ui/GlassCard';
import { Modal } from '../components/ui/Modal';
import {
  recommendationToTone,
  SimulatedDataNotice,
  StatusBadge,
} from '../components/ui/StatusBadge';
import { PriceWindowChart } from '../components/ui/TelemetryChart';

type SortKey = 'shelf_life' | 'qty_desc' | 'batch_id' | 'margin_desc';

export function InventoryView() {
  const {
    state,
    reviewBatch,
    releaseBatch,
    toggleBatchHold,
    restoreBatch,
    addBatch,
    openRoom,
  } = usePostharvest();

  const copy = getUiCopy(state.language);

  const [cropFilter, setCropFilter] = useState<string>('all');
  const [roomFilter, setRoomFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortKey>('shelf_life');

  // Release confirmation modal state
  const [releaseModalOpen, setReleaseModalOpen] = useState(false);
  const [releaseTargetId, setReleaseTargetId] = useState<string | null>(null);
  const [releaseQtyInput, setReleaseQtyInput] = useState<string>('');
  const [releaseNote, setReleaseNote] = useState<string>('');
  const [releaseError, setReleaseError] = useState<string | null>(null);

  // Add batch modal state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newCrop, setNewCrop] = useState<CropType>('Broccoli');
  const [newRoomId, setNewRoomId] = useState<string>('room-a');
  const [newRackId, setNewRackId] = useState<string>('R1');
  const [newQty, setNewQty] = useState<string>('320');
  const [newShelfLife, setNewShelfLife] = useState<string>('10');
  const [newCurrentPrice, setNewCurrentPrice] = useState<string>('152');
  const [newTargetPrice, setNewTargetPrice] = useState<string>('145');
  const [addError, setAddError] = useState<string | null>(null);

  const enrichedBatches = useMemo(() => {
    return state.batches.map((batch) => {
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
      return {
        batch,
        roomName: room?.name ?? batch.roomId,
        roomEval,
        recommendation,
      };
    });
  }, [state.batches, state.rooms, state.rules]);

  const filteredBatches = useMemo(() => {
    const list = enrichedBatches.filter(({ batch, recommendation }) => {
      if (cropFilter !== 'all' && batch.crop !== cropFilter) return false;
      if (roomFilter !== 'all' && batch.roomId !== roomFilter) return false;
      if (
        statusFilter !== 'all' &&
        recommendation.status !== (statusFilter as RecommendationStatus)
      ) {
        return false;
      }
      return true;
    });

    list.sort((a, b) => {
      if (a.batch.released !== b.batch.released) {
        return a.batch.released ? 1 : -1;
      }
      if (sortBy === 'shelf_life') {
        return a.batch.shelfLifeDays - b.batch.shelfLifeDays;
      }
      if (sortBy === 'qty_desc') {
        return b.batch.qtyKg - a.batch.qtyKg;
      }
      if (sortBy === 'margin_desc') {
        const marginA = a.batch.currentPricePhp - a.batch.targetPricePhp;
        const marginB = b.batch.currentPricePhp - b.batch.targetPricePhp;
        return marginB - marginA;
      }
      return a.batch.id.localeCompare(b.batch.id);
    });

    return list;
  }, [enrichedBatches, cropFilter, roomFilter, statusFilter, sortBy]);

  const selectedEntry =
    enrichedBatches.find((e) => e.batch.id === state.selectedBatchId) ??
    filteredBatches[0] ??
    enrichedBatches[0];

  const modalEntry =
    (releaseTargetId
      ? enrichedBatches.find((e) => e.batch.id === releaseTargetId)
      : selectedEntry) ?? selectedEntry;

  const fefoBuckets = useMemo(() => {
    const active = enrichedBatches.filter((e) => !e.batch.released);
    return {
      immediate: active.filter((e) => e.recommendation.status === 'release_now'),
      soon: active.filter((e) => e.recommendation.status === 'release_soon'),
      hold: active.filter((e) => e.recommendation.status === 'hold'),
    };
  }, [enrichedBatches]);

  const openReleaseModalFor = (batchId: string) => {
    const entry = enrichedBatches.find((e) => e.batch.id === batchId);
    if (!entry) return;
    reviewBatch(batchId);
    setReleaseTargetId(batchId);
    setReleaseQtyInput(String(entry.batch.qtyKg));
    setReleaseNote('');
    setReleaseError(null);
    setReleaseModalOpen(true);
  };

  const handleConfirmRelease = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalEntry) return;
    const parsedQty = Number(releaseQtyInput);
    if (!Number.isFinite(parsedQty) || parsedQty <= 0) {
      setReleaseError('Enter a release quantity greater than 0 kg.');
      return;
    }
    if (parsedQty > modalEntry.batch.qtyKg) {
      setReleaseError(
        `Release quantity cannot exceed ${modalEntry.batch.qtyKg} kg.`
      );
      return;
    }
    releaseBatch(modalEntry.batch.id, Math.round(parsedQty), releaseNote);
    setReleaseModalOpen(false);
    setReleaseTargetId(null);
  };

  const handleAddBatchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const qtyKg = Number(newQty);
    const shelfLifeDays = Number(newShelfLife);
    const currentPricePhp = Number(newCurrentPrice);
    const targetPricePhp = Number(newTargetPrice);

    if (!Number.isFinite(qtyKg) || qtyKg <= 0 || qtyKg > 5000) {
      setAddError('Quantity must be between 1 and 5,000 kg.');
      return;
    }
    if (
      !Number.isFinite(shelfLifeDays) ||
      shelfLifeDays < 1 ||
      shelfLifeDays > 90
    ) {
      setAddError('Shelf life must be between 1 and 90 days.');
      return;
    }
    if (
      !Number.isFinite(currentPricePhp) ||
      currentPricePhp <= 0 ||
      !Number.isFinite(targetPricePhp) ||
      targetPricePhp <= 0
    ) {
      setAddError('Current and target prices must be positive PHP/kg values.');
      return;
    }

    const todayIso = new Date().toISOString().slice(0, 10);
    const baselineLimit = newCrop === 'Tomato' ? 14 : 10;
    addBatch({
      crop: newCrop,
      roomId: newRoomId,
      rackId: newRackId,
      qtyKg: Math.round(qtyKg),
      harvestedDate: todayIso,
      shelfLifeDays: Math.round(shelfLifeDays),
      shelfLifeLimitDays: Math.max(Math.round(shelfLifeDays), baselineLimit),
      currentPricePhp: Math.round(currentPricePhp),
      targetPricePhp: Math.round(targetPricePhp),
    });
    setAddError(null);
    setAddModalOpen(false);
  };

  const resetFilters = () => {
    setCropFilter('all');
    setRoomFilter('all');
    setStatusFilter('all');
    setSortBy('shelf_life');
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl sm:text-[28px] font-bold text-slate-950 dark:text-white">
          {copy.inventoryHeading}
        </h1>
        <div className="flex flex-wrap items-center gap-2.5">
          <SimulatedDataNotice label={copy.simulatedNotice} />
          <button
            type="button"
            onClick={() => {
              setAddError(null);
              setAddModalOpen(true);
            }}
            className="btn-primary min-h-[44px] px-5 rounded-full text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" strokeWidth={1.75} />
            <span>{copy.addBatch}</span>
          </button>
        </div>
      </header>

      {/* Compact Control Strip: Filter Popover + Sort Pill + FEFO Summary */}
      <GlassCard
        tier="surface"
        radius="outer"
        className="relative z-20 px-4 py-3 flex flex-wrap items-center justify-between gap-3"
      >
        <div className="flex flex-wrap items-center gap-2.5">
          <FilterPopover
            label={copy.filterLabel}
            language={state.language}
            cropFilter={cropFilter}
            roomFilter={roomFilter}
            statusFilter={statusFilter}
            rooms={state.rooms}
            onCropChange={setCropFilter}
            onRoomChange={setRoomFilter}
            onStatusChange={setStatusFilter}
            onReset={resetFilters}
          />

          <label className="glass-recessed min-h-[44px] px-3.5 rounded-full inline-flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
            <ArrowUpDown className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
            <span className="sr-only">{copy.sortByLabel}</span>
            <select
              aria-label={copy.sortByLabel}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              className="bg-transparent text-xs font-semibold text-slate-900 dark:text-slate-100 cursor-pointer focus:outline-none"
            >
              <option value="shelf_life" className="text-slate-900">
                Shelf life (shortest)
              </option>
              <option value="qty_desc" className="text-slate-900">
                Quantity (highest)
              </option>
              <option value="margin_desc" className="text-slate-900">
                Price margin
              </option>
              <option value="batch_id" className="text-slate-900">
                Batch ID
              </option>
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3.5 text-xs font-tabular">
          <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-400 font-sans font-semibold uppercase tracking-wide text-[11px]">
            <CalendarClock className="w-3.5 h-3.5" strokeWidth={1.75} />
            <span>FEFO</span>
          </span>
          <span className="text-[#BE123C] dark:text-[#FB7185] font-semibold">
            Now: {fefoBuckets.immediate.length} (
            {fefoBuckets.immediate
              .reduce((sum, e) => sum + e.batch.qtyKg, 0)
              .toLocaleString()}{' '}
            kg)
          </span>
          <span className="text-[#B45309] dark:text-[#FBBF24] font-semibold">
            3-5d: {fefoBuckets.soon.length} (
            {fefoBuckets.soon
              .reduce((sum, e) => sum + e.batch.qtyKg, 0)
              .toLocaleString()}{' '}
            kg)
          </span>
          <span className="text-[#0369A1] dark:text-[#38BDF8] font-semibold">
            Hold: {fefoBuckets.hold.length}
          </span>
        </div>
      </GlassCard>

      {/* Main Asymmetric Split: Unclipped BATCHES Table / RECOMMENDATION Inspector */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <GlassCard
          tier="surface"
          radius="outer"
          className="lg:col-span-8 p-4 sm:p-5 flex flex-col gap-3.5 min-w-0"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold tracking-wide uppercase text-slate-700 dark:text-slate-300">
                {copy.batchesHeading}
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Select any batch to inspect pricing or release directly
              </p>
            </div>
            <span className="font-tabular text-xs text-slate-600 dark:text-slate-400">
              {filteredBatches.length} shown
            </span>
          </div>

          {filteredBatches.length === 0 ? (
            <div className="glass-recessed rounded-[20px] p-6 flex flex-col items-start gap-3">
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                No batches match the active filters.
              </p>
              <button
                type="button"
                onClick={resetFilters}
                className="btn-secondary min-h-[44px] px-4 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.75} />
                <span>Reset filters</span>
              </button>
            </div>
          ) : (
            <div
              data-testid="batches-table-scroll"
              className="glass-recessed rounded-[20px] overflow-x-auto"
            >
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-900/10 dark:border-white/10 text-[11px] text-slate-600 dark:text-slate-400">
                    <th className="py-2.5 pl-3 pr-1.5 font-semibold">Batch</th>
                    <th className="py-2.5 px-1.5 font-semibold">Crop</th>
                    <th className="py-2.5 px-1.5 font-semibold">Room</th>
                    <th className="py-2.5 px-1.5 font-semibold text-right">
                      Shelf
                    </th>
                    <th className="py-2.5 px-1.5 font-semibold">Status</th>
                    <th className="py-2.5 px-1.5 font-semibold text-right">
                      Qty
                    </th>
                    <th className="py-2.5 pl-1.5 pr-3 font-semibold text-right">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900/8 dark:divide-white/8">
                  {filteredBatches.map(({ batch, roomName, recommendation }) => {
                    const isSelected = selectedEntry?.batch.id === batch.id;
                    return (
                      <tr
                        key={batch.id}
                        className={`motion-snap ${
                          isSelected
                            ? 'bg-[#FF6B00]/[0.10] dark:bg-[#FF6B00]/[0.15]'
                            : 'hover:bg-white/45 dark:hover:bg-white/[0.03]'
                        }`}
                      >
                        <td className="py-2.5 pl-3 pr-1.5 font-tabular font-semibold whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => reviewBatch(batch.id)}
                            className="link-dorfic min-h-[36px] cursor-pointer"
                          >
                            {batch.id}
                          </button>
                        </td>
                        <td className="py-2.5 px-1.5 text-slate-800 dark:text-slate-200 whitespace-nowrap">
                          {formatCropLabel(batch.crop, state.language)}
                        </td>
                        <td className="py-2.5 px-1.5 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {roomName}
                        </td>
                        <td className="py-2.5 px-1.5 font-tabular text-right text-slate-800 dark:text-slate-200 whitespace-nowrap">
                          {batch.shelfLifeDays}d
                        </td>
                        <td className="py-2.5 px-1.5 whitespace-nowrap">
                          <StatusBadge
                            tone={recommendationToTone(recommendation.status)}
                            label={recommendation.badgeLabel}
                            compact
                          />
                        </td>
                        <td className="py-2.5 px-1.5 font-tabular text-right font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                          {batch.qtyKg} kg
                        </td>
                        <td className="py-2.5 pl-1.5 pr-3 text-right whitespace-nowrap">
                          {batch.released ? (
                            <button
                              type="button"
                              aria-label={`Restore ${batch.id}`}
                              onClick={() => restoreBatch(batch.id)}
                              className="btn-secondary min-h-[36px] px-3 rounded-full text-xs font-semibold cursor-pointer"
                            >
                              Restore
                            </button>
                          ) : (
                            <button
                              type="button"
                              aria-label={`Release ${batch.id}`}
                              onClick={() => openReleaseModalFor(batch.id)}
                              className="btn-primary min-h-[36px] px-3 rounded-full text-xs font-semibold cursor-pointer"
                            >
                              {copy.releaseAction}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </GlassCard>

        {/* Recommendation Detail Rail */}
        <GlassCard
          tier="surface"
          radius="outer"
          className="lg:col-span-4 p-4 sm:p-5 flex flex-col gap-4 min-w-0"
        >
          {selectedEntry ? (
            <>
              <div className="flex flex-col gap-2">
                <h2 className="text-sm font-semibold tracking-wide uppercase text-slate-700 dark:text-slate-300">
                  {copy.recommendationFor} {selectedEntry.batch.id}
                </h2>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <StatusBadge
                    tone={recommendationToTone(
                      selectedEntry.recommendation.status
                    )}
                    label={selectedEntry.recommendation.badgeLabel}
                  />
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    {selectedEntry.recommendation.summaryText}
                  </span>
                </div>
              </div>

              <dl className="glass-recessed rounded-[18px] divide-y divide-slate-900/10 dark:divide-white/10 text-xs sm:text-sm">
                <div className="px-3.5 py-2.5 flex items-center justify-between gap-2">
                  <dt className="text-slate-600 dark:text-slate-400">
                    Shelf life left
                  </dt>
                  <dd className="font-tabular font-semibold text-slate-950 dark:text-white">
                    {selectedEntry.batch.shelfLifeDays} d (limit{' '}
                    {selectedEntry.batch.shelfLifeLimitDays})
                  </dd>
                </div>
                <div className="px-3.5 py-2.5 flex items-center justify-between gap-2">
                  <dt className="text-slate-600 dark:text-slate-400">
                    Current price
                  </dt>
                  <dd className="font-tabular font-semibold text-slate-950 dark:text-white">
                    {selectedEntry.batch.currentPricePhp} PHP/kg
                  </dd>
                </div>
                <div className="px-3.5 py-2.5 flex items-center justify-between gap-2">
                  <dt className="text-slate-600 dark:text-slate-400">
                    Target price
                  </dt>
                  <dd className="font-tabular font-semibold text-slate-950 dark:text-white">
                    {selectedEntry.batch.targetPricePhp} PHP/kg
                  </dd>
                </div>
                <div className="px-3.5 py-2.5 flex items-center justify-between gap-2">
                  <dt className="text-slate-600 dark:text-slate-400 shrink-0">
                    Room status
                  </dt>
                  <dd className="text-right">
                    <button
                      type="button"
                      onClick={() => openRoom(selectedEntry.batch.roomId)}
                      className="font-tabular text-xs font-semibold text-right link-dorfic cursor-pointer"
                    >
                      {selectedEntry.roomName} ·{' '}
                      {selectedEntry.roomEval.statusLabel}
                    </button>
                  </dd>
                </div>
              </dl>

              <PriceWindowChart
                crop={formatCropLabel(selectedEntry.batch.crop, state.language)}
                points={state.priceSeriesByCrop[selectedEntry.batch.crop]}
                targetPricePhp={selectedEntry.batch.targetPricePhp}
                compact
              />

              {selectedEntry.batch.released ? (
                <div className="flex flex-col gap-2 pt-1">
                  <p className="text-xs font-tabular text-slate-600 dark:text-slate-400">
                    Dispatched at {selectedEntry.batch.releasedAt ?? 'today'}.
                  </p>
                  <button
                    type="button"
                    onClick={() => restoreBatch(selectedEntry.batch.id)}
                    className="btn-secondary min-h-[44px] w-full px-4 rounded-full text-sm font-semibold cursor-pointer"
                  >
                    Restore batch to storage
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5 pt-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() =>
                        openReleaseModalFor(selectedEntry.batch.id)
                      }
                      className="btn-primary flex-1 min-h-[44px] px-4 rounded-full text-sm font-semibold cursor-pointer whitespace-nowrap"
                    >
                      {copy.markAsReleased}
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleBatchHold(selectedEntry.batch.id)}
                      className="btn-secondary min-h-[44px] px-4 rounded-full text-sm font-semibold cursor-pointer whitespace-nowrap"
                    >
                      {selectedEntry.batch.manualHold
                        ? copy.clearHold
                        : copy.holdBatch}
                    </button>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Confirmation required before status changes.
                  </p>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Select a batch to review release guidance.
            </p>
          )}
        </GlassCard>
      </section>

      {/* Release Confirmation Modal (Portal .glass-floating) */}
      <Modal
        open={releaseModalOpen}
        title={`Confirm release: ${modalEntry?.batch.id ?? ''}`}
        onClose={() => setReleaseModalOpen(false)}
        footer={
          modalEntry ? (
            <>
              <button
                type="button"
                onClick={() => setReleaseModalOpen(false)}
                className="btn-secondary min-h-[44px] px-4 rounded-full text-sm font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="confirm-release-form"
                className="btn-primary min-h-[44px] px-5 rounded-full text-sm font-semibold cursor-pointer"
              >
                Confirm release
              </button>
            </>
          ) : undefined
        }
      >
        {modalEntry && (
          <form
            id="confirm-release-form"
            onSubmit={handleConfirmRelease}
            className="space-y-4"
          >
            <div className="glass-recessed rounded-[18px] p-4 grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-500 dark:text-slate-400">Crop</span>
                <div className="font-semibold text-sm text-slate-900 dark:text-white mt-0.5">
                  {formatCropLabel(modalEntry.batch.crop, state.language)}
                </div>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400">
                  Location
                </span>
                <div className="font-semibold text-sm text-slate-900 dark:text-white mt-0.5">
                  {modalEntry.roomName} · {modalEntry.batch.rackId}
                </div>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400">
                  Available qty
                </span>
                <div className="font-tabular font-semibold text-sm text-slate-900 dark:text-white mt-0.5">
                  {modalEntry.batch.qtyKg} kg
                </div>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400">
                  Current price
                </span>
                <div className="font-tabular font-semibold text-sm text-slate-900 dark:text-white mt-0.5">
                  {modalEntry.batch.currentPricePhp} PHP/kg
                </div>
              </div>
            </div>

            <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <span>Release quantity (kg)</span>
              <input
                type="number"
                min={1}
                max={modalEntry.batch.qtyKg}
                value={releaseQtyInput}
                onChange={(e) => {
                  setReleaseQtyInput(e.target.value);
                  setReleaseError(null);
                }}
                className="glass-recessed min-h-[44px] px-3.5 rounded-[14px] font-tabular text-sm text-slate-950 dark:text-white"
              />
            </label>

            <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <span>Buyer or dispatch reference (optional)</span>
              <input
                type="text"
                value={releaseNote}
                onChange={(e) => setReleaseNote(e.target.value)}
                placeholder="La Trinidad Trading Post"
                className="glass-recessed min-h-[44px] px-3.5 rounded-[14px] text-sm text-slate-950 dark:text-white"
              />
            </label>

            {releaseError && (
              <p
                role="alert"
                className="text-xs font-semibold text-rose-700 dark:text-rose-300"
              >
                {releaseError}
              </p>
            )}
          </form>
        )}
      </Modal>

      {/* Add Batch Modal (Portal .glass-floating) */}
      <Modal
        open={addModalOpen}
        title="Add inventory batch"
        onClose={() => setAddModalOpen(false)}
        footer={
          <>
            <button
              type="button"
              onClick={() => setAddModalOpen(false)}
              className="btn-secondary min-h-[44px] px-4 rounded-full text-sm font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="add-batch-form"
              className="btn-primary min-h-[44px] px-5 rounded-full text-sm font-semibold cursor-pointer"
            >
              Save batch
            </button>
          </>
        }
      >
        <form
          id="add-batch-form"
          onSubmit={handleAddBatchSubmit}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <span>Crop</span>
              <select
                value={newCrop}
                onChange={(e) => {
                  const crop = e.target.value as CropType;
                  setNewCrop(crop);
                  const matchingRoom = state.rooms.find((r) => r.crop === crop);
                  if (matchingRoom) setNewRoomId(matchingRoom.id);
                  if (crop === 'Tomato') {
                    setNewShelfLife('14');
                    setNewCurrentPrice('86');
                    setNewTargetPrice('82');
                  } else {
                    setNewShelfLife('10');
                    setNewCurrentPrice('152');
                    setNewTargetPrice('145');
                  }
                }}
                className="glass-recessed min-h-[44px] px-3 rounded-[14px] text-sm text-slate-950 dark:text-white bg-transparent"
              >
                {CROP_LIST.map((crop) => (
                  <option key={crop} value={crop} className="text-slate-900">
                    {formatCropLabel(crop, state.language)}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <span>Storage room</span>
              <select
                value={newRoomId}
                onChange={(e) => setNewRoomId(e.target.value)}
                className="glass-recessed min-h-[44px] px-3 rounded-[14px] text-sm text-slate-950 dark:text-white bg-transparent"
              >
                {state.rooms.map((room) => (
                  <option key={room.id} value={room.id} className="text-slate-900">
                    {room.name} ({formatCropLabel(room.crop, state.language)})
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <span>Rack bay</span>
              <select
                value={newRackId}
                onChange={(e) => setNewRackId(e.target.value)}
                className="glass-recessed min-h-[44px] px-3 rounded-[14px] text-sm text-slate-950 dark:text-white bg-transparent"
              >
                <option value="R1" className="text-slate-900">
                  Rack R1
                </option>
                <option value="R2" className="text-slate-900">
                  Rack R2
                </option>
                <option value="R3" className="text-slate-900">
                  Rack R3
                </option>
              </select>
            </label>

            <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <span>Quantity (kg)</span>
              <input
                type="number"
                value={newQty}
                onChange={(e) => setNewQty(e.target.value)}
                className="glass-recessed min-h-[44px] px-3.5 rounded-[14px] font-tabular text-sm text-slate-950 dark:text-white"
              />
            </label>

            <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <span>Shelf life left (days)</span>
              <input
                type="number"
                value={newShelfLife}
                onChange={(e) => setNewShelfLife(e.target.value)}
                className="glass-recessed min-h-[44px] px-3.5 rounded-[14px] font-tabular text-sm text-slate-950 dark:text-white"
              />
            </label>

            <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <span>Current price (PHP/kg)</span>
              <input
                type="number"
                value={newCurrentPrice}
                onChange={(e) => setNewCurrentPrice(e.target.value)}
                className="glass-recessed min-h-[44px] px-3.5 rounded-[14px] font-tabular text-sm text-slate-950 dark:text-white"
              />
            </label>

            <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 sm:col-span-2">
              <span>Target release price (PHP/kg)</span>
              <input
                type="number"
                value={newTargetPrice}
                onChange={(e) => setNewTargetPrice(e.target.value)}
                className="glass-recessed min-h-[44px] px-3.5 rounded-[14px] font-tabular text-sm text-slate-950 dark:text-white"
              />
            </label>
          </div>

          {addError && (
            <p
              role="alert"
              className="text-xs font-semibold text-rose-700 dark:text-rose-300"
            >
              {addError}
            </p>
          )}
        </form>
      </Modal>
    </div>
  );
}
