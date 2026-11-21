import {
  DEFAULT_CROP_RULES,
  DEFAULT_GLASS_SETTINGS,
  DEFAULT_NOTIFICATION_SETTINGS,
  INITIAL_ALERTS,
  INITIAL_BATCHES,
  INITIAL_ROOMS,
} from '../data/seedData';
import {
  isSupabaseConfigured,
  slugifyCooperativeId,
  supabase,
  type AlertRow,
  type BatchRow,
  type ProfileRow,
  type StorageRoomRow,
  type ThemePrefsJson,
} from '../lib/supabase';
import type {
  AlertItem,
  CompressorMode,
  CropThresholdRule,
  CropType,
  GlassSettings,
  InventoryBatch,
  LanguageCode,
  NotificationSettings,
  StorageRoom,
  UserProfile,
} from '../types/postharvest';
import { formatTimeHHMM } from '../utils/postharvestEngine';

const VALID_CROPS: CropType[] = [
  'Strawberries',
  'Bell Peppers',
  'Highland Lettuce',
  'Carrots',
];

function toCropType(value: string): CropType {
  return (VALID_CROPS.find((c) => c === value) ?? 'Strawberries') as CropType;
}

function toMetric(
  typeStr: string
): 'temperature' | 'humidity' | 'co2' | 'gas' | 'sensor' {
  const lower = typeStr.toLowerCase();
  if (lower.includes('temp')) return 'temperature';
  if (lower.includes('hum')) return 'humidity';
  if (lower.includes('co2')) return 'co2';
  if (lower.includes('gas') || lower.includes('spoilage')) return 'gas';
  return 'sensor';
}

export function mapStorageRoomRow(
  row: StorageRoomRow,
  existing?: StorageRoom
): StorageRoom {
  const seedMatch = INITIAL_ROOMS.find(
    (r) => r.id === row.id || r.name === row.name
  );
  const crop = toCropType(row.crop);
  return {
    id: row.id,
    name: row.name,
    crop,
    online: Boolean(row.sensor_online),
    offlineSince: row.sensor_online
      ? undefined
      : existing?.offlineSince ?? formatTimeHHMM(new Date(row.updated_at)),
    tempC: Number(row.temp_c),
    humidityPct: Number(row.humidity_pct),
    co2Ppm: Number(row.co2_ppm),
    gasIndex: Number(row.gas_index),
    gasRising: Number(row.gas_index) >= Number(row.gas_index_max) * 0.85,
    breachDurationMin: existing?.breachDurationMin ?? seedMatch?.breachDurationMin ?? 0,
    compressorMode: row.equipment_mode,
    defrostActive: Boolean(row.defrost_active),
    doorClosed: existing?.doorClosed ?? true,
    racks: existing?.racks ?? seedMatch?.racks ?? INITIAL_ROOMS[0].racks,
    history24h:
      existing?.history24h ?? seedMatch?.history24h ?? INITIAL_ROOMS[0].history24h,
  };
}

export function mapBatchRow(row: BatchRow): InventoryBatch {
  return {
    id: row.id,
    crop: toCropType(row.crop),
    roomId: row.room_id,
    rackId: row.rack_id || 'R1',
    qtyKg: Number(row.quantity_kg),
    harvestedDate: row.created_at.slice(0, 10),
    shelfLifeDays: Number(row.shelf_life_days),
    shelfLifeLimitDays: Number(row.shelf_life_limit),
    currentPricePhp: Number(row.current_price_php),
    targetPricePhp: Number(row.target_price_php),
    manualHold: row.status === 'hold',
    released: row.status === 'released',
    releasedAt:
      row.status === 'released'
        ? formatTimeHHMM(new Date(row.created_at))
        : undefined,
    releaseNote: row.release_note ?? undefined,
  };
}

export function mapAlertRow(row: AlertRow, rooms: StorageRoom[]): AlertItem {
  const room = rooms.find((r) => r.id === row.room_id);
  return {
    id: row.id,
    roomId: row.room_id,
    roomName: room?.name ?? row.room_id,
    metric: toMetric(row.type),
    typeLabel: row.type,
    message: row.message,
    severity: row.severity,
    timestamp: formatTimeHHMM(new Date(row.created_at)),
    acknowledged: Boolean(row.acknowledged),
  };
}

export interface HydratedFacilityPayload {
  userId: string;
  cooperativeId: string;
  profile: UserProfile;
  language: LanguageCode;
  theme: 'light' | 'dark';
  glass: GlassSettings;
  notifications: NotificationSettings;
  rooms: StorageRoom[];
  rules: Record<CropType, CropThresholdRule>;
  batches: InventoryBatch[];
  alerts: AlertItem[];
}

