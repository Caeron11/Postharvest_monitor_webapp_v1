import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from 'react';
import {
  createInitialState,
  DEFAULT_CROP_RULES,
  DEFAULT_GLASS_SETTINGS,
  DEFAULT_NOTIFICATION_SETTINGS,
  DEFAULT_USER_PROFILE,
  STATE_SCHEMA_VERSION,
} from '../data/seedData';
import type {
  AlertsSubTab,
  CompressorMode,
  CropThresholdRule,
  CropType,
  FacilityKpis,
  GlassSettings,
  InventoryBatch,
  LanguageCode,
  NotificationSettings,
  PostharvestState,
  ScenarioType,
  UserProfile,
  ViewId,
} from '../types/postharvest';
import {
  applyScenarioToRooms,
  computeFacilityKpis,
  formatTimeHHMM,
  syncAlertsWithRooms,
} from '../utils/postharvestEngine';
import { buildRoutePath, parseRoutePath } from '../utils/routeSync';
import { playNotificationChime } from '../utils/soundCue';

const STORAGE_KEY = 'postharvest_monitor_state_v2';
const LEGACY_STORAGE_KEY = 'postharvest_monitor_state_v1';

type Action =
  | { type: 'SET_VIEW'; view: ViewId }
  | { type: 'SET_ALERTS_SUBTAB'; tab: AlertsSubTab }
  | { type: 'OPEN_ROOM'; roomId: string }
  | { type: 'REVIEW_BATCH'; batchId: string }
  | { type: 'EDIT_CROP_RULES'; crop: CropType }
  | { type: 'SET_THEME'; theme: 'light' | 'dark' }
  | { type: 'TOGGLE_THEME' }
  | { type: 'SET_LANGUAGE'; language: LanguageCode }
  | { type: 'TOGGLE_AUTO_REFRESH' }
  | { type: 'SIGN_IN'; email: string; password: string }
  | { type: 'SIGN_UP'; profile: UserProfile; password: string }
  | { type: 'DEMO_LOGIN' }
  | { type: 'SIGN_OUT' }
  | { type: 'UPDATE_ACCOUNT'; profile: UserProfile; newPassword?: string }
  | { type: 'UPDATE_NOTIFICATIONS'; patch: Partial<NotificationSettings> }
  | { type: 'UPDATE_GLASS'; patch: Partial<GlassSettings> }
  | { type: 'RESET_GLASS' }
  | { type: 'ACKNOWLEDGE_ALERT'; alertId: string }
  | { type: 'SAVE_CROP_RULE'; rule: CropThresholdRule }
  | { type: 'RESET_CROP_RULE'; crop: CropType }
  | {
      type: 'RELEASE_BATCH';
      batchId: string;
      releaseQtyKg: number;
      note?: string;
    }
  | { type: 'TOGGLE_BATCH_HOLD'; batchId: string }
  | { type: 'RESTORE_BATCH'; batchId: string }
  | {
      type: 'ADD_BATCH';
      batch: Omit<InventoryBatch, 'id' | 'manualHold' | 'released'>;
    }
  | {
      type: 'SET_COMPRESSOR_MODE';
      roomId: string;
      mode: CompressorMode;
    }
  | { type: 'TOGGLE_DEFROST'; roomId: string }
  | { type: 'TOGGLE_SENSOR_ONLINE'; roomId: string }
  | {
      type: 'UPDATE_SIMULATOR';
      patch: Partial<{
        scenario: ScenarioType;
        durationHours: number;
        ambientOffsetC: number;
        compressorLoadPct: number;
      }>;
    }
  | { type: 'RUN_SCENARIO' }
  | { type: 'TICK_TELEMETRY' };

function clampNumber(val: unknown, min: number, max: number, fallback: number): number {
  if (typeof val !== 'number' || !Number.isFinite(val)) return fallback;
  return Math.min(max, Math.max(min, val));
}

