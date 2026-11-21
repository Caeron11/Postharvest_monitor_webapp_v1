import { firebaseAuth } from '../lib/firebase';
import type {
  CompressorMode,
  CropThresholdRule,
  GlassSettings,
  InventoryBatch,
  LanguageCode,
  NotificationSettings,
  StorageRoom,
  UserProfile,
} from '../types/postharvest';
import type { HydratedFacilityPayload } from './postharvestRepo';

async function getBearerHeaders(): Promise<Record<string, string>> {
  const user = firebaseAuth.currentUser;
  if (!user) {
    throw new Error('Authentication session expired. Please sign in again.');
  }
  const token = await user.getIdToken();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

async function apiRequest<T>(
  url: string,
  init: RequestInit = {}
): Promise<T> {
  const headers = await getBearerHeaders();
  const res = await fetch(url, {
    ...init,
    headers: {
      ...headers,
      ...(init.headers ?? {}),
    },
  });

  if (!res.ok) {
    let message = 'Request failed';
    try {
      const errBody = (await res.json()) as { error?: string };
      if (errBody?.error) message = errBody.error;
    } catch {
      // Keep default error message
    }
    throw new Error(message);
  }

  return (await res.json()) as T;
}

export async function fetchCloudWorkspace(): Promise<HydratedFacilityPayload> {
  return apiRequest<HydratedFacilityPayload>('/api/facility', { method: 'GET' });
}

export async function patchCloudProfile(
  patch: Partial<{
    fullName: string;
    email: string;
    cooperativeName: string;
    role: UserProfile['role'];
    language: LanguageCode;
    themePrefs: GlassSettings & { theme: 'light' | 'dark' };
    notificationPrefs: NotificationSettings;
  }>
): Promise<void> {
  await apiRequest('/api/profile', {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function patchCloudRoom(
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
  await apiRequest(`/api/rooms/${encodeURIComponent(roomId)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function putCloudCropRule(rule: CropThresholdRule): Promise<void> {
  await apiRequest(`/api/rules/${encodeURIComponent(rule.crop)}`, {
    method: 'PUT',
    body: JSON.stringify(rule),
  });
}

export async function postCloudBatch(batch: InventoryBatch): Promise<void> {
  await apiRequest('/api/batches', {
    method: 'POST',
    body: JSON.stringify(batch),
  });
}

export async function patchCloudBatch(
  batchId: string,
  patch: Partial<{
    quantityKg: number;
    status: 'active' | 'hold' | 'released';
    releaseNote: string | null;
  }>
): Promise<void> {
  await apiRequest(`/api/batches/${encodeURIComponent(batchId)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function patchCloudAlertAcknowledge(
  alertId: string
): Promise<void> {
  await apiRequest(`/api/alerts/${encodeURIComponent(alertId)}/acknowledge`, {
    method: 'PATCH',
  });
}

export async function postCloudSimulatorRooms(
  rooms: StorageRoom[]
): Promise<void> {
  await apiRequest('/api/simulator/apply', {
    method: 'POST',
    body: JSON.stringify({
      rooms: rooms.map((r) => ({
        id: r.id,
        tempC: r.tempC,
        humidityPct: r.humidityPct,
        co2Ppm: r.co2Ppm,
        gasIndex: r.gasIndex,
        sensorOnline: r.online,
      })),
    }),
  });
}