export function extractRulesFromRooms(
  rows: StorageRoomRow[],
  baseRules: Record<CropType, CropThresholdRule> = DEFAULT_CROP_RULES
): Record<CropType, CropThresholdRule> {
  const next: Record<CropType, CropThresholdRule> = { ...baseRules };
  for (const row of rows) {
    const crop = toCropType(row.crop);
    next[crop] = {
      ...next[crop],
      crop,
      tempMin: Number(row.min_temp),
      tempMax: Number(row.max_temp),
      humidityMin: Number(row.min_humidity),
      humidityMax: Number(row.max_humidity),
      co2Max: Number(row.co2_max),
      gasIndexMax: Number(row.gas_index_max),
    };
  }
  return next;
}

export async function ensureUserProfile(
  userId: string,
  profile: UserProfile,
  prefs?: {
    language?: LanguageCode;
    theme?: 'light' | 'dark';
    glass?: GlassSettings;
    notifications?: NotificationSettings;
  }
): Promise<ProfileRow> {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error('Supabase is not configured.');
  }

  const cooperativeId = slugifyCooperativeId(profile.cooperativeName);
  const themePrefs: ThemePrefsJson = {
    theme: prefs?.theme ?? 'light',
    ...(prefs?.glass ?? DEFAULT_GLASS_SETTINGS),
  };

  const payload = {
    id: userId,
    cooperative_id: cooperativeId,
    full_name: profile.fullName.trim(),
    email: profile.email.trim(),
    cooperative_name: profile.cooperativeName.trim(),
    role: profile.role,
    language: prefs?.language ?? 'en',
    theme_prefs: themePrefs,
    notification_prefs: prefs?.notifications ?? DEFAULT_NOTIFICATION_SETTINGS,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('profiles')
    .upsert(payload, { onConflict: 'id' })
    .select()
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Unable to persist user profile.');
  }
  return data;
}

async function seedCooperativeIfEmpty(
  cooperativeId: string,
  cooperativeName: string
): Promise<{
  roomRows: StorageRoomRow[];
  batchRows: BatchRow[];
  alertRows: AlertRow[];
}> {
  if (!supabase) {
    return { roomRows: [], batchRows: [], alertRows: [] };
  }

  const roomInserts = INITIAL_ROOMS.map((room) => {
    const rule = DEFAULT_CROP_RULES[room.crop];
    return {
      id: `${cooperativeId}-${room.id}`,
      cooperative_id: cooperativeId,
      cooperative_name: cooperativeName,
      name: room.name,
      crop: room.crop,
      temp_c: room.tempC,
      humidity_pct: room.humidityPct,
      co2_ppm: room.co2Ppm,
      gas_index: room.gasIndex,
      min_temp: rule.tempMin,
      max_temp: rule.tempMax,
      min_humidity: rule.humidityMin,
      max_humidity: rule.humidityMax,
      co2_max: rule.co2Max,
      gas_index_max: rule.gasIndexMax,
      equipment_mode: room.compressorMode,
      defrost_active: room.defrostActive,
      sensor_online: room.online,
    };
  });

  const { data: insertedRooms, error: roomErr } = await supabase
    .from('storage_rooms')
    .upsert(roomInserts, { onConflict: 'id' })
    .select();

  if (roomErr || !insertedRooms) {
    throw new Error(roomErr?.message ?? 'Failed to initialize storage rooms.');
  }

  const batchInserts = INITIAL_BATCHES.map((batch) => ({
    id: `${cooperativeId}-${batch.id}`,
    cooperative_id: cooperativeId,
    room_id: `${cooperativeId}-${batch.roomId}`,
    rack_id: batch.rackId,
    crop: batch.crop,
    quantity_kg: batch.qtyKg,
    shelf_life_days: batch.shelfLifeDays,
    shelf_life_limit: batch.shelfLifeLimitDays,
    current_price_php: batch.currentPricePhp,
    target_price_php: batch.targetPricePhp,
    status: (batch.released
      ? 'released'
      : batch.manualHold
        ? 'hold'
        : 'active') as 'active' | 'hold' | 'released',
    release_note: batch.releaseNote ?? null,
  }));

  const { data: insertedBatches, error: batchErr } = await supabase
    .from('batches')
    .upsert(batchInserts, { onConflict: 'id' })
    .select();

  if (batchErr || !insertedBatches) {
    throw new Error(batchErr?.message ?? 'Failed to initialize batches.');
  }

  const alertInserts = INITIAL_ALERTS.map((alert) => ({
    cooperative_id: cooperativeId,
    room_id: `${cooperativeId}-${alert.roomId}`,
    type: alert.typeLabel,
    severity: alert.severity,
    message: alert.message,
    acknowledged: alert.acknowledged,
  }));

  const { data: insertedAlerts, error: alertErr } = await supabase
    .from('alerts')
    .insert(alertInserts)
    .select();

  if (alertErr || !insertedAlerts) {
    throw new Error(alertErr?.message ?? 'Failed to initialize alerts.');
  }

  return {
    roomRows: insertedRooms,
    batchRows: insertedBatches,
    alertRows: insertedAlerts,
  };
}