function loadPersistedState(): PostharvestState {
  const fallback = createInitialState();
  if (typeof window === 'undefined') return fallback;

  let merged: PostharvestState = fallback;
  try {
    const raw =
      window.localStorage.getItem(STORAGE_KEY) ??
      window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PostharvestState>;
      if (parsed && Array.isArray(parsed.rooms) && parsed.rules) {
        const glassIn = parsed.glass;
        const notifIn = parsed.notifications;
        const authIn = parsed.auth;
        merged = {
          ...fallback,
          ...parsed,
          schemaVersion: STATE_SCHEMA_VERSION,
          theme: parsed.theme === 'dark' ? 'dark' : 'light',
          language: parsed.language === 'fil' ? 'fil' : 'en',
          alertsSubTab:
            parsed.alertsSubTab === 'settings' ? 'settings' : 'alerts',
          rules: { ...DEFAULT_CROP_RULES, ...parsed.rules },
          simulator: { ...fallback.simulator, ...parsed.simulator },
          glass: {
            blurPx: clampNumber(
              glassIn?.blurPx,
              8,
              48,
              DEFAULT_GLASS_SETTINGS.blurPx
            ),
            frostPct: clampNumber(
              glassIn?.frostPct,
              35,
              90,
              DEFAULT_GLASS_SETTINGS.frostPct
            ),
            depthScale: clampNumber(
              glassIn?.depthScale,
              0.5,
              1.5,
              DEFAULT_GLASS_SETTINGS.depthScale
            ),
            dispersionPct: clampNumber(
              glassIn?.dispersionPct,
              0,
              150,
              DEFAULT_GLASS_SETTINGS.dispersionPct
            ),
          },
          notifications: {
            ...DEFAULT_NOTIFICATION_SETTINGS,
            ...(notifIn ?? {}),
          },
          auth: {
            isAuthenticated: Boolean(authIn?.isAuthenticated),
            user: {
              ...DEFAULT_USER_PROFILE,
              ...(authIn?.user ?? {}),
            },
            password:
              typeof authIn?.password === 'string' && authIn.password.length >= 6
                ? authIn.password
                : fallback.auth.password,
          },
        };
      }
    }
  } catch {
    merged = fallback;
  }

  // Optional autostart query support for direct evaluation
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      merged = {
        ...merged,
        auth: {
          ...merged.auth,
          isAuthenticated: true,
        },
      };
    }
  } catch {
    // Ignore URLSearchParams errors
  }

  const routeFromUrl = parseRoutePath(
    window.location.pathname,
    merged.rooms.map((r) => r.id)
  );
  if (routeFromUrl) {
    merged = {
      ...merged,
      activeView: routeFromUrl.view,
      selectedRoomId: routeFromUrl.roomId ?? merged.selectedRoomId,
    };
  }

  return merged;
}

