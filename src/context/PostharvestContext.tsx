import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import {
  createInitialState,
  DEFAULT_CROP_RULES,
  DEFAULT_GLASS_SETTINGS,
  DEFAULT_NOTIFICATION_SETTINGS,
  DEFAULT_USER_PROFILE,
  STATE_SCHEMA_VERSION,
} from '../data/seedData';
import { firebaseAuth, googleAuthProvider } from '../lib/firebase';
import {
  isSupabaseConfigured,
  supabase,
  type AlertRow,
  type BatchRow,
  type StorageRoomRow,
} from '../lib/supabase';
import {
  fetchCloudWorkspace,
  patchCloudAlertAcknowledge,
  patchCloudBatch,
  patchCloudProfile,
  patchCloudRoom,
  postCloudBatch,
  postCloudSimulatorRooms,
  putCloudCropRule,
} from '../services/cloudApi';
import {
  acknowledgeAlertRecord,
  createBatchRecord,
  ensureUserProfile,
  fetchFacilityState,
  mapAlertRow,
  mapBatchRow,
  mapStorageRoomRow,
  releaseBatchRecord,
  subscribeFacilityRealtime,
  updateBatchStatusRecord,
  updateRoomControls,
  updateRoomThresholds,
  updateUserProfileRecord,
  type HydratedFacilityPayload,
} from '../services/postharvestRepo';
import type {
  AlertsSubTab,
  AuthSessionMode,
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
  UserRole,
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

const VALID_ROLES: UserRole[] = [
  'Facility Manager',
  'Cold-Chain Operator',
  'Quality Inspector',
];

function toUserRole(raw: unknown): UserRole {
  return (
    VALID_ROLES.find((r) => r === raw) ?? DEFAULT_USER_PROFILE.role
  ) as UserRole;
}

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
  | { type: 'SIGN_IN'; email: string }
  | { type: 'SIGN_UP'; profile: UserProfile }
  | {
      type: 'HYDRATE_REMOTE';
      mode: Exclude<AuthSessionMode, 'demo'>;
      payload: HydratedFacilityPayload;
    }
  | { type: 'RESTORE_SNAPSHOT'; snapshot: PostharvestState }
  | { type: 'APPLY_REALTIME_ROOM'; row: StorageRoomRow }
  | {
      type: 'APPLY_REALTIME_BATCH';
      eventType: 'INSERT' | 'UPDATE' | 'DELETE';
      row: BatchRow;
    }
  | {
      type: 'APPLY_REALTIME_ALERT';
      eventType: 'INSERT' | 'UPDATE' | 'DELETE';
      row: AlertRow;
    }
  | { type: 'DEMO_LOGIN' }
  | { type: 'SIGN_OUT' }
  | { type: 'UPDATE_ACCOUNT'; profile: UserProfile }
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
      id?: string;
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

function clampNumber(
  val: unknown,
  min: number,
  max: number,
  fallback: number
): number {
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
        const savedMode: AuthSessionMode =
          authIn?.mode === 'supabase'
            ? 'supabase'
            : authIn?.mode === 'cloudsql'
              ? 'cloudsql'
              : 'demo';
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
            isAuthenticated:
              savedMode === 'demo' ? Boolean(authIn?.isAuthenticated) : false,
            mode: savedMode,
            userId: savedMode === 'demo' ? undefined : authIn?.userId,
            cooperativeId:
              savedMode === 'demo' ? undefined : authIn?.cooperativeId,
            user: {
              ...DEFAULT_USER_PROFILE,
              ...(authIn?.user ?? {}),
            },
            password: '',
          },
        };
      }
    }
  } catch {
    merged = fallback;
  }

  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      merged = {
        ...merged,
        auth: {
          ...merged.auth,
          mode: 'demo',
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

function computeNextBatchId(
  batches: InventoryBatch[],
  cooperativeId?: string,
  useCoopPrefix?: boolean
): string {
  const maxNum = batches.reduce((acc, b) => {
    const match = b.id.match(/(\d+)$/);
    const num = match ? Number.parseInt(match[1], 10) : Number.NaN;
    return Number.isFinite(num) ? Math.max(acc, num) : acc;
  }, 0);
  const shortId = `B-${String(maxNum + 1).padStart(3, '0')}`;
  if (useCoopPrefix && cooperativeId) {
    return `${cooperativeId}-${shortId}`;
  }
  return shortId;
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
          mode: 'demo',
          userId: undefined,
          cooperativeId: undefined,
          user: {
            ...state.auth.user,
            email: action.email.trim(),
          },
          password: '',
        },
      };

    case 'SIGN_UP':
      return {
        ...state,
        auth: {
          isAuthenticated: true,
          mode: 'demo',
          userId: undefined,
          cooperativeId: undefined,
          user: {
            fullName: action.profile.fullName.trim(),
            email: action.profile.email.trim(),
            cooperativeName: action.profile.cooperativeName.trim(),
            role: action.profile.role,
          },
          password: '',
        },
      };

    case 'HYDRATE_REMOTE': {
      const { payload, mode } = action;
      const selectedRoomId = payload.rooms.some(
        (r) => r.id === state.selectedRoomId
      )
        ? state.selectedRoomId
        : payload.rooms[0]?.id ?? state.selectedRoomId;
      const selectedBatchId = payload.batches.some(
        (b) => b.id === state.selectedBatchId
      )
        ? state.selectedBatchId
        : payload.batches[0]?.id ?? state.selectedBatchId;

      return {
        ...state,
        selectedRoomId,
        selectedBatchId,
        theme: payload.theme,
        language: payload.language,
        glass: payload.glass,
        notifications: payload.notifications,
        rooms: payload.rooms.length > 0 ? payload.rooms : state.rooms,
        rules: payload.rules,
        batches: payload.batches,
        alerts: payload.alerts,
        lastUpdated: nowTime,
        auth: {
          isAuthenticated: true,
          mode,
          userId: payload.userId,
          cooperativeId: payload.cooperativeId,
          user: payload.profile,
          password: '',
        },
      };
    }

    case 'RESTORE_SNAPSHOT':
      return action.snapshot;

    case 'APPLY_REALTIME_ROOM': {
      const existing = state.rooms.find((r) => r.id === action.row.id);
      const mapped = mapStorageRoomRow(action.row, existing);
      const nextRooms = existing
        ? state.rooms.map((r) => (r.id === mapped.id ? mapped : r))
        : [...state.rooms, mapped];
      const nextRules: Record<CropType, CropThresholdRule> = {
        ...state.rules,
        [mapped.crop]: {
          ...state.rules[mapped.crop],
          crop: mapped.crop,
          tempMin: Number(action.row.min_temp),
          tempMax: Number(action.row.max_temp),
          humidityMin: Number(action.row.min_humidity),
          humidityMax: Number(action.row.max_humidity),
          co2Max: Number(action.row.co2_max),
          gasIndexMax: Number(action.row.gas_index_max),
        },
      };
      return {
        ...state,
        rooms: nextRooms,
        rules: nextRules,
        lastUpdated: nowTime,
      };
    }

    case 'APPLY_REALTIME_BATCH': {
      if (action.eventType === 'DELETE') {
        return {
          ...state,
          batches: state.batches.filter((b) => b.id !== action.row.id),
          lastUpdated: nowTime,
        };
      }
      const mapped = mapBatchRow(action.row);
      const exists = state.batches.some((b) => b.id === mapped.id);
      const nextBatches = exists
        ? state.batches.map((b) => (b.id === mapped.id ? mapped : b))
        : [mapped, ...state.batches];
      return {
        ...state,
        batches: nextBatches,
        lastUpdated: nowTime,
      };
    }

    case 'APPLY_REALTIME_ALERT': {
      if (action.eventType === 'DELETE') {
        return {
          ...state,
          alerts: state.alerts.filter((a) => a.id !== action.row.id),
          lastUpdated: nowTime,
        };
      }
      const mapped = mapAlertRow(action.row, state.rooms);
      const exists = state.alerts.some((a) => a.id === mapped.id);
      const nextAlerts = exists
        ? state.alerts.map((a) => (a.id === mapped.id ? mapped : a))
        : [mapped, ...state.alerts];
      return {
        ...state,
        alerts: nextAlerts,
        lastUpdated: nowTime,
      };
    }

    case 'DEMO_LOGIN': {
      if (state.auth.mode !== 'demo') {
        const freshDemo = createInitialState();
        return {
          ...freshDemo,
          theme: state.theme,
          language: state.language,
          glass: state.glass,
          notifications: state.notifications,
          auth: {
            isAuthenticated: true,
            mode: 'demo',
            user: { ...DEFAULT_USER_PROFILE },
            password: '',
          },
        };
      }
      return {
        ...state,
        auth: {
          ...state.auth,
          isAuthenticated: true,
          mode: 'demo',
          userId: undefined,
          cooperativeId: undefined,
          user: { ...DEFAULT_USER_PROFILE },
          password: '',
        },
      };
    }

    case 'SIGN_OUT':
      return {
        ...state,
        auth: {
          ...state.auth,
          isAuthenticated: false,
          password: '',
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
          password: '',
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
      const nextId =
        action.id ??
        computeNextBatchId(state.batches, state.auth.cooperativeId, false);
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
  isSupabaseReady: boolean;
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
  signInWithGoogle: () => Promise<{ error?: string }>;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (profile: UserProfile, password: string) => Promise<{ error?: string }>;
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
  const stateRef = useRef(state);
  stateRef.current = state;

  const isCloudSqlActive = Boolean(
    state.auth.isAuthenticated &&
      state.auth.mode === 'cloudsql' &&
      state.auth.userId &&
      state.auth.cooperativeId
  );

  const isSupabaseActive = Boolean(
    isSupabaseConfigured &&
      supabase &&
      state.auth.isAuthenticated &&
      state.auth.mode === 'supabase' &&
      state.auth.userId &&
      state.auth.cooperativeId
  );

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

  const notify = (message: string, chimeTone?: 'info' | 'alert') => {
    setToastMessage(message);
    if (chimeTone && stateRef.current.notifications.audibleChime) {
      playNotificationChime(chimeTone);
    }
  };

  // Hydrate Firebase Auth session -> Cloud SQL PostgreSQL workspace
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;
    let settled = false;

    const finishHydration = () => {
      if (!cancelled && !settled) {
        settled = true;
        setIsHydrating(false);
      }
    };

    const fallbackTimer = window.setTimeout(finishHydration, 400);

    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
      if (user) {
        try {
          const payload = await fetchCloudWorkspace();
          if (!cancelled) {
            dispatch({ type: 'HYDRATE_REMOTE', mode: 'cloudsql', payload });
          }
        } catch (err) {
          if (!cancelled) {
            const msg =
              err instanceof Error ? err.message : 'Unable to sync workspace.';
            notify(msg, 'alert');
          }
        }
      } else if (stateRef.current.auth.mode === 'cloudsql') {
        dispatch({ type: 'SIGN_OUT' });
      }
      finishHydration();
    });

    return () => {
      cancelled = true;
      window.clearTimeout(fallbackTimer);
      unsubscribe();
    };
  }, []);

  // Optional Supabase session hydration if VITE_SUPABASE_* env vars are supplied
  useEffect(() => {
    if (typeof window === 'undefined' || !isSupabaseConfigured || !supabase) {
      return;
    }

    const client = supabase;
    let cancelled = false;

    const hydrateSupabaseUser = async (
      userId: string,
      email?: string,
      metadata?: Record<string, unknown>
    ) => {
      try {
        let payload = await fetchFacilityState(userId);
        if (!payload) {
          const fallbackProfile: UserProfile = {
            fullName:
              typeof metadata?.full_name === 'string' &&
              metadata.full_name.trim()
                ? metadata.full_name.trim()
                : DEFAULT_USER_PROFILE.fullName,
            email: email ?? DEFAULT_USER_PROFILE.email,
            cooperativeName:
              typeof metadata?.cooperative_name === 'string' &&
              metadata.cooperative_name.trim()
                ? metadata.cooperative_name.trim()
                : DEFAULT_USER_PROFILE.cooperativeName,
            role: toUserRole(metadata?.role),
          };
          await ensureUserProfile(userId, fallbackProfile, {
            language: stateRef.current.language,
            theme: stateRef.current.theme,
            glass: stateRef.current.glass,
            notifications: stateRef.current.notifications,
          });
          payload = await fetchFacilityState(userId);
        }
        if (!cancelled && payload) {
          dispatch({ type: 'HYDRATE_REMOTE', mode: 'supabase', payload });
        }
      } catch (err) {
        if (!cancelled) {
          const msg =
            err instanceof Error ? err.message : 'Unable to sync workspace.';
          notify(msg, 'alert');
        }
      }
    };

    void client.auth.getSession().then(async ({ data }) => {
      if (data.session?.user && !firebaseAuth.currentUser) {
        await hydrateSupabaseUser(
          data.session.user.id,
          data.session.user.email,
          data.session.user.user_metadata as Record<string, unknown> | undefined
        );
      }
    });

    const { data: authListener } = client.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_OUT') {
          if (stateRef.current.auth.mode === 'supabase') {
            dispatch({ type: 'SIGN_OUT' });
          }
          return;
        }
        if (event === 'SIGNED_IN' && session?.user) {
          if (
            stateRef.current.auth.mode === 'supabase' &&
            stateRef.current.auth.userId === session.user.id &&
            stateRef.current.auth.isAuthenticated
          ) {
            return;
          }
          void hydrateSupabaseUser(
            session.user.id,
            session.user.email,
            session.user.user_metadata as Record<string, unknown> | undefined
          );
        }
      }
    );

    return () => {
      cancelled = true;
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Optional Supabase Realtime listener when active
  useEffect(() => {
    if (!isSupabaseActive || !state.auth.cooperativeId) return;
    const unsubscribe = subscribeFacilityRealtime(state.auth.cooperativeId, {
      onRoomChange: (row) => dispatch({ type: 'APPLY_REALTIME_ROOM', row }),
      onBatchChange: (eventType, row) =>
        dispatch({ type: 'APPLY_REALTIME_BATCH', eventType, row }),
      onAlertChange: (eventType, row) =>
        dispatch({ type: 'APPLY_REALTIME_ALERT', eventType, row }),
    });
    return () => {
      unsubscribe();
    };
  }, [isSupabaseActive, state.auth.cooperativeId]);

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

  // Persist local demo state safely without storing passwords or tokens
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stateToPersist: PostharvestState = {
        ...state,
        auth: {
          ...state.auth,
          password: '',
          isAuthenticated:
            state.auth.mode === 'demo' ? state.auth.isAuthenticated : false,
        },
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToPersist));
    } catch {
      // Ignore storage quota errors in private contexts
    }
  }, [state]);

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !state.autoRefresh ||
      !state.auth.isAuthenticated
    ) {
      return;
    }
    const interval = window.setInterval(() => {
      dispatch({ type: 'TICK_TELEMETRY' });
    }, 12000);
    return () => window.clearInterval(interval);
  }, [state.autoRefresh, state.auth.isAuthenticated]);

  useEffect(() => {
    if (typeof window === 'undefined' || !toastMessage) return;
    const id = window.setTimeout(() => setToastMessage(null), 2600);
    return () => window.clearTimeout(id);
  }, [toastMessage]);

  const runWithRollback = (
    snapshot: PostharvestState,
    task: () => Promise<void>,
    failureLabel: string
  ) => {
    void task().catch((err: unknown) => {
      dispatch({ type: 'RESTORE_SNAPSHOT', snapshot });
      const msg = err instanceof Error ? err.message : 'Request failed';
      notify(`${failureLabel}: ${msg}`, 'alert');
    });
  };

  const persistProfilePrefs = (
    snapshot: PostharvestState,
    patch: Partial<{
      language: LanguageCode;
      theme: 'light' | 'dark';
      glass: GlassSettings;
      notifications: NotificationSettings;
    }>
  ) => {
    const nextTheme = patch.theme ?? state.theme;
    const nextGlass = patch.glass ?? state.glass;

    if (isCloudSqlActive) {
      const apiPatch: Parameters<typeof patchCloudProfile>[0] = {};
      if (patch.language) apiPatch.language = patch.language;
      if (patch.theme || patch.glass) {
        apiPatch.themePrefs = { theme: nextTheme, ...nextGlass };
      }
      if (patch.notifications) {
        apiPatch.notificationPrefs = patch.notifications;
      }
      runWithRollback(
        snapshot,
        () => patchCloudProfile(apiPatch),
        'Preferences sync failed'
      );
      return;
    }

    if (isSupabaseActive && state.auth.userId) {
      const userId = state.auth.userId;
      const dbPatch: Parameters<typeof updateUserProfileRecord>[1] = {};
      if (patch.language) dbPatch.language = patch.language;
      if (patch.theme || patch.glass) {
        dbPatch.theme_prefs = { theme: nextTheme, ...nextGlass };
      }
      if (patch.notifications) {
        dbPatch.notification_prefs = patch.notifications;
      }
      runWithRollback(
        snapshot,
        () => updateUserProfileRecord(userId, dbPatch),
        'Preferences sync failed'
      );
    }
  };

  const value: PostharvestContextValue = {
    state,
    kpis,
    isHydrating,
    isSupabaseReady: isSupabaseConfigured,
    toastMessage,
    notify: (msg) => notify(msg),
    setView: (view) => dispatch({ type: 'SET_VIEW', view }),
    setAlertsSubTab: (tab) => dispatch({ type: 'SET_ALERTS_SUBTAB', tab }),
    openRoom: (roomId) => dispatch({ type: 'OPEN_ROOM', roomId }),
    reviewBatch: (batchId) => dispatch({ type: 'REVIEW_BATCH', batchId }),
    editCropRules: (crop) => dispatch({ type: 'EDIT_CROP_RULES', crop }),
    setTheme: (theme) => {
      const snapshot = state;
      dispatch({ type: 'SET_THEME', theme });
      persistProfilePrefs(snapshot, { theme });
    },
    toggleTheme: () => {
      const snapshot = state;
      const nextTheme = state.theme === 'light' ? 'dark' : 'light';
      dispatch({ type: 'TOGGLE_THEME' });
      persistProfilePrefs(snapshot, { theme: nextTheme });
    },
    setLanguage: (language) => {
      const snapshot = state;
      dispatch({ type: 'SET_LANGUAGE', language });
      notify(
        language === 'fil' ? 'Wika: Filipino (FIL)' : 'Language: English (EN)'
      );
      persistProfilePrefs(snapshot, { language });
    },
    toggleAutoRefresh: () => dispatch({ type: 'TOGGLE_AUTO_REFRESH' }),

    signInWithGoogle: async () => {
      try {
        await signInWithPopup(firebaseAuth, googleAuthProvider);
        const payload = await fetchCloudWorkspace();
        dispatch({ type: 'HYDRATE_REMOTE', mode: 'cloudsql', payload });
        notify(`Signed in as ${payload.profile.fullName}`);
        return {};
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Unable to complete Google sign-in.';
        return { error: message };
      }
    },

    signIn: async (email, password) => {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error || !data.user) {
          return { error: error?.message ?? 'Invalid email or password.' };
        }
        try {
          let payload = await fetchFacilityState(data.user.id);
          if (!payload) {
            const meta = data.user.user_metadata as
              | Record<string, unknown>
              | undefined;
            const profile: UserProfile = {
              fullName:
                typeof meta?.full_name === 'string' && meta.full_name.trim()
                  ? meta.full_name.trim()
                  : DEFAULT_USER_PROFILE.fullName,
              email: data.user.email ?? email.trim(),
              cooperativeName:
                typeof meta?.cooperative_name === 'string' &&
                meta.cooperative_name.trim()
                  ? meta.cooperative_name.trim()
                  : DEFAULT_USER_PROFILE.cooperativeName,
              role: toUserRole(meta?.role),
            };
            await ensureUserProfile(data.user.id, profile, {
              language: state.language,
              theme: state.theme,
              glass: state.glass,
              notifications: state.notifications,
            });
            payload = await fetchFacilityState(data.user.id);
          }
          if (!payload) {
            return { error: 'Unable to load facility workspace.' };
          }
          dispatch({ type: 'HYDRATE_REMOTE', mode: 'supabase', payload });
          notify('Signed in');
          return {};
        } catch (err) {
          return {
            error:
              err instanceof Error
                ? err.message
                : 'Failed to load facility workspace.',
          };
        }
      }

      dispatch({ type: 'SIGN_IN', email });
      notify('Signed in');
      return {};
    },

    signUp: async (profile, password) => {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.auth.signUp({
          email: profile.email.trim(),
          password,
          options: {
            data: {
              full_name: profile.fullName.trim(),
              cooperative_name: profile.cooperativeName.trim(),
              role: profile.role,
            },
          },
        });
        if (error) {
          return { error: error.message };
        }
        if (!data.user) {
          return { error: 'Account registration did not return a user.' };
        }
        if (!data.session) {
          return {
            error:
              'Account created. Verify your email address, then sign in.',
          };
        }
        try {
          await ensureUserProfile(data.user.id, profile, {
            language: state.language,
            theme: state.theme,
            glass: state.glass,
            notifications: state.notifications,
          });
          const payload = await fetchFacilityState(data.user.id);
          if (!payload) {
            return { error: 'Account created, but workspace sync failed.' };
          }
          dispatch({ type: 'HYDRATE_REMOTE', mode: 'supabase', payload });
          notify(`Workspace ready: ${profile.cooperativeName.trim()}`);
          return {};
        } catch (err) {
          return {
            error:
              err instanceof Error
                ? err.message
                : 'Failed to initialize cooperative workspace.',
          };
        }
      }

      dispatch({ type: 'SIGN_UP', profile });
      notify(`Workspace ready: ${profile.cooperativeName.trim()}`);
      return {};
    },

    demoLogin: () => {
      dispatch({ type: 'DEMO_LOGIN' });
      notify('Signed in as Demo Manager');
    },

    signOut: () => {
      const prevMode = state.auth.mode;
      dispatch({ type: 'SIGN_OUT' });
      notify('Signed out');
      if (prevMode === 'cloudsql') {
        void firebaseSignOut(firebaseAuth);
      } else if (prevMode === 'supabase' && isSupabaseConfigured && supabase) {
        void supabase.auth.signOut();
      }
    },

    updateAccount: (profile, newPassword) => {
      const snapshot = state;
      dispatch({ type: 'UPDATE_ACCOUNT', profile });
      notify('Account settings saved');
      if (isCloudSqlActive) {
        runWithRollback(
          snapshot,
          () =>
            patchCloudProfile({
              fullName: profile.fullName.trim(),
              email: profile.email.trim(),
              cooperativeName: profile.cooperativeName.trim(),
              role: profile.role,
            }),
          'Account sync failed'
        );
        return;
      }
      if (isSupabaseActive && state.auth.userId && supabase) {
        const userId = state.auth.userId;
        const client = supabase;
        runWithRollback(
          snapshot,
          async () => {
            await updateUserProfileRecord(userId, {
              full_name: profile.fullName.trim(),
              email: profile.email.trim(),
              cooperative_name: profile.cooperativeName.trim(),
              role: profile.role,
            });
            if (newPassword && newPassword.trim().length >= 6) {
              const { error } = await client.auth.updateUser({
                password: newPassword.trim(),
              });
              if (error) throw new Error(error.message);
            }
          },
          'Account sync failed'
        );
      }
    },

    updateNotifications: (patch) => {
      const snapshot = state;
      const nextNotifications = { ...state.notifications, ...patch };
      dispatch({ type: 'UPDATE_NOTIFICATIONS', patch });
      if (patch.audibleChime) {
        playNotificationChime('info');
      }
      persistProfilePrefs(snapshot, { notifications: nextNotifications });
    },

    updateGlass: (patch) => {
      const snapshot = state;
      const nextGlass = { ...state.glass, ...patch };
      dispatch({ type: 'UPDATE_GLASS', patch });
      persistProfilePrefs(snapshot, { glass: nextGlass });
    },

    resetGlass: () => {
      const snapshot = state;
      dispatch({ type: 'RESET_GLASS' });
      notify('Optical glass reset to iOS Default');
      persistProfilePrefs(snapshot, { glass: { ...DEFAULT_GLASS_SETTINGS } });
    },

    acknowledgeAlert: (alertId) => {
      const snapshot = state;
      dispatch({ type: 'ACKNOWLEDGE_ALERT', alertId });
      notify('Alert acknowledged', 'info');
      if (isCloudSqlActive) {
        runWithRollback(
          snapshot,
          () => patchCloudAlertAcknowledge(alertId),
          'Alert sync failed'
        );
        return;
      }
      if (isSupabaseActive && state.auth.cooperativeId) {
        const coopId = state.auth.cooperativeId;
        runWithRollback(
          snapshot,
          () => acknowledgeAlertRecord(alertId, coopId),
          'Alert sync failed'
        );
      }
    },

    saveCropRule: (rule) => {
      const snapshot = state;
      dispatch({ type: 'SAVE_CROP_RULE', rule });
      notify(`Saved ${rule.crop} thresholds`, 'alert');
      if (isCloudSqlActive) {
        runWithRollback(
          snapshot,
          () => putCloudCropRule(rule),
          'Threshold sync failed'
        );
        return;
      }
      if (isSupabaseActive && state.auth.cooperativeId) {
        const coopId = state.auth.cooperativeId;
        runWithRollback(
          snapshot,
          () => updateRoomThresholds(coopId, rule),
          'Threshold sync failed'
        );
      }
    },

    resetCropRule: (crop) => {
      const snapshot = state;
      const defaultRule = DEFAULT_CROP_RULES[crop];
      dispatch({ type: 'RESET_CROP_RULE', crop });
      notify(`Reset ${crop} to source values`);
      if (isCloudSqlActive) {
        runWithRollback(
          snapshot,
          () => putCloudCropRule(defaultRule),
          'Threshold reset failed'
        );
        return;
      }
      if (isSupabaseActive && state.auth.cooperativeId) {
        const coopId = state.auth.cooperativeId;
        runWithRollback(
          snapshot,
          () => updateRoomThresholds(coopId, defaultRule),
          'Threshold reset failed'
        );
      }
    },

    releaseBatch: (batchId, releaseQtyKg, note) => {
      const snapshot = state;
      const target = state.batches.find((b) => b.id === batchId);
      dispatch({ type: 'RELEASE_BATCH', batchId, releaseQtyKg, note });
      notify(`Released ${releaseQtyKg} kg from ${batchId}`, 'info');
      if (target) {
        const remaining = target.qtyKg - releaseQtyKg;
        const fullyReleased = remaining <= 0;
        const persistedQty = fullyReleased ? target.qtyKg : remaining;
        if (isCloudSqlActive) {
          runWithRollback(
            snapshot,
            () =>
              patchCloudBatch(batchId, {
                quantityKg: persistedQty,
                status: fullyReleased ? 'released' : 'active',
                releaseNote: note?.trim() || null,
              }),
            'Release sync failed'
          );
          return;
        }
        if (isSupabaseActive && state.auth.cooperativeId) {
          const coopId = state.auth.cooperativeId;
          runWithRollback(
            snapshot,
            () =>
              releaseBatchRecord(
                batchId,
                coopId,
                persistedQty,
                fullyReleased,
                note
              ),
            'Release sync failed'
          );
        }
      }
    },

    toggleBatchHold: (batchId) => {
      const snapshot = state;
      const target = state.batches.find((b) => b.id === batchId);
      dispatch({ type: 'TOGGLE_BATCH_HOLD', batchId });
      notify(`Updated hold status for ${batchId}`);
      if (target) {
        const nextStatus = target.manualHold ? 'active' : 'hold';
        if (isCloudSqlActive) {
          runWithRollback(
            snapshot,
            () => patchCloudBatch(batchId, { status: nextStatus }),
            'Batch hold sync failed'
          );
          return;
        }
        if (isSupabaseActive && state.auth.cooperativeId) {
          const coopId = state.auth.cooperativeId;
          runWithRollback(
            snapshot,
            () => updateBatchStatusRecord(batchId, coopId, nextStatus),
            'Batch hold sync failed'
          );
        }
      }
    },

    restoreBatch: (batchId) => {
      const snapshot = state;
      dispatch({ type: 'RESTORE_BATCH', batchId });
      notify(`Restored ${batchId} to active inventory`);
      if (isCloudSqlActive) {
        runWithRollback(
          snapshot,
          () => patchCloudBatch(batchId, { status: 'active' }),
          'Batch restore failed'
        );
        return;
      }
      if (isSupabaseActive && state.auth.cooperativeId) {
        const coopId = state.auth.cooperativeId;
        runWithRollback(
          snapshot,
          () => updateBatchStatusRecord(batchId, coopId, 'active'),
          'Batch restore failed'
        );
      }
    },

    addBatch: (batch) => {
      const snapshot = state;
      const useCoopPrefix = isCloudSqlActive || isSupabaseActive;
      const nextId = computeNextBatchId(
        state.batches,
        state.auth.cooperativeId,
        useCoopPrefix
      );
      const created: InventoryBatch = {
        ...batch,
        id: nextId,
        manualHold: false,
        released: false,
      };
      dispatch({ type: 'ADD_BATCH', id: nextId, batch });
      notify(`Added ${batch.crop} batch (${batch.qtyKg} kg)`, 'info');
      if (isCloudSqlActive) {
        runWithRollback(
          snapshot,
          () => postCloudBatch(created),
          'Batch insert failed'
        );
        return;
      }
      if (isSupabaseActive && state.auth.cooperativeId) {
        const coopId = state.auth.cooperativeId;
        runWithRollback(
          snapshot,
          () => createBatchRecord(coopId, created),
          'Batch insert failed'
        );
      }
    },

    setCompressorMode: (roomId, mode) => {
      const snapshot = state;
      dispatch({ type: 'SET_COMPRESSOR_MODE', roomId, mode });
      notify(`Compressor set to ${mode.toUpperCase()}`);
      if (isCloudSqlActive) {
        runWithRollback(
          snapshot,
          () => patchCloudRoom(roomId, { equipmentMode: mode }),
          'Compressor sync failed'
        );
        return;
      }
      if (isSupabaseActive && state.auth.cooperativeId) {
        const coopId = state.auth.cooperativeId;
        runWithRollback(
          snapshot,
          () => updateRoomControls(roomId, coopId, { equipment_mode: mode }),
          'Compressor sync failed'
        );
      }
    },

    toggleDefrost: (roomId) => {
      const snapshot = state;
      const room = state.rooms.find((r) => r.id === roomId);
      dispatch({ type: 'TOGGLE_DEFROST', roomId });
      notify('Toggled defrost cycle');
      if (room) {
        const nextDefrost = !room.defrostActive;
        if (isCloudSqlActive) {
          runWithRollback(
            snapshot,
            () => patchCloudRoom(roomId, { defrostActive: nextDefrost }),
            'Defrost sync failed'
          );
          return;
        }
        if (isSupabaseActive && state.auth.cooperativeId) {
          const coopId = state.auth.cooperativeId;
          runWithRollback(
            snapshot,
            () =>
              updateRoomControls(roomId, coopId, {
                defrost_active: nextDefrost,
              }),
            'Defrost sync failed'
          );
        }
      }
    },

    toggleSensorOnline: (roomId) => {
      const snapshot = state;
      const room = state.rooms.find((r) => r.id === roomId);
      dispatch({ type: 'TOGGLE_SENSOR_ONLINE', roomId });
      notify('Updated room sensor link', 'alert');
      if (room) {
        const nextOnline = !room.online;
        if (isCloudSqlActive) {
          runWithRollback(
            snapshot,
            () => patchCloudRoom(roomId, { sensorOnline: nextOnline }),
            'Sensor link sync failed'
          );
          return;
        }
        if (isSupabaseActive && state.auth.cooperativeId) {
          const coopId = state.auth.cooperativeId;
          runWithRollback(
            snapshot,
            () =>
              updateRoomControls(roomId, coopId, { sensor_online: nextOnline }),
            'Sensor link sync failed'
          );
        }
      }
    },

    updateSimulator: (patch) => dispatch({ type: 'UPDATE_SIMULATOR', patch }),

    runScenario: () => {
      const snapshot = state;
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
      dispatch({ type: 'RUN_SCENARIO' });
      notify('Scenario applied across rooms', 'alert');
      if (isCloudSqlActive) {
        runWithRollback(
          snapshot,
          () => postCloudSimulatorRooms(nextRooms),
          'Scenario sync failed'
        );
        return;
      }
      if (isSupabaseActive && state.auth.cooperativeId) {
        const coopId = state.auth.cooperativeId;
        runWithRollback(
          snapshot,
          async () => {
            await Promise.all(
              nextRooms.map((r) =>
                updateRoomControls(r.id, coopId, {
                  temp_c: r.tempC,
                  humidity_pct: r.humidityPct,
                  co2_ppm: r.co2Ppm,
                  gas_index: r.gasIndex,
                  sensor_online: r.online,
                })
              )
            );
          },
          'Scenario sync failed'
        );
      }
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