export async function fetchFacilityState(
  userId: string
): Promise<HydratedFacilityPayload | null> {
  if (!supabase || !isSupabaseConfigured) return null;

  const { data: profileRow, error: profileErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (profileErr) {
    throw new Error(profileErr.message);
  }
  if (!profileRow) return null;

  const coopId = profileRow.cooperative_id;

  const [roomsRes, batchesRes, alertsRes] = await Promise.all([
    supabase
      .from('storage_rooms')
      .select('*')
      .eq('cooperative_id', coopId)
      .order('name', { ascending: true }),
    supabase
      .from('batches')
      .select('*')
      .eq('cooperative_id', coopId)
      .order('created_at', { ascending: true }),
    supabase
      .from('alerts')
      .select('*')
      .eq('cooperative_id', coopId)
      .order('created_at', { ascending: false }),
  ]);

  if (roomsRes.error) throw new Error(roomsRes.error.message);
  if (batchesRes.error) throw new Error(batchesRes.error.message);
  if (alertsRes.error) throw new Error(alertsRes.error.message);

  let roomRows = roomsRes.data ?? [];
  let batchRows = batchesRes.data ?? [];
  let alertRows = alertsRes.data ?? [];

  if (roomRows.length === 0) {
    const seeded = await seedCooperativeIfEmpty(
      coopId,
      profileRow.cooperative_name
    );
    roomRows = seeded.roomRows;
    batchRows = seeded.batchRows;
    alertRows = seeded.alertRows;
  }

  const rooms = roomRows.map((row) => mapStorageRoomRow(row));
  const rules = extractRulesFromRooms(roomRows);
  const batches = batchRows.map((row) => mapBatchRow(row));
  const alerts = alertRows.map((row) => mapAlertRow(row, rooms));

  const themePrefs = profileRow.theme_prefs;
  const glass: GlassSettings = {
    blurPx: Number(themePrefs?.blurPx ?? DEFAULT_GLASS_SETTINGS.blurPx),
    frostPct: Number(themePrefs?.frostPct ?? DEFAULT_GLASS_SETTINGS.frostPct),
    depthScale: Number(
      themePrefs?.depthScale ?? DEFAULT_GLASS_SETTINGS.depthScale
    ),
    dispersionPct: Number(
      themePrefs?.dispersionPct ?? DEFAULT_GLASS_SETTINGS.dispersionPct
    ),
  };

  return {
    userId: profileRow.id,
    cooperativeId: coopId,
    profile: {
      fullName: profileRow.full_name,
      email: profileRow.email,
      cooperativeName: profileRow.cooperative_name,
      role: profileRow.role,
    },
    language: profileRow.language === 'fil' ? 'fil' : 'en',
    theme: themePrefs?.theme === 'dark' ? 'dark' : 'light',
    glass,
    notifications: {
      ...DEFAULT_NOTIFICATION_SETTINGS,
      ...(profileRow.notification_prefs ?? {}),
    },
    rooms,
    rules,
    batches,
    alerts,
  };
}

export async function updateRoomControls(
  roomId: string,
  cooperativeId: string,
  patch: Partial<{
    equipment_mode: CompressorMode;
    defrost_active: boolean;
    sensor_online: boolean;
    temp_c: number;
    humidity_pct: number;
    co2_ppm: number;
    gas_index: number;
  }>
): Promise<void> {
  if (!supabase || !isSupabaseConfigured) return;
  const { error } = await supabase
    .from('storage_rooms')
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq('id', roomId)
    .eq('cooperative_id', cooperativeId);

  if (error) throw new Error(error.message);
}

export async function updateRoomThresholds(
  cooperativeId: string,
  rule: CropThresholdRule
): Promise<void> {
  if (!supabase || !isSupabaseConfigured) return;
  const { error } = await supabase
    .from('storage_rooms')
    .update({
      min_temp: rule.tempMin,
      max_temp: rule.tempMax,
      min_humidity: rule.humidityMin,
      max_humidity: rule.humidityMax,
      co2_max: rule.co2Max,
      gas_index_max: rule.gasIndexMax,
      updated_at: new Date().toISOString(),
    })
    .eq('cooperative_id', cooperativeId)
    .eq('crop', rule.crop);

  if (error) throw new Error(error.message);
}

export async function createBatchRecord(
  cooperativeId: string,
  batch: InventoryBatch
): Promise<void> {
  if (!supabase || !isSupabaseConfigured) return;
  const { error } = await supabase.from('batches').insert({
    id: batch.id,
    cooperative_id: cooperativeId,
    room_id: batch.roomId,
    rack_id: batch.rackId,
    crop: batch.crop,
    quantity_kg: batch.qtyKg,
    shelf_life_days: batch.shelfLifeDays,
    shelf_life_limit: batch.shelfLifeLimitDays,
    current_price_php: batch.currentPricePhp,
    target_price_php: batch.targetPricePhp,
    status: batch.released ? 'released' : batch.manualHold ? 'hold' : 'active',
    release_note: batch.releaseNote ?? null,
  });

  if (error) throw new Error(error.message);
}

export async function releaseBatchRecord(
  batchId: string,
  cooperativeId: string,
  remainingQtyKg: number,
  fullyReleased: boolean,
  note?: string
): Promise<void> {
  if (!supabase || !isSupabaseConfigured) return;
  const { error } = await supabase
    .from('batches')
    .update({
      quantity_kg: remainingQtyKg,
      status: fullyReleased ? 'released' : 'active',
      release_note: note?.trim() || null,
    })
    .eq('id', batchId)
    .eq('cooperative_id', cooperativeId);

  if (error) throw new Error(error.message);
}

export async function updateBatchStatusRecord(
  batchId: string,
  cooperativeId: string,
  status: 'active' | 'hold' | 'released'
): Promise<void> {
  if (!supabase || !isSupabaseConfigured) return;
  const { error } = await supabase
    .from('batches')
    .update({ status })
    .eq('id', batchId)
    .eq('cooperative_id', cooperativeId);

  if (error) throw new Error(error.message);
}

export async function acknowledgeAlertRecord(
  alertId: string,
  cooperativeId: string
): Promise<void> {
  if (!supabase || !isSupabaseConfigured) return;
  const { error } = await supabase
    .from('alerts')
    .update({ acknowledged: true })
    .eq('id', alertId)
    .eq('cooperative_id', cooperativeId);

  if (error) throw new Error(error.message);
}

export async function updateUserProfileRecord(
  userId: string,
  patch: Partial<{
    full_name: string;
    email: string;
    cooperative_name: string;
    role: UserProfile['role'];
    language: LanguageCode;
    theme_prefs: ThemePrefsJson;
    notification_prefs: NotificationSettings;
  }>
): Promise<void> {
  if (!supabase || !isSupabaseConfigured) return;
  const { error } = await supabase
    .from('profiles')
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) throw new Error(error.message);
}