function reducer(state: PostharvestState, action: Action): PostharvestState {
  const nowTime = formatTimeHHMM();

  switch (action.type) {
    case 'SET_VIEW':
      return { ...state, activeView: action.view };

    case 'SET_ALERTS_SUBTAB':
      return { ...state, alertsSubTab: action.tab };

    case 'OPEN_ROOM':
      return {
        ...state,
        activeView: 'rooms',
        selectedRoomId: action.roomId,
      };

    case 'REVIEW_BATCH':
      return {
        ...state,
        activeView: 'inventory',
        selectedBatchId: action.batchId,
      };

    case 'EDIT_CROP_RULES':
      return {
        ...state,
        activeView: 'alerts',
        alertsSubTab: 'alerts',
        selectedRuleCrop: action.crop,
      };

    case 'SET_THEME':
      return {
        ...state,
        theme: action.theme,
      };

    case 'TOGGLE_THEME':
      return {
        ...state,
        theme: state.theme === 'light' ? 'dark' : 'light',
      };

    case 'SET_LANGUAGE':
      return {
        ...state,
        language: action.language,
      };

    case 'TOGGLE_AUTO_REFRESH':
      return {
        ...state,
        autoRefresh: !state.autoRefresh,
      };

    case 'SIGN_IN':
      return {
        ...state,
        auth: {
          ...state.auth,
          isAuthenticated: true,
          user: {
            ...state.auth.user,
            email: action.email.trim(),
          },
          password: action.password,
        },
      };

    case 'SIGN_UP':
      return {
        ...state,
        auth: {
          isAuthenticated: true,
          user: {
            fullName: action.profile.fullName.trim(),
            email: action.profile.email.trim(),
            cooperativeName: action.profile.cooperativeName.trim(),
            role: action.profile.role,
          },
          password: action.password,
        },
      };

    case 'DEMO_LOGIN':
      return {
        ...state,
        auth: {
          ...state.auth,
          isAuthenticated: true,
          user: { ...DEFAULT_USER_PROFILE },
        },
      };

    case 'SIGN_OUT':
      return {
        ...state,
        auth: {
          ...state.auth,
          isAuthenticated: false,
        },
      };

    case 'UPDATE_ACCOUNT':
      return {
        ...state,
        auth: {
          ...state.auth,
          user: {
            fullName: action.profile.fullName.trim(),
            email: action.profile.email.trim(),
            cooperativeName: action.profile.cooperativeName.trim(),
            role: action.profile.role,
          },
          password:
            action.newPassword && action.newPassword.length >= 6
              ? action.newPassword
              : state.auth.password,
        },
      };

    case 'UPDATE_NOTIFICATIONS':
      return {
        ...state,
        notifications: {
          ...state.notifications,
          ...action.patch,
        },
      };

    case 'UPDATE_GLASS':
      return {
        ...state,
        glass: {
          ...state.glass,
          ...action.patch,
        },
      };

    case 'RESET_GLASS':
      return {
        ...state,
        glass: { ...DEFAULT_GLASS_SETTINGS },
      };

    case 'ACKNOWLEDGE_ALERT':
      return {
        ...state,
        alerts: state.alerts.map((alert) =>
          alert.id === action.alertId
            ? { ...alert, acknowledged: true }
            : alert
        ),
      };

    case 'SAVE_CROP_RULE': {
      const nextRules = {
        ...state.rules,
        [action.rule.crop]: action.rule,
      };
      const nextAlerts = syncAlertsWithRooms(
        state.rooms,
        nextRules,
        state.alerts,
        nowTime
      );
      return {
        ...state,
        selectedRuleCrop: action.rule.crop,
        rules: nextRules,
        alerts: nextAlerts,
        lastUpdated: nowTime,
      };
    }

    case 'RESET_CROP_RULE': {
      const defaultRule = DEFAULT_CROP_RULES[action.crop];
      const nextRules = {
        ...state.rules,
        [action.crop]: { ...defaultRule },
      };
      const nextAlerts = syncAlertsWithRooms(
        state.rooms,
        nextRules,
        state.alerts,
        nowTime
      );
      return {
        ...state,
        selectedRuleCrop: action.crop,
        rules: nextRules,
        alerts: nextAlerts,
        lastUpdated: nowTime,
      };
    }

    case 'RELEASE_BATCH': {
      const nextBatches = state.batches.map((batch) => {
        if (batch.id !== action.batchId) return batch;
        const remaining = batch.qtyKg - action.releaseQtyKg;
        if (remaining <= 0) {
          return {
            ...batch,
            released: true,
            manualHold: false,
            releasedAt: nowTime,
            releaseNote: action.note?.trim() || undefined,
          };
        }
        return {
          ...batch,
          qtyKg: remaining,
          releaseNote: action.note?.trim() || batch.releaseNote,
        };
      });
      return {
        ...state,
        batches: nextBatches,
        lastUpdated: nowTime,
      };
    }

    case 'TOGGLE_BATCH_HOLD':
      return {
        ...state,
        batches: state.batches.map((batch) =>
          batch.id === action.batchId
            ? { ...batch, manualHold: !batch.manualHold }
            : batch
        ),
      };

    case 'RESTORE_BATCH':
      return {
        ...state,
        batches: state.batches.map((batch) =>
          batch.id === action.batchId
            ? { ...batch, released: false, releasedAt: undefined }
            : batch
        ),
      };

    case 'ADD_BATCH': {
      const maxNum = state.batches.reduce((acc, b) => {
        const num = Number.parseInt(b.id.replace(/\D/g, ''), 10);
        return Number.isFinite(num) ? Math.max(acc, num) : acc;
      }, 0);
      const nextId = `B-${String(maxNum + 1).padStart(3, '0')}`;
      const created: InventoryBatch = {
        ...action.batch,
        id: nextId,
        manualHold: false,
        released: false,
      };
      return {
        ...state,
        batches: [created, ...state.batches],
        selectedBatchId: nextId,
        lastUpdated: nowTime,
      };
    }

    case 'SET_COMPRESSOR_MODE': {
      const nextRooms = state.rooms.map((room) =>
        room.id === action.roomId
          ? { ...room, compressorMode: action.mode }
          : room
      );
      return { ...state, rooms: nextRooms, lastUpdated: nowTime };
    }

    case 'TOGGLE_DEFROST': {
      const nextRooms = state.rooms.map((room) =>
        room.id === action.roomId
          ? { ...room, defrostActive: !room.defrostActive }
          : room
      );
      return { ...state, rooms: nextRooms, lastUpdated: nowTime };
    }

    case 'TOGGLE_SENSOR_ONLINE': {
      const nextRooms = state.rooms.map((room) => {
        if (room.id !== action.roomId) return room;
        const nextOnline = !room.online;
        return {
          ...room,
          online: nextOnline,
          offlineSince: nextOnline ? undefined : nowTime,
        };
      });
      const nextAlerts = syncAlertsWithRooms(
        nextRooms,
        state.rules,
        state.alerts,
        nowTime
      );
      return {
        ...state,
        rooms: nextRooms,
        alerts: nextAlerts,
        lastUpdated: nowTime,
      };
    }

    case 'UPDATE_SIMULATOR':
      return {
        ...state,
        simulator: {
          ...state.simulator,
          ...action.patch,
        },
      };

    case 'RUN_SCENARIO': {
      const { scenario, durationHours, ambientOffsetC, compressorLoadPct } =
        state.simulator;
      const nextRooms = applyScenarioToRooms(
        state.rooms,
        state.rules,
        scenario,
        durationHours,
        ambientOffsetC,
        compressorLoadPct
      );
      const nextAlerts = syncAlertsWithRooms(
        nextRooms,
        state.rules,
        [],
        nowTime
      );
      const scenarioLabel =
        scenario === 'normal'
          ? 'Normal storage'
          : scenario === 'equipment_failure'
            ? 'Equipment failure'
            : 'Harvest glut';
      return {
        ...state,
        rooms: nextRooms,
        alerts: nextAlerts,
        lastUpdated: nowTime,
        simulator: {
          ...state.simulator,
          lastRunAt: nowTime,
          lastRunSummary: `${scenarioLabel} (${durationHours}h) logged at ${nowTime}`,
        },
      };
    }

    case 'TICK_TELEMETRY': {
      const nextRooms = state.rooms.map((room, index) => {
        if (!room.online) return room;
        const micro = (index % 2 === 0 ? 1 : -1) * 0.1;
        const coolingNudge = room.compressorMode === 'boost' ? -0.1 : 0;
        const nextTemp = Number(
          Math.max(-1, room.tempC + coolingNudge + micro * 0.5).toFixed(1)
        );
        const nextHum = Number(
          Math.min(99, Math.max(70, room.humidityPct + micro)).toFixed(1)
        );
        return {
          ...room,
          tempC: nextTemp,
          humidityPct: nextHum,
        };
      });
      const nextAlerts = syncAlertsWithRooms(
        nextRooms,
        state.rules,
        state.alerts,
        nowTime
      );
      return {
        ...state,
        rooms: nextRooms,
        alerts: nextAlerts,
        lastUpdated: nowTime,
      };
    }

    default:
      return state;
  }
}

