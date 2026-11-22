import React, { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Globe,
  LogOut,
  Moon,
  Play,
  RotateCcw,
  Save,
  Sliders,
  Sun,
  UserCheck,
  Volume2,
} from 'lucide-react';
import { usePostharvest } from '../context/PostharvestContext';
import { CROP_LIST } from '../data/seedData';
import type {
  CropThresholdRule,
  CropType,
  ScenarioType,
  UserRole,
} from '../types/postharvest';
import { formatCropLabel, getUiCopy } from '../utils/i18n';
import {
  projectScenarioImpact,
  validateThresholdRule,
} from '../utils/postharvestEngine';
import { playNotificationChime } from '../utils/soundCue';
import { GlassCard } from '../components/ui/GlassCard';
import {
  severityToTone,
  SimulatedDataNotice,
  StatusBadge,
} from '../components/ui/StatusBadge';

const ROLES: UserRole[] = [
  'Facility Manager',
  'Cold-Chain Operator',
  'Quality Inspector',
];

function SettingSwitch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
        {label}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`motion-snap relative inline-flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 cursor-pointer border ${
          checked
            ? 'bg-[#FF6B00] border-[#E05A00]'
            : 'bg-slate-300/75 border-slate-400/50 dark:bg-white/10 dark:border-white/20'
        }`}
      >
        <span
          className={`motion-snap inline-block h-5 w-5 rounded-full shadow-sm ${
            checked
              ? 'translate-x-5 bg-[#111318]'
              : 'translate-x-0 bg-white'
          }`}
        />
      </button>
    </div>
  );
}