export interface RealtimeSyncHandlers {
  onRoomChange: (row: StorageRoomRow) => void;
  onBatchChange: (eventType: 'INSERT' | 'UPDATE' | 'DELETE', row: BatchRow) => void;
  onAlertChange: (eventType: 'INSERT' | 'UPDATE' | 'DELETE', row: AlertRow) => void;
}

export function subscribeFacilityRealtime(
  cooperativeId: string,
  handlers: RealtimeSyncHandlers
): () => void {
  if (!supabase || !isSupabaseConfigured) {
    return () => {};
  }

  const client = supabase;
  const channel = client
    .channel(`facility-${cooperativeId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'storage_rooms',
        filter: `cooperative_id=eq.${cooperativeId}`,
      },
      (payload) => {
        if (payload.new && typeof payload.new === 'object' && 'id' in payload.new) {
          handlers.onRoomChange(payload.new as StorageRoomRow);
        }
      }
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'batches',
        filter: `cooperative_id=eq.${cooperativeId}`,
      },
      (payload) => {
        const row = (payload.eventType === 'DELETE'
          ? payload.old
          : payload.new) as BatchRow | null;
        if (row && typeof row === 'object' && 'id' in row) {
          handlers.onBatchChange(
            payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
            row
          );
        }
      }
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'alerts',
        filter: `cooperative_id=eq.${cooperativeId}`,
      },
      (payload) => {
        const row = (payload.eventType === 'DELETE'
          ? payload.old
          : payload.new) as AlertRow | null;
        if (row && typeof row === 'object' && 'id' in row) {
          handlers.onAlertChange(
            payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
            row
          );
        }
      }
    )
    .subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}