interface PostharvestContextValue {
  state: PostharvestState;
  kpis: FacilityKpis;
  isHydrating: boolean;
  toastMessage: string | null;
  notify: (message: string) => void;
  setView: (view: ViewId) => void;
  setAlertsSubTab: (tab: AlertsSubTab) => void;
  openRoom: (roomId: string) => void;
  reviewBatch: (batchId: string) => void;
  editCropRules: (crop: CropType) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;
  setLanguage: (language: LanguageCode) => void;
  toggleAutoRefresh: () => void;
  signIn: (email: string, password: string) => void;
  signUp: (profile: UserProfile, password: string) => void;
  demoLogin: () => void;
  signOut: () => void;
  updateAccount: (profile: UserProfile, newPassword?: string) => void;
  updateNotifications: (patch: Partial<NotificationSettings>) => void;
  updateGlass: (patch: Partial<GlassSettings>) => void;
  resetGlass: () => void;
  acknowledgeAlert: (alertId: string) => void;
  saveCropRule: (rule: CropThresholdRule) => void;
  resetCropRule: (crop: CropType) => void;
  releaseBatch: (batchId: string, releaseQtyKg: number, note?: string) => void;
  toggleBatchHold: (batchId: string) => void;
  restoreBatch: (batchId: string) => void;
  addBatch: (
    batch: Omit<InventoryBatch, 'id' | 'manualHold' | 'released'>
  ) => void;
  setCompressorMode: (roomId: string, mode: CompressorMode) => void;
  toggleDefrost: (roomId: string) => void;
  toggleSensorOnline: (roomId: string) => void;
  updateSimulator: (
    patch: Partial<{
      scenario: ScenarioType;
      durationHours: number;
      ambientOffsetC: number;
      compressorLoadPct: number;
    }>
  ) => void;
  runScenario: () => void;
}

