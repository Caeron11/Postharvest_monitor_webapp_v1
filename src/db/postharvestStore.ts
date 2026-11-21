import { and, asc, desc, eq } from 'drizzle-orm';
import {
  DEFAULT_CROP_RULES,
  DEFAULT_GLASS_SETTINGS,
  DEFAULT_NOTIFICATION_SETTINGS,
  DEFAULT_USER_PROFILE,
  INITIAL_ALERTS,
  INITIAL_BATCHES,
  INITIAL_ROOMS,
} from '../data/seedData.ts';
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
  UserRole,
} from '../types/postharvest.ts';
import { formatTimeHHMM } from '../utils/postharvestEngine.ts';
import { db } from './index.ts';
import {
  alerts,
  batches,
  profiles,
  storageRooms,
  type ProfileNotificationPrefs,
  type ProfileThemePrefs,
} from './schema.ts';

const VALID_CROPS: CropType[] = [
  'Strawberries',
  'Bell Peppers',
  'Highland Lettuce',
  'Carrots',
];

const VALID_ROLES: UserRole[] = [
  'Facility Manager',
  'Cold-Chain Operator',
  'Quality Inspector',
];

function toCropType(value: string): CropType {
  return (VALID_CROPS.find((c) => c === value) ?? 'Strawberries') as CropType;
}

function toUserRole(value: string): UserRole {
  return (VALID_ROLES.find((r) => r === value) ?? DEFAULT_USER_PROFILE.role) as UserRole;
}

function toCompressorMode(value: string): CompressorMode {
  if (value === 'boost' || value === 'standby') return value;
  return 'auto';
}

function toSeverity(value: string): 'critical' | 'warning' | 'no_data' {
  if (value === 'critical' || value === 'no_data') return value;
  return 'warning';
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

function buildCooperativeId(uid: string): string {
  const cleanUid = uid.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12);
  return `coop-${cleanUid || 'default'}`;
}

function mapRoomRecord(row: typeof storageRooms.$inferSelect): StorageRoom {
  const seedMatch = INITIAL_ROOMS.find(
    (r) => r.id === row.id || r.name === row.name
  );
  const crop = toCropType(row.crop);
  return {
    id: row.id,
    name: row.name,
    crop,
    online: Boolean(row.sensorOnline),
    offlineSince: row.sensorOnline
      ? undefined
      : formatTimeHHMM(row.updatedAt ?? new Date()),
    tempC: Number(row.tempC),
    humidityPct: Number(row.humidityPct),
    co2Ppm: Number(row.co2Ppm),
    gasIndex: Number(row.gasIndex),
    gasRising: Number(row.gasIndex) >= Number(row.gasIndexMax) * 0.85,
    breachDurationMin: seedMatch?.breachDurationMin ?? 0,
    compressorMode: toCompressorMode(row.equipmentMode),
    defrostActive: Boolean(row.defrostActive),
    doorClosed: true,
    racks: seedMatch?.racks ?? INITIAL_ROOMS[0].racks,
    history24h: seedMatch?.history24h ?? INITIAL_ROOMS[0].history24h,
  };
}

function mapBatchRecord(row: typeof batches.$inferSelect): InventoryBatch {
  const createdIso = (row.createdAt ?? new Date()).toISOString();
  return {
    id: row.id,
    crop: toCropType(row.crop),
    roomId: row.roomId,
    rackId: row.rackId || 'R1',
    qtyKg: Number(row.quantityKg),
    harvestedDate: createdIso.slice(0, 10),
    shelfLifeDays: Number(row.shelfLifeDays),
    shelfLifeLimitDays: Number(row.shelfLifeLimit),
    currentPricePhp: Number(row.currentPricePhp),
    targetPricePhp: Number(row.targetPricePhp),
    manualHold: row.status === 'hold',
    released: row.status === 'released',
    releasedAt:
      row.status === 'released'
        ? formatTimeHHMM(row.createdAt ?? new Date())
        : undefined,
    releaseNote: row.releaseNote ?? undefined,
  };
}