export function AlertsSettingsView() {
  const {
    state,
    setAlertsSubTab,
    acknowledgeAlert,
    openRoom,
    saveCropRule,
    resetCropRule,
    updateSimulator,
    runScenario,
    updateAccount,
    signOut,
    setLanguage,
    updateNotifications,
    setTheme,
    updateGlass,
    resetGlass,
  } = usePostharvest();

  const copy = getUiCopy(state.language);

  // Alert log filters
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [ackFilter, setAckFilter] = useState<string>('all');

  // Threshold rule editor draft state
  const [selectedCrop, setSelectedCrop] = useState<CropType>(
    state.selectedRuleCrop
  );
  const [draftRule, setDraftRule] = useState<CropThresholdRule>(
    state.rules[state.selectedRuleCrop]
  );

  // Account settings form state
  const [acctName, setAcctName] = useState(state.auth.user.fullName);
  const [acctCoop, setAcctCoop] = useState(state.auth.user.cooperativeName);
  const [acctRole, setAcctRole] = useState<UserRole>(state.auth.user.role);
  const [acctEmail, setAcctEmail] = useState(state.auth.user.email);
  const [acctPassword, setAcctPassword] = useState('');
  const [acctError, setAcctError] = useState<string | null>(null);

  useEffect(() => {
    setSelectedCrop(state.selectedRuleCrop);
    setDraftRule(state.rules[state.selectedRuleCrop]);
  }, [state.selectedRuleCrop, state.rules]);

  useEffect(() => {
    setAcctName(state.auth.user.fullName);
    setAcctCoop(state.auth.user.cooperativeName);
    setAcctRole(state.auth.user.role);
    setAcctEmail(state.auth.user.email);
  }, [state.auth.user]);

  const handleCropChange = (crop: CropType) => {
    setSelectedCrop(crop);
    setDraftRule(state.rules[crop]);
  };

  const validationErrors = useMemo(
    () => validateThresholdRule(draftRule),
    [draftRule]
  );
  const hasValidationErrors = Object.keys(validationErrors).length > 0;

  const filteredAlerts = useMemo(() => {
    return state.alerts.filter((alert) => {
      if (severityFilter !== 'all' && alert.severity !== severityFilter) {
        return false;
      }
      if (ackFilter === 'open' && alert.acknowledged) return false;
      if (ackFilter === 'acknowledged' && !alert.acknowledged) return false;
      return true;
    });
  }, [state.alerts, severityFilter, ackFilter]);

  const projection = useMemo(
    () =>
      projectScenarioImpact(
        state.rooms,
        state.rules,
        state.simulator.scenario,
        state.simulator.durationHours,
        state.simulator.ambientOffsetC,
        state.simulator.compressorLoadPct
      ),
    [state.rooms, state.rules, state.simulator]
  );

  const handleSaveRules = (e: React.FormEvent) => {
    e.preventDefault();
    if (hasValidationErrors) return;
    saveCropRule(draftRule);
  };

  const handleSaveAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (acctName.trim().length < 2) {
      setAcctError('Display name must be at least 2 characters.');
      return;
    }
    if (acctCoop.trim().length < 2) {
      setAcctError('Cooperative name must be at least 2 characters.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(acctEmail.trim())) {
      setAcctError('Enter a valid work email address.');
      return;
    }
    if (acctPassword.length > 0 && acctPassword.length < 6) {
      setAcctError('New password must be at least 6 characters.');
      return;
    }
    setAcctError(null);
    updateAccount(
      {
        fullName: acctName,
        cooperativeName: acctCoop,
        role: acctRole,
        email: acctEmail,
      },
      acctPassword || undefined
    );
    setAcctPassword('');
  };

  const scenarioOptions: { id: ScenarioType; label: string }[] = [
    { id: 'normal', label: 'Normal storage' },
    { id: 'equipment_failure', label: 'Equipment failure' },
    { id: 'harvest_glut', label: 'Harvest glut' },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Header + Segmented View Switch */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <h1 className="text-2xl sm:text-[28px] font-bold text-slate-950 dark:text-white">
            {copy.alertsSettingsHeading}
          </h1>

          <div
            className="glass-recessed rounded-full p-1 inline-flex items-center gap-1"
            role="tablist"
            aria-label="Alerts and settings sections"
          >
            <button
              type="button"
              role="tab"
              aria-selected={state.alertsSubTab === 'alerts'}
              onClick={() => setAlertsSubTab('alerts')}
              className={`motion-snap min-h-[40px] px-4 rounded-full text-xs sm:text-sm font-semibold cursor-pointer whitespace-nowrap ${
                state.alertsSubTab === 'alerts'
                  ? 'pill-active'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-white/50 dark:hover:bg-white/10'
              }`}
            >
              {copy.tabAlertsSim}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={state.alertsSubTab === 'settings'}
              onClick={() => setAlertsSubTab('settings')}
              className={`motion-snap min-h-[40px] px-4 rounded-full text-xs sm:text-sm font-semibold cursor-pointer whitespace-nowrap ${
                state.alertsSubTab === 'settings'
                  ? 'pill-active'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-white/50 dark:hover:bg-white/10'
              }`}
            >
              {copy.tabSystemSettings}
            </button>
          </div>
        </div>

        <SimulatedDataNotice label={copy.simulatedNotice} />
      </header>

      {state.alertsSubTab === 'alerts' ? (
        <>
          {/* Top Asymmetric Split: 65% Alert Log / 35% Scenario Simulator */}
          <section className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
            <GlassCard
              tier="surface"
              radius="outer"
              className="xl:col-span-8 p-5 flex flex-col gap-4"
            >
              <h2 className="text-sm font-semibold tracking-wide uppercase text-slate-700 dark:text-slate-300">
                {copy.alertLogHeading}
              </h2>

              <div className="flex flex-wrap items-end gap-3">
                <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <span>Severity</span>
                  <select
                    value={severityFilter}
                    onChange={(e) => setSeverityFilter(e.target.value)}
                    className="glass-recessed min-h-[44px] px-3.5 rounded-[14px] text-sm font-medium text-slate-900 dark:text-slate-100 bg-transparent cursor-pointer"
                  >
                    <option value="all" className="text-slate-900">
                      All
                    </option>
                    <option value="critical" className="text-slate-900">
                      Critical
                    </option>
                    <option value="warning" className="text-slate-900">
                      Warning
                    </option>
                    <option value="no_data" className="text-slate-900">
                      No data
                    </option>
                  </select>
                </label>

                <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <span>Status</span>
                  <select
                    value={ackFilter}
                    onChange={(e) => setAckFilter(e.target.value)}
                    className="glass-recessed min-h-[44px] px-3.5 rounded-[14px] text-sm font-medium text-slate-900 dark:text-slate-100 bg-transparent cursor-pointer"
                  >
                    <option value="all" className="text-slate-900">
                      Open and acknowledged
                    </option>
                    <option value="open" className="text-slate-900">
                      Open only
                    </option>
                    <option value="acknowledged" className="text-slate-900">
                      Acknowledged only
                    </option>
                  </select>
                </label>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-400">
                Alerts, newest first
              </p>

              {filteredAlerts.length === 0 ? (
                <div className="glass-recessed rounded-[20px] p-6 flex flex-wrap items-center justify-between gap-3">
                  <span className="text-sm text-slate-600 dark:text-slate-300">
                    No alerts match the current filter.
                  </span>
                  {(severityFilter !== 'all' || ackFilter !== 'all') && (
                    <button
                      type="button"
                      onClick={() => {
                        setSeverityFilter('all');
                        setAckFilter('all');
                      }}
                      className="btn-secondary min-h-[40px] px-4 rounded-full text-xs font-semibold cursor-pointer"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              ) : (
                <div className="glass-recessed rounded-[20px] overflow-x-auto">
                  <table className="w-full text-left text-xs sm:text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-slate-900/10 dark:border-white/10 text-xs text-slate-600 dark:text-slate-400">
                        <th className="py-3 px-3.5 font-semibold">Time</th>
                        <th className="py-3 px-2.5 font-semibold">Room</th>
                        <th className="py-3 px-2.5 font-semibold">Type</th>
                        <th className="py-3 px-2.5 font-semibold">Severity</th>
                        <th className="py-3 px-2.5 font-semibold">Status</th>
                        <th className="py-3 px-3.5 font-semibold text-right">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900/8 dark:divide-white/8">
                      {filteredAlerts.map((alert) => (
                        <tr
                          key={alert.id}
                          className="hover:bg-white/45 dark:hover:bg-white/[0.03]"
                        >
                          <td className="py-3 px-3.5 font-tabular text-slate-700 dark:text-slate-300 whitespace-nowrap">
                            {alert.timestamp}
                          </td>
                          <td className="py-3 px-2.5 font-semibold text-slate-950 dark:text-white whitespace-nowrap">
                            {alert.roomName}
                          </td>
                          <td className="py-3 px-2.5 text-slate-800 dark:text-slate-200">
                            {alert.typeLabel}
                          </td>
                          <td className="py-3 px-2.5 whitespace-nowrap">
                            <StatusBadge
                              tone={severityToTone(alert.severity)}
                              label={
                                alert.severity === 'no_data'
                                  ? 'NO DATA'
                                  : alert.severity.toUpperCase()
                              }
                              compact
                            />
                          </td>
                          <td className="py-3 px-2.5 text-xs font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                            {alert.acknowledged ? 'Acknowledged' : 'Open'}
                          </td>
                          <td className="py-3 px-3.5 text-right whitespace-nowrap">
                            {!alert.acknowledged ? (
                              <button
                                type="button"
                                onClick={() => acknowledgeAlert(alert.id)}
                                className="text-xs font-semibold link-dorfic min-h-[36px] px-1 cursor-pointer"
                              >
                                Acknowledge {alert.roomName} alert
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => openRoom(alert.roomId)}
                                className="text-xs font-semibold link-dorfic min-h-[36px] px-1 cursor-pointer"
                              >
                                View {alert.roomName}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </GlassCard>

            {/* Scenario Simulator */}
            <GlassCard
              tier="surface"
              radius="outer"
              className="xl:col-span-4 p-5 flex flex-col justify-between gap-4"
            >
              <div className="flex flex-col gap-4">
                <h2 className="text-sm font-semibold tracking-wide uppercase text-slate-700 dark:text-slate-300">
                  {copy.simulatorHeading}
                </h2>

                <fieldset className="flex flex-col gap-1.5">
                  <legend className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Scenario
                  </legend>
                  {scenarioOptions.map((opt) => (
                    <label
                      key={opt.id}
                      className="min-h-[40px] px-3 rounded-[12px] flex items-center gap-2.5 text-sm text-slate-900 dark:text-slate-100 cursor-pointer hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.06]"
                    >
                      <input
                        type="radio"
                        name="scenario"
                        value={opt.id}
                        checked={state.simulator.scenario === opt.id}
                        onChange={() => updateSimulator({ scenario: opt.id })}
                        className="w-4 h-4 accent-[#FF6B00] cursor-pointer"
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </fieldset>

                <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <span>Duration</span>
                  <select
                    value={state.simulator.durationHours}
                    onChange={(e) =>
                      updateSimulator({ durationHours: Number(e.target.value) })
                    }
                    className="glass-recessed min-h-[44px] px-3.5 rounded-[14px] text-sm font-medium text-slate-900 dark:text-slate-100 bg-transparent cursor-pointer"
                  >
                    <option value={4} className="text-slate-900">
                      4 hours
                    </option>
                    <option value={12} className="text-slate-900">
                      12 hours
                    </option>
                    <option value={24} className="text-slate-900">
                      24 hours
                    </option>
                    <option value={48} className="text-slate-900">
                      48 hours
                    </option>
                  </select>
                </label>

                <div className="glass-recessed rounded-[18px] p-3.5 flex flex-col gap-3">
                  <label className="flex flex-col gap-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        Ambient offset
                      </span>
                      <span className="font-tabular font-semibold text-slate-950 dark:text-white">
                        {state.simulator.ambientOffsetC >= 0 ? '+' : ''}
                        {state.simulator.ambientOffsetC} °C
                      </span>
                    </div>
                    <input
                      type="range"
                      min={-2}
                      max={6}
                      step={0.5}
                      value={state.simulator.ambientOffsetC}
                      onChange={(e) =>
                        updateSimulator({
                          ambientOffsetC: Number(e.target.value),
                        })
                      }
                      className="w-full accent-[#FF6B00] cursor-pointer"
                    />
                  </label>

                  <label className="flex flex-col gap-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        Thermal load
                      </span>
                      <span className="font-tabular font-semibold text-slate-950 dark:text-white">
                        {state.simulator.compressorLoadPct} %
                      </span>
                    </div>
                    <input
                      type="range"
                      min={40}
                      max={100}
                      step={5}
                      value={state.simulator.compressorLoadPct}
                      onChange={(e) =>
                        updateSimulator({
                          compressorLoadPct: Number(e.target.value),
                        })
                      }
                      className="w-full accent-[#FF6B00] cursor-pointer"
                    />
                  </label>
                </div>

                <div className="glass-recessed rounded-[18px] px-3.5 py-3 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-[11px] text-slate-600 dark:text-slate-400">
                      Spoilage risk
                    </div>
                    <div className="font-tabular text-sm font-bold text-slate-950 dark:text-white">
                      {projection.spoilageRiskPct}%
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-600 dark:text-slate-400">
                      Shelf delta
                    </div>
                    <div className="font-tabular text-sm font-bold text-slate-950 dark:text-white">
                      {projection.shelfLifeDeltaDays} d
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-600 dark:text-slate-400">
                      Breach rooms
                    </div>
                    <div className="font-tabular text-sm font-bold text-slate-950 dark:text-white">
                      {projection.projectedBreachRooms}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={runScenario}
                  className="btn-primary min-h-[44px] w-full px-5 rounded-full text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                >
                  <Play className="w-4 h-4" strokeWidth={1.75} />
                  <span>{copy.runScenario}</span>
                </button>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  {state.simulator.lastRunSummary ??
                    'Generates simulated data from literature-based ranges.'}
                </p>
              </div>
            </GlassCard>
          </section>

          {/* Threshold Rules by Crop */}
          <GlassCard tier="surface" radius="outer" className="p-5 sm:p-6">
            <form
              onSubmit={handleSaveRules}
              className="flex flex-col gap-5"
              noValidate
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold tracking-wide uppercase text-slate-700 dark:text-slate-300">
                  {copy.thresholdRulesHeading}
                </h2>
                <span className="font-tabular text-xs text-slate-500 dark:text-slate-400">
                  Applies immediately across all rooms storing{' '}
                  {formatCropLabel(selectedCrop, state.language)}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
                <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <span>Crop</span>
                  <select
                    value={selectedCrop}
                    onChange={(e) =>
                      handleCropChange(e.target.value as CropType)
                    }
                    className="glass-recessed min-h-[44px] px-3.5 rounded-[14px] text-sm font-medium text-slate-950 dark:text-white bg-transparent cursor-pointer"
                  >
                    {CROP_LIST.map((crop) => (
                      <option key={crop} value={crop} className="text-slate-900">
                        {formatCropLabel(crop, state.language)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <span>Temp min (°C)</span>
                  <input
                    type="number"
                    step="0.1"
                    value={draftRule.tempMin}
                    aria-invalid={Boolean(validationErrors.tempMin)}
                    onChange={(e) =>
                      setDraftRule((prev) => ({
                        ...prev,
                        tempMin: Number(e.target.value),
                      }))
                    }
                    className={`glass-recessed min-h-[44px] px-3.5 rounded-[14px] font-tabular text-sm text-slate-950 dark:text-white ${
                      validationErrors.tempMin
                        ? '!border-rose-600 dark:!border-rose-400 ring-1 ring-rose-600/30'
                        : ''
                    }`}
                  />
                </label>

                <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <span>Temp max (°C)</span>
                  <input
                    type="number"
                    step="0.1"
                    value={draftRule.tempMax}
                    aria-invalid={Boolean(
                      validationErrors.tempMax || validationErrors.tempMin
                    )}
                    onChange={(e) =>
                      setDraftRule((prev) => ({
                        ...prev,
                        tempMax: Number(e.target.value),
                      }))
                    }
                    className={`glass-recessed min-h-[44px] px-3.5 rounded-[14px] font-tabular text-sm text-slate-950 dark:text-white ${
                      validationErrors.tempMax || validationErrors.tempMin
                        ? '!border-rose-600 dark:!border-rose-400 ring-1 ring-rose-600/30'
                        : ''
                    }`}
                  />
                </label>

                <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <span>Humidity min (%)</span>
                  <input
                    type="number"
                    step="1"
                    value={draftRule.humidityMin}
                    aria-invalid={Boolean(validationErrors.humidityMin)}
                    onChange={(e) =>
                      setDraftRule((prev) => ({
                        ...prev,
                        humidityMin: Number(e.target.value),
                      }))
                    }
                    className={`glass-recessed min-h-[44px] px-3.5 rounded-[14px] font-tabular text-sm text-slate-950 dark:text-white ${
                      validationErrors.humidityMin
                        ? '!border-rose-600 dark:!border-rose-400 ring-1 ring-rose-600/30'
                        : ''
                    }`}
                  />
                </label>

                <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <span>Humidity max (%)</span>
                  <input
                    type="number"
                    step="1"
                    value={draftRule.humidityMax}
                    aria-invalid={Boolean(
                      validationErrors.humidityMax ||
                        validationErrors.humidityMin
                    )}
                    onChange={(e) =>
                      setDraftRule((prev) => ({
                        ...prev,
                        humidityMax: Number(e.target.value),
                      }))
                    }
                    className={`glass-recessed min-h-[44px] px-3.5 rounded-[14px] font-tabular text-sm text-slate-950 dark:text-white ${
                      validationErrors.humidityMax ||
                      validationErrors.humidityMin
                        ? '!border-rose-600 dark:!border-rose-400 ring-1 ring-rose-600/30'
                        : ''
                    }`}
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
                <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <span>CO2 max (ppm)</span>
                  <input
                    type="number"
                    step="10"
                    value={draftRule.co2Max}
                    aria-invalid={Boolean(validationErrors.co2Max)}
                    onChange={(e) =>
                      setDraftRule((prev) => ({
                        ...prev,
                        co2Max: Number(e.target.value),
                      }))
                    }
                    className={`glass-recessed min-h-[44px] px-3.5 rounded-[14px] font-tabular text-sm text-slate-950 dark:text-white ${
                      validationErrors.co2Max
                        ? '!border-rose-600 dark:!border-rose-400 ring-1 ring-rose-600/30'
                        : ''
                    }`}
                  />
                </label>

                <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <span>Gas index max</span>
                  <input
                    type="number"
                    step="0.1"
                    value={draftRule.gasIndexMax}
                    aria-invalid={Boolean(validationErrors.gasIndexMax)}
                    onChange={(e) =>
                      setDraftRule((prev) => ({
                        ...prev,
                        gasIndexMax: Number(e.target.value),
                      }))
                    }
                    className={`glass-recessed min-h-[44px] px-3.5 rounded-[14px] font-tabular text-sm text-slate-950 dark:text-white ${
                      validationErrors.gasIndexMax
                        ? '!border-rose-600 dark:!border-rose-400 ring-1 ring-rose-600/30'
                        : ''
                    }`}
                  />
                </label>
              </div>

              {validationErrors.summary && (
                <p
                  role="alert"
                  className="text-xs font-semibold text-rose-700 dark:text-rose-300"
                >
                  {validationErrors.summary}
                </p>
              )}

              <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-900/10 dark:border-white/10">
                <fieldset className="flex flex-wrap items-center gap-4">
                  <legend className="sr-only">Notify by</legend>
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Notify by
                  </span>
                  <label className="min-h-[44px] inline-flex items-center gap-2 text-sm text-slate-900 dark:text-slate-100 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={draftRule.notifyInApp}
                      onChange={(e) =>
                        setDraftRule((prev) => ({
                          ...prev,
                          notifyInApp: e.target.checked,
                        }))
                      }
                      className="w-4 h-4 accent-[#FF6B00] cursor-pointer"
                    />
                    <span>In-app</span>
                  </label>

                  <label className="min-h-[44px] inline-flex items-center gap-2 text-sm text-slate-900 dark:text-slate-100 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={draftRule.notifySms}
                      onChange={(e) =>
                        setDraftRule((prev) => ({
                          ...prev,
                          notifySms: e.target.checked,
                        }))
                      }
                      className="w-4 h-4 accent-[#FF6B00] cursor-pointer"
                    />
                    <span>SMS</span>
                  </label>
                </fieldset>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="submit"
                    disabled={hasValidationErrors}
                    className="btn-primary min-h-[44px] px-5 rounded-full text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <Save className="w-4 h-4" strokeWidth={1.75} />
                    <span>{copy.saveRules}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => resetCropRule(selectedCrop)}
                    className="btn-secondary min-h-[44px] px-4 rounded-full text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <RotateCcw className="w-4 h-4" strokeWidth={1.75} />
                    <span>{copy.resetSource}</span>
                  </button>
                </div>
              </div>
            </form>
          </GlassCard>
        </>
      ) : (
        /* SYSTEM SETTINGS TAB: 4 Structured Optical Glass Sections */
        <div className="flex flex-col gap-5">
          {/* Row 1: 60% Account / 40% Language + Notifications */}
          <section className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
            {/* 1. Account Section */}
            <GlassCard
              tier="surface"
              radius="outer"
              className="xl:col-span-7 p-5 sm:p-6"
            >
              <form
                onSubmit={handleSaveAccount}
                className="flex flex-col gap-4"
                noValidate
              >
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold tracking-wide uppercase text-slate-700 dark:text-slate-300 inline-flex items-center gap-2">
                    <UserCheck className="w-4 h-4 icon-dorfic" strokeWidth={1.75} />
                    <span>{copy.settingsAccount}</span>
                  </h2>
                  <button
                    type="button"
                    onClick={signOut}
                    className="btn-secondary min-h-[40px] px-3.5 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" strokeWidth={1.75} />
                    <span>{copy.signOut}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <span>Display name</span>
                    <input
                      type="text"
                      value={acctName}
                      onChange={(e) => setAcctName(e.target.value)}
                      className="glass-recessed min-h-[44px] px-3.5 rounded-[14px] text-sm text-slate-950 dark:text-white"
                    />
                  </label>

                  <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <span>Cooperative name</span>
                    <input
                      type="text"
                      value={acctCoop}
                      onChange={(e) => setAcctCoop(e.target.value)}
                      className="glass-recessed min-h-[44px] px-3.5 rounded-[14px] text-sm text-slate-950 dark:text-white"
                    />
                  </label>

                  <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <span>Role</span>
                    <select
                      value={acctRole}
                      onChange={(e) => setAcctRole(e.target.value as UserRole)}
                      className="glass-recessed min-h-[44px] px-3.5 rounded-[14px] text-sm text-slate-950 dark:text-white bg-transparent cursor-pointer"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r} className="text-slate-900">
                          {r}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <span>Work email</span>
                    <input
                      type="email"
                      value={acctEmail}
                      onChange={(e) => setAcctEmail(e.target.value)}
                      className="glass-recessed min-h-[44px] px-3.5 rounded-[14px] text-sm text-slate-950 dark:text-white"
                    />
                  </label>

                  <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 sm:col-span-2">
                    <span>Update password (optional)</span>
                    <input
                      type="password"
                      value={acctPassword}
                      onChange={(e) => setAcctPassword(e.target.value)}
                      placeholder="Leave blank to keep current password"
                      className="glass-recessed min-h-[44px] px-3.5 rounded-[14px] font-tabular text-sm text-slate-950 dark:text-white"
                    />
                  </label>
                </div>

                {acctError && (
                  <p
                    role="alert"
                    className="text-xs font-semibold text-rose-700 dark:text-rose-300"
                  >
                    {acctError}
                  </p>
                )}

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    className="btn-primary min-h-[44px] px-5 rounded-full text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Save className="w-4 h-4" strokeWidth={1.75} />
                    <span>Save account</span>
                  </button>
                </div>
              </form>
            </GlassCard>

            {/* Right Stack: 2. Language + 3. Notifications */}
            <div className="xl:col-span-5 flex flex-col gap-5">
              {/* 2. Language */}
              <GlassCard tier="surface" radius="outer" className="p-5 flex flex-col gap-3.5">
                <h2 className="text-sm font-semibold tracking-wide uppercase text-slate-700 dark:text-slate-300 inline-flex items-center gap-2">
                  <Globe className="w-4 h-4 icon-dorfic" strokeWidth={1.75} />
                  <span>{copy.settingsLanguage}</span>
                </h2>

                <div
                  className="glass-recessed rounded-full p-1 grid grid-cols-2 gap-1"
                  role="radiogroup"
                  aria-label="Interface language"
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={state.language === 'en'}
                    onClick={() => setLanguage('en')}
                    className={`motion-snap min-h-[44px] rounded-full text-sm font-semibold cursor-pointer ${
                      state.language === 'en'
                        ? 'pill-active'
                        : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    English (EN)
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={state.language === 'fil'}
                    onClick={() => setLanguage('fil')}
                    className={`motion-snap min-h-[44px] rounded-full text-sm font-semibold cursor-pointer ${
                      state.language === 'fil'
                        ? 'pill-active'
                        : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    Filipino (FIL)
                  </button>
                </div>
              </GlassCard>

              {/* 3. Notifications */}
              <GlassCard tier="surface" radius="outer" className="p-5 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2 pb-1">
                  <h2 className="text-sm font-semibold tracking-wide uppercase text-slate-700 dark:text-slate-300 inline-flex items-center gap-2">
                    <Bell className="w-4 h-4 icon-dorfic" strokeWidth={1.75} />
                    <span>{copy.settingsNotifications}</span>
                  </h2>
                  <button
                    type="button"
                    onClick={() => playNotificationChime('alert')}
                    className="btn-secondary min-h-[36px] px-3 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Volume2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                    <span>Test chime</span>
                  </button>
                </div>

                <div className="divide-y divide-slate-900/10 dark:divide-white/10">
                  <SettingSwitch
                    label="Critical temperature excursions"
                    checked={state.notifications.criticalTemp}
                    onChange={(criticalTemp) =>
                      updateNotifications({ criticalTemp })
                    }
                  />
                  <SettingSwitch
                    label="Sensor offline alerts"
                    checked={state.notifications.sensorOffline}
                    onChange={(sensorOffline) =>
                      updateNotifications({ sensorOffline })
                    }
                  />
                  <SettingSwitch
                    label="FEFO release reminders"
                    checked={state.notifications.fefoReminders}
                    onChange={(fefoReminders) =>
                      updateNotifications({ fefoReminders })
                    }
                  />
                  <SettingSwitch
                    label="Audible chime alert"
                    checked={state.notifications.audibleChime}
                    onChange={(audibleChime) =>
                      updateNotifications({ audibleChime })
                    }
                  />
                </div>
              </GlassCard>
            </div>
          </section>

          {/* 4. System Theme & Optical Glass Tuner */}
          <GlassCard tier="surface" radius="outer" className="p-5 sm:p-6">
            <div className="flex flex-col gap-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-semibold tracking-wide uppercase text-slate-700 dark:text-slate-300 inline-flex items-center gap-2">
                  <Sliders className="w-4 h-4 icon-dorfic" strokeWidth={1.75} />
                  <span>{copy.settingsGlassTheme}</span>
                </h2>

                <div className="flex flex-wrap items-center gap-2.5">
                  <div
                    className="glass-recessed rounded-full p-1 inline-flex items-center gap-1"
                    role="group"
                    aria-label="Theme mode"
                  >
                    <button
                      type="button"
                      onClick={() => setTheme('light')}
                      className={`motion-snap min-h-[38px] px-3.5 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer ${
                        state.theme === 'light'
                          ? 'pill-active'
                          : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <Sun className="w-3.5 h-3.5" strokeWidth={1.75} />
                      <span>Light</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTheme('dark')}
                      className={`motion-snap min-h-[38px] px-3.5 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer ${
                        state.theme === 'dark'
                          ? 'pill-active'
                          : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <Moon className="w-3.5 h-3.5" strokeWidth={1.75} />
                      <span>Dark</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={resetGlass}
                    className="btn-secondary min-h-[44px] px-4 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.75} />
                    <span>{copy.resetGlassDefault}</span>
                  </button>
                </div>
              </div>

              {/* Asymmetric Tuner Split: 60% Sliders / 40% Live Optical Preview */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
                <div className="lg:col-span-7 glass-recessed rounded-[20px] p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="flex flex-col gap-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        Frost blur
                      </span>
                      <span
                        data-testid="glass-blur-value"
                        className="font-tabular font-semibold text-slate-950 dark:text-white"
                      >
                        {state.glass.blurPx}px
                      </span>
                    </div>
                    <input
                      type="range"
                      min={8}
                      max={48}
                      step={1}
                      value={state.glass.blurPx}
                      onChange={(e) =>
                        updateGlass({ blurPx: Number(e.target.value) })
                      }
                      className="w-full accent-[#FF6B00] cursor-pointer"
                    />
                    <div className="flex justify-between font-tabular text-[10px] text-slate-500">
                      <span>8px</span>
                      <span>24px</span>
                      <span>48px</span>
                    </div>
                  </label>

                  <label className="flex flex-col gap-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        Surface opacity / frost
                      </span>
                      <span
                        data-testid="glass-frost-value"
                        className="font-tabular font-semibold text-slate-950 dark:text-white"
                      >
                        {state.glass.frostPct}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={35}
                      max={90}
                      step={1}
                      value={state.glass.frostPct}
                      onChange={(e) =>
                        updateGlass({ frostPct: Number(e.target.value) })
                      }
                      className="w-full accent-[#FF6B00] cursor-pointer"
                    />
                    <div className="flex justify-between font-tabular text-[10px] text-slate-500">
                      <span>35%</span>
                      <span>68%</span>
                      <span>90%</span>
                    </div>
                  </label>

                  <label className="flex flex-col gap-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        Z-depth elevation
                      </span>
                      <span
                        data-testid="glass-depth-value"
                        className="font-tabular font-semibold text-slate-950 dark:text-white"
                      >
                        {state.glass.depthScale.toFixed(2)}x
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.5}
                      max={1.5}
                      step={0.05}
                      value={state.glass.depthScale}
                      onChange={(e) =>
                        updateGlass({ depthScale: Number(e.target.value) })
                      }
                      className="w-full accent-[#FF6B00] cursor-pointer"
                    />
                    <div className="flex justify-between font-tabular text-[10px] text-slate-500">
                      <span>0.5x</span>
                      <span>1.0x</span>
                      <span>1.5x</span>
                    </div>
                  </label>

                  <label className="flex flex-col gap-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        Edge dispersion
                      </span>
                      <span
                        data-testid="glass-dispersion-value"
                        className="font-tabular font-semibold text-slate-950 dark:text-white"
                      >
                        {state.glass.dispersionPct}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={150}
                      step={5}
                      value={state.glass.dispersionPct}
                      onChange={(e) =>
                        updateGlass({ dispersionPct: Number(e.target.value) })
                      }
                      className="w-full accent-[#FF6B00] cursor-pointer"
                    />
                    <div className="flex justify-between font-tabular text-[10px] text-slate-500">
                      <span>0%</span>
                      <span>100%</span>
                      <span>150%</span>
                    </div>
                  </label>
                </div>

                {/* Live Optical Preview Stage (DORFiC Tangerine + Metallic Slate Glow) */}
                <div className="lg:col-span-5 rounded-[22px] p-4 relative overflow-hidden border border-slate-900/10 dark:border-white/10 bg-gradient-to-br from-[#FF7A00]/30 via-[#CBD5E1]/75 to-[#0EA5E9]/20 dark:from-[#FF6B00]/28 dark:via-[#1E222A]/95 dark:to-[#334155]/75 flex items-center justify-center min-h-[210px]">
                  <GlassCard
                    tier="floating"
                    radius="nested"
                    refraction
                    specular
                    className="w-full max-w-[300px] p-4 flex flex-col gap-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
                        Live preview
                      </span>
                      <StatusBadge tone="nominal" label="IN RANGE" compact />
                    </div>
                    <div className="glass-recessed rounded-[14px] px-3 py-2.5 flex items-baseline justify-between">
                      <span className="font-tabular text-xl font-bold text-slate-950 dark:text-white">
                        1.8 °C
                      </span>
                      <span className="font-tabular text-xs text-slate-600 dark:text-slate-300">
                        RH 95% · 410 ppm
                      </span>
                    </div>
                    <div className="font-tabular text-[11px] text-slate-600 dark:text-slate-400">
                      Blur {state.glass.blurPx}px · Frost {state.glass.frostPct}% ·
                      Disp {state.glass.dispersionPct}%
                    </div>
                  </GlassCard>
                </div>
              </div>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