const PostharvestContext = createContext<PostharvestContextValue | null>(null);

export function PostharvestProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, dispatch] = useReducer(reducer, undefined, loadPersistedState);
  const [isHydrating, setIsHydrating] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const kpis = useMemo(
    () =>
      computeFacilityKpis(
        state.rooms,
        state.rules,
        state.batches,
        state.alerts
      ),
    [state.rooms, state.rules, state.batches, state.alerts]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const id = window.setTimeout(() => setIsHydrating(false), 100);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.classList.toggle('dark', state.theme === 'dark');
    root.style.setProperty('--glass-blur', `${state.glass.blurPx}px`);
    root.style.setProperty(
      '--glass-frost',
      (state.glass.frostPct / 100).toFixed(2)
    );
    root.style.setProperty(
      '--glass-depth',
      state.glass.depthScale.toFixed(2)
    );
    root.style.setProperty(
      '--glass-dispersion',
      (state.glass.dispersionPct / 100).toFixed(2)
    );
  }, [state.theme, state.glass]);

  useEffect(() => {
    if (typeof window === 'undefined' || !state.auth.isAuthenticated) return;
    const targetPath = buildRoutePath(state.activeView, state.selectedRoomId);
    if (window.location.pathname !== targetPath) {
      window.history.pushState(null, '', targetPath);
    }
  }, [state.activeView, state.selectedRoomId, state.auth.isAuthenticated]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const roomIds = state.rooms.map((r) => r.id);
    const onPopState = () => {
      const parsed = parseRoutePath(window.location.pathname, roomIds);
      if (!parsed) return;
      if (parsed.view === 'rooms' && parsed.roomId) {
        dispatch({ type: 'OPEN_ROOM', roomId: parsed.roomId });
      } else {
        dispatch({ type: 'SET_VIEW', view: parsed.view });
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [state.rooms]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage quota errors in private contexts
    }
  }, [state]);

  useEffect(() => {
    if (typeof window === 'undefined' || !state.autoRefresh || !state.auth.isAuthenticated) {
      return;
    }
    const interval = window.setInterval(() => {
      dispatch({ type: 'TICK_TELEMETRY' });
    }, 12000);
    return () => window.clearInterval(interval);
  }, [state.autoRefresh, state.auth.isAuthenticated]);

  const notify = (message: string, chimeTone?: 'info' | 'alert') => {
    setToastMessage(message);
    if (chimeTone && state.notifications.audibleChime) {
      playNotificationChime(chimeTone);
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined' || !toastMessage) return;
    const id = window.setTimeout(() => setToastMessage(null), 2600);
    return () => window.clearTimeout(id);
  }, [toastMessage]);

  const value: PostharvestContextValue = {
    state,
    kpis,
    isHydrating,
    toastMessage,
    notify: (msg) => notify(msg),
    setView: (view) => dispatch({ type: 'SET_VIEW', view }),
    setAlertsSubTab: (tab) => dispatch({ type: 'SET_ALERTS_SUBTAB', tab }),
    openRoom: (roomId) => dispatch({ type: 'OPEN_ROOM', roomId }),
    reviewBatch: (batchId) => dispatch({ type: 'REVIEW_BATCH', batchId }),
    editCropRules: (crop) => dispatch({ type: 'EDIT_CROP_RULES', crop }),
    setTheme: (theme) => dispatch({ type: 'SET_THEME', theme }),
    toggleTheme: () => dispatch({ type: 'TOGGLE_THEME' }),
    setLanguage: (language) => {
      dispatch({ type: 'SET_LANGUAGE', language });
      notify(language === 'fil' ? 'Wika: Filipino (FIL)' : 'Language: English (EN)');
    },
    toggleAutoRefresh: () => dispatch({ type: 'TOGGLE_AUTO_REFRESH' }),
    signIn: (email, password) => {
      dispatch({ type: 'SIGN_IN', email, password });
      notify('Signed in');
    },
    signUp: (profile, password) => {
      dispatch({ type: 'SIGN_UP', profile, password });
      notify(`Workspace ready: ${profile.cooperativeName}`);
    },
    demoLogin: () => {
      dispatch({ type: 'DEMO_LOGIN' });
      notify('Signed in as Demo Manager');
    },
    signOut: () => {
      dispatch({ type: 'SIGN_OUT' });
      notify('Signed out');
    },
    updateAccount: (profile, newPassword) => {
      dispatch({ type: 'UPDATE_ACCOUNT', profile, newPassword });
      notify('Account settings saved');
    },
    updateNotifications: (patch) => {
      dispatch({ type: 'UPDATE_NOTIFICATIONS', patch });
      if (patch.audibleChime) {
        playNotificationChime('info');
      }
    },
    updateGlass: (patch) => dispatch({ type: 'UPDATE_GLASS', patch }),
    resetGlass: () => {
      dispatch({ type: 'RESET_GLASS' });
      notify('Optical glass reset to iOS Default');
    },
    acknowledgeAlert: (alertId) => {
      dispatch({ type: 'ACKNOWLEDGE_ALERT', alertId });
      notify('Alert acknowledged', 'info');
    },
    saveCropRule: (rule) => {
      dispatch({ type: 'SAVE_CROP_RULE', rule });
      notify(`Saved ${rule.crop} thresholds`, 'alert');
    },
    resetCropRule: (crop) => {
      dispatch({ type: 'RESET_CROP_RULE', crop });
      notify(`Reset ${crop} to source values`);
    },
    releaseBatch: (batchId, releaseQtyKg, note) => {
      dispatch({ type: 'RELEASE_BATCH', batchId, releaseQtyKg, note });
      notify(`Released ${releaseQtyKg} kg from ${batchId}`, 'info');
    },
    toggleBatchHold: (batchId) => {
      dispatch({ type: 'TOGGLE_BATCH_HOLD', batchId });
      notify(`Updated hold status for ${batchId}`);
    },
    restoreBatch: (batchId) => {
      dispatch({ type: 'RESTORE_BATCH', batchId });
      notify(`Restored ${batchId} to active inventory`);
    },
    addBatch: (batch) => {
      dispatch({ type: 'ADD_BATCH', batch });
      notify(`Added ${batch.crop} batch (${batch.qtyKg} kg)`, 'info');
    },
    setCompressorMode: (roomId, mode) => {
      dispatch({ type: 'SET_COMPRESSOR_MODE', roomId, mode });
      notify(`Compressor set to ${mode.toUpperCase()}`);
    },
    toggleDefrost: (roomId) => {
      dispatch({ type: 'TOGGLE_DEFROST', roomId });
      notify('Toggled defrost cycle');
    },
    toggleSensorOnline: (roomId) => {
      dispatch({ type: 'TOGGLE_SENSOR_ONLINE', roomId });
      notify('Updated room sensor link', 'alert');
    },
    updateSimulator: (patch) => dispatch({ type: 'UPDATE_SIMULATOR', patch }),
    runScenario: () => {
      dispatch({ type: 'RUN_SCENARIO' });
      notify('Scenario applied across rooms', 'alert');
    },
  };

  return (
    <PostharvestContext.Provider value={value}>
      {children}
    </PostharvestContext.Provider>
  );
}

export function usePostharvest(): PostharvestContextValue {
  const ctx = useContext(PostharvestContext);
  if (!ctx) {
    throw new Error('usePostharvest must be used inside PostharvestProvider');
  }
  return ctx;
}
