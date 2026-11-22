import React from 'react';
import {
  BellRing,
  LayoutDashboard,
  LogOut,
  Moon,
  PackageCheck,
  Sun,
  ThermometerSnowflake,
} from 'lucide-react';
import { usePostharvest } from '../../context/PostharvestContext';
import type { ViewId } from '../../types/postharvest';
import { getUiCopy } from '../../utils/i18n';
import { GlassCard } from '../ui/GlassCard';

export function SpatialShell({ children }: { children: React.ReactNode }) {
  const { state, kpis, setView, toggleTheme, signOut, toastMessage } =
    usePostharvest();
  const copy = getUiCopy(state.language);

  const navItems: {
    id: ViewId;
    label: string;
    shortLabel: string;
    icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  }[] = [
    {
      id: 'dashboard',
      label: copy.navDashboard,
      shortLabel: copy.navDashboard,
      icon: LayoutDashboard,
    },
    {
      id: 'rooms',
      label: copy.navRooms,
      shortLabel: copy.navRoomsShort,
      icon: ThermometerSnowflake,
    },
    {
      id: 'inventory',
      label: copy.navInventory,
      shortLabel: copy.navInventoryShort,
      icon: PackageCheck,
    },
    {
      id: 'alerts',
      label: copy.navAlerts,
      shortLabel: copy.navAlertsShort,
      icon: BellRing,
    },
  ];

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Desktop Floating Spatial Rail */}
      <aside className="hidden lg:flex lg:flex-col lg:w-[248px] lg:shrink-0 lg:p-3.5 lg:sticky lg:top-0 lg:h-screen">
        <GlassCard
          tier="floating"
          radius="outer"
          refraction
          className="flex flex-col justify-between h-full p-3.5"
        >
          <div className="flex flex-col gap-5">
            <div className="px-2 pt-1.5">
              <button
                type="button"
                onClick={() => setView('dashboard')}
                className="text-left font-display-heading text-[18px] font-bold text-slate-900 dark:text-slate-50 whitespace-nowrap cursor-pointer"
              >
                Postharvest Monitor
              </button>
            </div>

            <nav aria-label="Primary navigation" className="flex flex-col gap-1.5">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = state.activeView === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => setView(item.id)}
                    className={`motion-snap min-h-[44px] w-full px-3.5 rounded-full flex items-center justify-between gap-2 text-sm cursor-pointer whitespace-nowrap ${
                      isActive
                        ? 'pill-active'
                        : 'font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-900/6 dark:hover:bg-white/10 hover:text-slate-950 dark:hover:text-white'
                    }`}
                  >
                    <span className="inline-flex items-center gap-2.5 truncate">
                      <Icon
                        className={`w-4 h-4 shrink-0 ${
                          isActive ? 'text-[#111318]' : 'icon-dorfic'
                        }`}
                        strokeWidth={1.75}
                      />
                      <span className="truncate">{item.label}</span>
                    </span>
                    {item.id === 'alerts' && kpis.openAlertsCount > 0 && (
                      <span
                        data-testid="sidebar-alert-count"
                        className={`font-tabular text-xs font-bold px-1.5 py-0.5 rounded-full ${
                          isActive
                            ? 'bg-[#111318] text-white'
                            : 'bg-[#F43F5E]/16 text-[#BE123C] dark:bg-[#F43F5E]/20 dark:text-[#FB7185]'
                        }`}
                      >
                        {kpis.openAlertsCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="flex flex-col gap-2.5 pt-3.5 border-t border-slate-900/10 dark:border-white/10">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={`Switch to ${state.theme === 'light' ? 'dark' : 'light'} mode`}
              className="btn-secondary min-h-[44px] w-full px-3.5 rounded-full flex items-center justify-between text-xs font-semibold cursor-pointer whitespace-nowrap"
            >
              <span>
                {state.theme === 'light' ? copy.darkGlass : copy.lightGlass}
              </span>
              {state.theme === 'light' ? (
                <Moon className="w-4 h-4 shrink-0" strokeWidth={1.75} />
              ) : (
                <Sun className="w-4 h-4 shrink-0" strokeWidth={1.75} />
              )}
            </button>

            <div className="glass-recessed rounded-[18px] p-3 flex flex-col gap-2">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {state.auth.user.fullName}
                </div>
                <div className="text-[11px] leading-snug text-slate-600 dark:text-slate-400">
                  {copy.cooperativeLabel}: {state.auth.user.cooperativeName}
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-400 truncate">
                  {copy.roleLabel}: {state.auth.user.role}
                </div>
              </div>

              <button
                type="button"
                onClick={signOut}
                className="btn-secondary min-h-[40px] w-full px-3 rounded-full text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <LogOut className="w-3.5 h-3.5" strokeWidth={1.75} />
                <span>{copy.signOut}</span>
              </button>
            </div>
          </div>
        </GlassCard>
      </aside>

      {/* Mobile Compact Header */}
      <header className="lg:hidden sticky top-0 z-30 mb-6 px-3 pt-2.5 pb-1 bg-gradient-to-b from-[#EEF1F6]/95 via-[#EEF1F6]/75 to-transparent dark:from-[#0D0F12]/95 dark:via-[#0D0F12]/75 dark:to-transparent">
        <GlassCard
          tier="floating"
          radius="pill"
          refraction
          className="glass-overlay-dense h-[52px] px-4 flex items-center justify-between gap-2"
        >
          <button
            type="button"
            onClick={() => setView('dashboard')}
            className="font-display-heading text-base font-bold text-slate-900 dark:text-slate-50 whitespace-nowrap cursor-pointer"
          >
            Postharvest Monitor
          </button>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={`Switch to ${state.theme === 'light' ? 'dark' : 'light'} mode`}
              className="btn-secondary w-9 h-9 rounded-full inline-flex items-center justify-center cursor-pointer shrink-0"
            >
              {state.theme === 'light' ? (
                <Moon className="w-4 h-4" strokeWidth={1.75} />
              ) : (
                <Sun className="w-4 h-4" strokeWidth={1.75} />
              )}
            </button>
            <button
              type="button"
              onClick={signOut}
              aria-label={copy.signOut}
              className="btn-secondary w-9 h-9 rounded-full inline-flex items-center justify-center cursor-pointer shrink-0"
            >
              <LogOut className="w-4 h-4" strokeWidth={1.75} />
            </button>
          </div>
        </GlassCard>
      </header>

      {/* Main Content Stage */}
      <main className="relative z-0 flex-1 min-w-0 px-4 sm:px-5 lg:px-6 xl:px-8 pt-0 lg:pt-6 pb-24 lg:pb-10 max-w-[1280px] w-full mx-auto">
        {children}
      </main>

      {/* Mobile Floating Pill Bottom Navigation */}
      <nav
        aria-label="Mobile navigation"
        className="lg:hidden fixed bottom-3 inset-x-3 z-30"
      >
        <GlassCard
          tier="floating"
          radius="pill"
          refraction
          className="glass-overlay-dense h-[58px] px-1.5 flex items-center justify-around gap-1"
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = state.activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-current={isActive ? 'page' : undefined}
                onClick={() => setView(item.id)}
                className={`motion-snap flex-1 min-h-[44px] rounded-full flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold cursor-pointer ${
                  isActive
                    ? 'pill-active'
                    : 'text-slate-700 dark:text-slate-300'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? 'text-[#111318]' : 'icon-dorfic'
                  }`}
                  strokeWidth={1.75}
                />
                <span className="truncate">{item.shortLabel}</span>
              </button>
            );
          })}
        </GlassCard>
      </nav>

      {/* Live Feedback Toast */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-20 lg:bottom-5 left-1/2 -translate-x-1/2 z-[60] pointer-events-none"
        >
          <GlassCard
            tier="floating"
            radius="pill"
            refraction
            className="glass-overlay-dense px-4 py-2 text-xs font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap"
          >
            {toastMessage}
          </GlassCard>
        </div>
      )}
    </div>
  );
}
