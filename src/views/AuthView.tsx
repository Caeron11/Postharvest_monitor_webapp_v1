import React, { useState } from 'react';
import { Eye, EyeOff, Moon, ShieldCheck, Sun } from 'lucide-react';
import { usePostharvest } from '../context/PostharvestContext';
import type { UserRole } from '../types/postharvest';
import { getUiCopy } from '../utils/i18n';
import {
  evaluateRoomStatus,
  sortRoomsBySeverity,
  validateAuthForm,
} from '../utils/postharvestEngine';
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

export function AuthView() {
  const {
    state,
    kpis,
    signIn,
    signUp,
    demoLogin,
    toggleTheme,
    setLanguage,
  } = usePostharvest();

  const copy = getUiCopy(state.language);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [fullName, setFullName] = useState(state.auth.user.fullName);
  const [email, setEmail] = useState(state.auth.user.email);
  const [cooperativeName, setCooperativeName] = useState(
    state.auth.user.cooperativeName
  );
  const [role, setRole] = useState<UserRole>(state.auth.user.role);
  const [password, setPassword] = useState('manager123');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previewRooms = sortRoomsBySeverity(state.rooms, state.rules);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const check = validateAuthForm({
      mode,
      fullName,
      email,
      cooperativeName,
      password,
    });
    if (!check.valid) {
      setError(check.error ?? 'Check your credentials.');
      return;
    }
    setError(null);
    if (mode === 'signin') {
      signIn(email, password);
    } else {
      signUp(
        {
          fullName,
          email,
          cooperativeName,
          role,
        },
        password
      );
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between px-4 sm:px-6 lg:px-10 py-6 max-w-[1200px] mx-auto">
      {/* Compact Gateway Top Bar */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="font-display-heading text-xl font-bold text-slate-950 dark:text-white whitespace-nowrap">
          Postharvest Monitor
        </div>

        <div className="flex items-center gap-2">
          <div
            className="glass-recessed rounded-full p-1 inline-flex items-center gap-1"
            role="group"
            aria-label="Language"
          >
            <button
              type="button"
              onClick={() => setLanguage('en')}
              className={`min-h-[36px] px-3 rounded-full text-xs font-semibold cursor-pointer ${
                state.language === 'en'
                  ? 'pill-active'
                  : 'text-slate-700 dark:text-slate-300'
              }`}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => setLanguage('fil')}
              className={`min-h-[36px] px-3 rounded-full text-xs font-semibold cursor-pointer ${
                state.language === 'fil'
                  ? 'pill-active'
                  : 'text-slate-700 dark:text-slate-300'
              }`}
            >
              FIL
            </button>
          </div>

          <button
            type="button"
            onClick={toggleTheme}
            aria-label={`Switch to ${state.theme === 'light' ? 'dark' : 'light'} mode`}
            className="btn-secondary min-h-[44px] px-3.5 rounded-full text-xs font-semibold inline-flex items-center gap-2 cursor-pointer whitespace-nowrap"
          >
            {state.theme === 'light' ? (
              <Moon className="w-4 h-4" strokeWidth={1.75} />
            ) : (
              <Sun className="w-4 h-4" strokeWidth={1.75} />
            )}
            <span>{state.theme === 'light' ? copy.darkGlass : copy.lightGlass}</span>
          </button>
        </div>
      </header>

      {/* Spatial Asymmetric Split-Screen Gateway */}
      <main className="my-auto py-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Left: Live Facility Preview */}
        <section
          aria-label="Facility live telemetry preview"
          className="lg:col-span-7 flex flex-col gap-5"
        >
          <div className="flex flex-col gap-2">
            <div className="self-start">
              <SimulatedDataNotice label={copy.simulatedNotice} />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-950 dark:text-white leading-tight">
              {state.auth.user.cooperativeName} Cooperative
            </h1>
            <p className="font-tabular text-sm font-medium text-slate-600 dark:text-slate-300">
              {kpis.totalRoomsCount} Cold Rooms Active ·{' '}
              {kpis.totalStorageKg.toLocaleString()} kg Stored ·{' '}
              {kpis.openAlertsCount} Open Alerts
            </p>
          </div>

          {/* Asymmetric Telemetry Preview Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <GlassCard tier="surface" radius="nested" specular className="p-4">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                {copy.activeAlerts}
              </div>
              <div className="font-tabular text-2xl font-bold text-slate-950 dark:text-white mt-1">
                {kpis.openAlertsCount}
              </div>
              <div className="font-tabular text-xs text-slate-600 dark:text-slate-400">
                {kpis.criticalAlertsCount} critical
              </div>
            </GlassCard>

            <GlassCard tier="surface" radius="nested" specular className="p-4">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                {copy.roomsInRange}
              </div>
              <div className="font-tabular text-2xl font-bold text-slate-950 dark:text-white mt-1">
                {kpis.roomsInRangeCount} / {kpis.totalRoomsCount}
              </div>
              <div className="font-tabular text-xs text-slate-600 dark:text-slate-400">
                {kpis.offlineRoomsCount} offline
              </div>
            </GlassCard>

            <GlassCard tier="surface" radius="nested" specular className="p-4">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                FEFO Due
              </div>
              <div className="font-tabular text-2xl font-bold text-slate-950 dark:text-white mt-1">
                {kpis.releaseOpeningCount}
              </div>
              <div className="font-tabular text-xs text-slate-600 dark:text-slate-400">
                {kpis.activeBatchesCount} active batches
              </div>
            </GlassCard>
          </div>

          <GlassCard tier="surface" radius="outer" className="p-4">
            <div className="glass-recessed rounded-[18px] divide-y divide-slate-900/8 dark:divide-white/8">
              {previewRooms.map((room) => {
                const ev = evaluateRoomStatus(room, state.rules[room.crop]);
                return (
                  <div
                    key={room.id}
                    className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="font-semibold text-slate-950 dark:text-white">
                        {room.name}
                      </span>
                      <span className="text-slate-600 dark:text-slate-400">
                        {room.crop}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-tabular text-slate-800 dark:text-slate-200">
                        {room.online
                          ? `${room.tempC.toFixed(1)} °C · RH ${room.humidityPct.toFixed(0)}%`
                          : `Offline ${room.offlineSince ?? '05:14'}`}
                      </span>
                      <StatusBadge
                        tone={severityToTone(ev.severity)}
                        label={ev.statusLabel}
                        compact
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </GlassCard>
        </section>

        {/* Right: Floating Optical Auth Gateway */}
        <section className="lg:col-span-5">
          <GlassCard
            tier="floating"
            radius="outer"
            refraction
            className="p-6 flex flex-col gap-5"
          >
            {/* Segmented Mode Switch */}
            <div
              className="glass-recessed rounded-full p-1 grid grid-cols-2 gap-1"
              role="tablist"
              aria-label="Authentication mode"
            >
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'signin'}
                onClick={() => {
                  setMode('signin');
                  setError(null);
                }}
                className={`motion-snap min-h-[44px] rounded-full text-sm font-semibold cursor-pointer ${
                  mode === 'signin'
                    ? 'pill-active'
                    : 'text-slate-700 dark:text-slate-300'
                }`}
              >
                {copy.signInTitle}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'signup'}
                onClick={() => {
                  setMode('signup');
                  setError(null);
                }}
                className={`motion-snap min-h-[44px] rounded-full text-sm font-semibold cursor-pointer ${
                  mode === 'signup'
                    ? 'pill-active'
                    : 'text-slate-700 dark:text-slate-300'
                }`}
              >
                {copy.createAccountTitle}
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3.5" noValidate>
              {mode === 'signup' && (
                <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <span>Full name</span>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => {
                      setFullName(e.target.value);
                      setError(null);
                    }}
                    placeholder="Elena Ramos"
                    className="glass-recessed min-h-[44px] px-3.5 rounded-[14px] text-sm text-slate-950 dark:text-white"
                  />
                </label>
              )}

              <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <span>Work email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError(null);
                  }}
                  placeholder="manager@benguetcoop.ph"
                  className="glass-recessed min-h-[44px] px-3.5 rounded-[14px] text-sm text-slate-950 dark:text-white"
                />
              </label>

              {mode === 'signup' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <span>Cooperative / facility</span>
                    <input
                      type="text"
                      value={cooperativeName}
                      onChange={(e) => {
                        setCooperativeName(e.target.value);
                        setError(null);
                      }}
                      placeholder="Benguet Highland"
                      className="glass-recessed min-h-[44px] px-3.5 rounded-[14px] text-sm text-slate-950 dark:text-white"
                    />
                  </label>

                  <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <span>Role</span>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as UserRole)}
                      className="glass-recessed min-h-[44px] px-3 rounded-[14px] text-sm text-slate-950 dark:text-white bg-transparent cursor-pointer"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r} className="text-slate-900">
                          {r}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}

              <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <span>Password</span>
                <div className="relative flex items-center">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError(null);
                    }}
                    className="glass-recessed min-h-[44px] w-full pl-3.5 pr-12 rounded-[14px] font-tabular text-sm text-slate-950 dark:text-white"
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-1 w-10 h-10 rounded-full inline-flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-900/6 dark:hover:bg-white/10 cursor-pointer"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" strokeWidth={1.75} />
                    ) : (
                      <Eye className="w-4 h-4" strokeWidth={1.75} />
                    )}
                  </button>
                </div>
              </label>

              {error && (
                <p
                  role="alert"
                  className="text-xs font-semibold text-rose-700 dark:text-rose-300"
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                className="btn-primary min-h-[44px] w-full px-5 rounded-full text-sm font-semibold cursor-pointer mt-1"
              >
                {mode === 'signin' ? copy.signInTitle : copy.createAccountTitle}
              </button>
            </form>

            <div className="pt-3 border-t border-slate-900/10 dark:border-white/10 flex flex-col gap-2">
              <button
                type="button"
                onClick={demoLogin}
                className="btn-secondary min-h-[44px] w-full px-4 rounded-full text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" strokeWidth={1.75} />
                <span>{copy.demoManagerLogin}</span>
              </button>
            </div>
          </GlassCard>
        </section>
      </main>

      <footer className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center justify-between gap-2 pt-4">
        <span>Cold-Chain Operations Gateway</span>
        <span className="font-tabular">Local session persistence active</span>
      </footer>
    </div>
  );
}
