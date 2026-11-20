import React from 'react';
import { GlassCard } from './GlassCard';

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  handleReload = () => {
    window.location.reload();
  };

  handleResetData = () => {
    try {
      window.localStorage.removeItem('postharvest_monitor_state_v1');
    } catch {
      // Ignore storage access failures
    }
    window.location.assign('/');
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <GlassCard
          tier="floating"
          radius="outer"
          refraction
          className="max-w-md w-full p-6 flex flex-col gap-4"
        >
          <h1 className="text-xl font-bold text-slate-950 dark:text-white">
            Monitor display interrupted
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Reload the application or reset saved local state to recover.
          </p>
          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={this.handleReload}
              className="btn-primary min-h-[44px] px-5 rounded-full text-sm font-semibold cursor-pointer"
            >
              Reload monitor
            </button>
            <button
              type="button"
              onClick={this.handleResetData}
              className="btn-secondary min-h-[44px] px-4 rounded-full text-sm font-semibold cursor-pointer"
            >
              Reset local data
            </button>
          </div>
        </GlassCard>
      </div>
    );
  }
}