function mapAlertRecord(
  row: typeof alerts.$inferSelect,
  rooms: StorageRoom[]
): AlertItem {
  const room = rooms.find((r) => r.id === row.roomId);
  return {
    id: row.id,
    roomId: row.roomId,
    roomName: room?.name ?? row.roomId,
    metric: toMetric(row.type),
    typeLabel: row.type,
    message: row.message,
    severity: toSeverity(row.severity),
    timestamp: formatTimeHHMM(row.createdAt ?? new Date()),
    acknowledged: Boolean(row.acknowledged),
  };
}

function extractCropRules(
  roomRows: Array<typeof storageRooms.$inferSelect>
): Record<CropType, CropThresholdRule> {
  const next: Record<CropType, CropThresholdRule> = { ...DEFAULT_CROP_RULES };
  for (const row of roomRows) {
    const crop = toCropType(row.crop);
    next[crop] = {
      ...next[crop],
      crop,
      tempMin: Number(row.minTemp),
      tempMax: Number(row.maxTemp),
      humidityMin: Number(row.minHumidity),
      humidityMax: Number(row.maxHumidity),
      co2Max: Number(row.co2Max),
      gasIndexMax: Number(row.gasIndexMax),
    };
  }
  return next;
}

export interface CloudWorkspacePayload {
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

export async function getOrCreateProfile(
  uid: string,
  email: string,
  displayName?: string
): Promise<typeof profiles.$inferSelect> {
  try {
    const cooperativeId = buildCooperativeId(uid);
    const fallbackName =
      displayName && displayName.trim().length >= 2
        ? displayName.trim()
        : email.split('@')[0] || DEFAULT_USER_PROFILE.fullName;

    const inserted = await db
      .insert(profiles)
      .values({
        uid,
        cooperativeId,
        fullName: fallbackName,
        email: email.trim() || DEFAULT_USER_PROFILE.email,
        cooperativeName: DEFAULT_USER_PROFILE.cooperativeName,
        role: DEFAULT_USER_PROFILE.role,
        language: 'en',
        themePrefs: {
          theme: 'light',
          ...DEFAULT_GLASS_SETTINGS,
        },
        notificationPrefs: { ...DEFAULT_NOTIFICATION_SETTINGS },
      })
      .onConflictDoUpdate({
        target: profiles.uid,
        set: {
          email: email.trim() || DEFAULT_USER_PROFILE.email,
          updatedAt: new Date(),
        },
      })
      .returning();

    return inserted[0];
  } catch (error) {
    console.error('Failed to upsert user profile:', error);
    throw new Error('Unable to synchronize user profile.', { cause: error });
  }
}

async function seedCooperativeDefaults(
  cooperativeId: string,
  cooperativeName: string
): Promise<void> {
  const roomRows = INITIAL_ROOMS.map((room) => {
    const rule = DEFAULT_CROP_RULES[room.crop];
    return {
      id: `${cooperativeId}-${room.id}`,
      cooperativeId,
      cooperativeName,
      name: room.name,
      crop: room.crop,
      tempC: room.tempC,
      humidityPct: room.humidityPct,
      co2Ppm: room.co2Ppm,
      gasIndex: room.gasIndex,
      minTemp: rule.tempMin,
      maxTemp: rule.tempMax,
      minHumidity: rule.humidityMin,
      maxHumidity: rule.humidityMax,
      co2Max: rule.co2Max,
      gasIndexMax: rule.gasIndexMax,
      equipmentMode: room.compressorMode,
      defrostActive: room.defrostActive,
      sensorOnline: room.online,
    };
  });

  await db.insert(storageRooms).values(roomRows).onConflictDoNothing();

  const batchRows = INITIAL_BATCHES.map((batch) => ({
    id: `${cooperativeId}-${batch.id}`,
    cooperativeId,
    roomId: `${cooperativeId}-${batch.roomId}`,
    rackId: batch.rackId,
    crop: batch.crop,
    quantityKg: batch.qtyKg,
    shelfLifeDays: batch.shelfLifeDays,
    shelfLifeLimit: batch.shelfLifeLimitDays,
    currentPricePhp: batch.currentPricePhp,
    targetPricePhp: batch.targetPricePhp,
    status: batch.released ? 'released' : batch.manualHold ? 'hold' : 'active',
    releaseNote: batch.releaseNote ?? null,
  }));

  await db.insert(batches).values(batchRows).onConflictDoNothing();

  const alertRows = INITIAL_ALERTS.map((alert) => ({
    id: `${cooperativeId}-${alert.id}`,
    cooperativeId,
    roomId: `${cooperativeId}-${alert.roomId}`,
    type: alert.typeLabel,
    severity: alert.severity,
    message: alert.message,
    acknowledged: alert.acknowledged,
  }));

  await db.insert(alerts).values(alertRows).onConflictDoNothing();
}

export async function fetchCooperativeWorkspace(
  uid: string,
  email: string,
  displayName?: string
): Promise<CloudWorkspacePayload> {
  try {
    const profileRow = await getOrCreateProfile(uid, email, displayName);
    const coopId = profileRow.cooperativeId;

    let roomRows = await db
      .select()
      .from(storageRooms)
      .where(eq(storageRooms.cooperativeId, coopId))
      .orderBy(asc(storageRooms.name));

    if (roomRows.length === 0) {
      await seedCooperativeDefaults(coopId, profileRow.cooperativeName);
      roomRows = await db
        .select()
        .from(storageRooms)
        .where(eq(storageRooms.cooperativeId, coopId))
        .orderBy(asc(storageRooms.name));
    }

    const [batchRows, alertRows] = await Promise.all([
      db
        .select()
        .from(batches)
        .where(eq(batches.cooperativeId, coopId))
        .orderBy(desc(batches.createdAt)),
      db
        .select()
        .from(alerts)
        .where(eq(alerts.cooperativeId, coopId))
        .orderBy(desc(alerts.createdAt)),
    ]);

    const rooms = roomRows.map(mapRoomRecord);
    const rules = extractCropRules(roomRows);
    const mappedBatches = batchRows.map(mapBatchRecord);
    const mappedAlerts = alertRows.map((row) => mapAlertRecord(row, rooms));

    const themePrefs = profileRow.themePrefs;
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
      userId: profileRow.uid,
      cooperativeId: coopId,
      profile: {
        fullName: profileRow.fullName,
        email: profileRow.email,
        cooperativeName: profileRow.cooperativeName,
        role: toUserRole(profileRow.role),
      },
      language: profileRow.language === 'fil' ? 'fil' : 'en',
      theme: themePrefs?.theme === 'dark' ? 'dark' : 'light',
      glass,
      notifications: {
        ...DEFAULT_NOTIFICATION_SETTINGS,
        ...(profileRow.notificationPrefs ?? {}),
      },
      rooms,
      rules,
      batches: mappedBatches,
      alerts: mappedAlerts,
    };
  } catch (error) {
    console.error('Failed to fetch cooperative workspace:', error);
    throw new Error('Unable to load facility data.', { cause: error });
  }
}

