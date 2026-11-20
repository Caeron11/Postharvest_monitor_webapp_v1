import React from 'react';
import {
  PostharvestProvider,
  usePostharvest,
} from './context/PostharvestContext';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { SpatialShell } from './components/layout/SpatialShell';
import { AuthView } from './views/AuthView';
import { DashboardView } from './views/DashboardView';
import { RoomDetailView } from './views/RoomDetailView';
import { InventoryView } from './views/InventoryView';
import { AlertsSettingsView } from './views/AlertsSettingsView';
import { GlassCard } from './components/ui/GlassCard';

function PostharvestAppContent() {
  const { state, toastMessage } = usePostharvest();

  if (!state.auth.isAuthenticated) {
    return (
      <>
        <AuthView />
        {toastMessage && (
          <div
            role="status"
            aria-live="polite"
            className="fixed top-4 left-1/2 -translate-x-1/2 z-40 pointer-events-none"
          >
            <GlassCard
              tier="floating"
              radius="pill"
              refraction
              className="px-4 py-2 text-xs font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap"
            >
              {toastMessage}
            </GlassCard>
          </div>
        )}
      </>
    );
  }

  return (
    <SpatialShell>
      {state.activeView === 'dashboard' && <DashboardView />}
      {state.activeView === 'rooms' && <RoomDetailView />}
      {state.activeView === 'inventory' && <InventoryView />}
      {state.activeView === 'alerts' && <AlertsSettingsView />}
    </SpatialShell>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <PostharvestProvider>
        <PostharvestAppContent />
      </PostharvestProvider>
    </ErrorBoundary>
  );
}