export async function updateProfileRecord(
  uid: string,
  patch: Partial<{
    fullName: string;
    email: string;
    cooperativeName: string;
    role: UserRole;
    language: LanguageCode;
    themePrefs: ProfileThemePrefs;
    notificationPrefs: ProfileNotificationPrefs;
  }>
): Promise<void> {
  try {
    await db
      .update(profiles)
      .set({
        ...patch,
        updatedAt: new Date(),
      })
      .where(eq(profiles.uid, uid));
  } catch (error) {
    console.error('Failed to update user profile:', error);
    throw new Error('Unable to save profile preferences.', { cause: error });
  }
}

export async function updateRoomForCoop(
  cooperativeId: string,
  roomId: string,
  patch: Partial<{
    equipmentMode: CompressorMode;
    defrostActive: boolean;
    sensorOnline: boolean;
    tempC: number;
    humidityPct: number;
    co2Ppm: number;
    gasIndex: number;
  }>
): Promise<void> {
  try {
    await db
      .update(storageRooms)
      .set({
        ...patch,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(storageRooms.id, roomId),
          eq(storageRooms.cooperativeId, cooperativeId)
        )
      );
  } catch (error) {
    console.error('Failed to update storage room:', error);
    throw new Error('Unable to update room settings.', { cause: error });
  }
}

export async function updateCropRulesForCoop(
  cooperativeId: string,
  rule: CropThresholdRule
): Promise<void> {
  try {
    await db
      .update(storageRooms)
      .set({
        minTemp: rule.tempMin,
        maxTemp: rule.tempMax,
        minHumidity: rule.humidityMin,
        maxHumidity: rule.humidityMax,
        co2Max: rule.co2Max,
        gasIndexMax: rule.gasIndexMax,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(storageRooms.cooperativeId, cooperativeId),
          eq(storageRooms.crop, rule.crop)
        )
      );
  } catch (error) {
    console.error('Failed to update crop thresholds:', error);
    throw new Error('Unable to save crop threshold rules.', { cause: error });
  }
}

export async function createBatchForCoop(
  cooperativeId: string,
  batch: InventoryBatch
): Promise<void> {
  try {
    const ownedRoom = await db
      .select({ id: storageRooms.id })
      .from(storageRooms)
      .where(
        and(
          eq(storageRooms.id, batch.roomId),
          eq(storageRooms.cooperativeId, cooperativeId)
        )
      )
      .limit(1);

    if (ownedRoom.length === 0) {
      throw new Error('Selected storage room does not belong to this facility.');
    }

    await db.insert(batches).values({
      id: batch.id,
      cooperativeId,
      roomId: batch.roomId,
      rackId: batch.rackId,
      crop: batch.crop,
      quantityKg: batch.qtyKg,
      shelfLifeDays: batch.shelfLifeDays,
      shelfLifeLimit: batch.shelfLifeLimitDays,
      currentPricePhp: batch.currentPricePhp,
      targetPricePhp: batch.targetPricePhp,
      status: batch.released ? 'released' : batch.manualHold ? 'hold' : 'active',
      releaseNote: batch.releaseNote ?? null,
    });
  } catch (error) {
    console.error('Failed to insert inventory batch:', error);
    if (
      error instanceof Error &&
      error.message.includes('does not belong to this facility')
    ) {
      throw error;
    }
    throw new Error('Unable to create inventory batch.', { cause: error });
  }
}

export async function updateBatchForCoop(
  cooperativeId: string,
  batchId: string,
  patch: Partial<{
    quantityKg: number;
    status: 'active' | 'hold' | 'released';
    releaseNote: string | null;
  }>
): Promise<void> {
  try {
    await db
      .update(batches)
      .set(patch)
      .where(
        and(
          eq(batches.id, batchId),
          eq(batches.cooperativeId, cooperativeId)
        )
      );
  } catch (error) {
    console.error('Failed to update inventory batch:', error);
    throw new Error('Unable to update inventory batch.', { cause: error });
  }
}

export async function acknowledgeAlertForCoop(
  cooperativeId: string,
  alertId: string
): Promise<void> {
  try {
    await db
      .update(alerts)
      .set({ acknowledged: true })
      .where(
        and(
          eq(alerts.id, alertId),
          eq(alerts.cooperativeId, cooperativeId)
        )
      );
  } catch (error) {
    console.error('Failed to acknowledge alert:', error);
    throw new Error('Unable to acknowledge alert.', { cause: error });
  }
}

export async function applySimulatorRoomsForCoop(
  cooperativeId: string,
  updates: Array<{
    id: string;
    tempC: number;
    humidityPct: number;
    co2Ppm: number;
    gasIndex: number;
    sensorOnline: boolean;
  }>
): Promise<void> {
  try {
    await Promise.all(
      updates.map((u) =>
        db
          .update(storageRooms)
          .set({
            tempC: u.tempC,
            humidityPct: u.humidityPct,
            co2Ppm: u.co2Ppm,
            gasIndex: u.gasIndex,
            sensorOnline: u.sensorOnline,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(storageRooms.id, u.id),
              eq(storageRooms.cooperativeId, cooperativeId)
            )
          )
      )
    );
  } catch (error) {
    console.error('Failed to apply simulator readings:', error);
    throw new Error('Unable to persist scenario readings.', { cause: error });
  }
}
