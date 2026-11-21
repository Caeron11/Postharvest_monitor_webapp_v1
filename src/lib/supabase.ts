import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  CompressorMode,
  LanguageCode,
  UserRole,
} from '../types/postharvest';

export type ThemePrefsJson = {
  theme: 'light' | 'dark';
  blurPx: number;
  frostPct: number;
  depthScale: number;
  dispersionPct: number;
};

export type NotificationPrefsJson = {
  criticalTemp: boolean;
  sensorOffline: boolean;
  fefoReminders: boolean;
  audibleChime: boolean;
};

export type ProfileRow = {
  id: string;
  cooperative_id: string;
  full_name: string;
  email: string;
  cooperative_name: string;
  role: UserRole;
  language: LanguageCode;
  theme_prefs: ThemePrefsJson;
  notification_prefs: NotificationPrefsJson;
  updated_at: string;
};

export type StorageRoomRow = {
  id: string;
  cooperative_id: string;
  cooperative_name: string;
  name: string;
  crop: string;
  temp_c: number;
  humidity_pct: number;
  co2_ppm: number;
  gas_index: number;
  min_temp: number;
  max_temp: number;
  min_humidity: number;
  max_humidity: number;
  co2_max: number;
  gas_index_max: number;
  equipment_mode: CompressorMode;
  defrost_active: boolean;
  sensor_online: boolean;
  updated_at: string;
};

export type BatchRow = {
  id: string;
  cooperative_id: string;
  room_id: string;
  rack_id: string;
  crop: string;
  quantity_kg: number;
  shelf_life_days: number;
  shelf_life_limit: number;
  current_price_php: number;
  target_price_php: number;
  status: 'active' | 'hold' | 'released';
  release_note: string | null;
  created_at: string;
};

export type AlertRow = {
  id: string;
  cooperative_id: string;
  room_id: string;
  type: string;
  severity: 'critical' | 'warning' | 'no_data';
  message: string;
  acknowledged: boolean;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: Omit<ProfileRow, 'updated_at'> & { updated_at?: string };
        Update: Partial<Omit<ProfileRow, 'id'>>;
        Relationships: [];
      };
      storage_rooms: {
        Row: StorageRoomRow;
        Insert: Omit<StorageRoomRow, 'updated_at'> & { updated_at?: string };
        Update: Partial<Omit<StorageRoomRow, 'id'>>;
        Relationships: [];
      };
      batches: {
        Row: BatchRow;
        Insert: Omit<BatchRow, 'created_at' | 'release_note'> & {
          release_note?: string | null;
          created_at?: string;
        };
        Update: Partial<Omit<BatchRow, 'id'>>;
        Relationships: [];
      };
      alerts: {
        Row: AlertRow;
        Insert: Omit<AlertRow, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<AlertRow, 'id'>>;
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      current_cooperative_id: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

function readPublicEnv(key: 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_ANON_KEY'): string {
  try {
    const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
    return (env?.[key] ?? '').trim();
  } catch {
    return '';
  }
}

const supabaseUrl = readPublicEnv('VITE_SUPABASE_URL');
const supabaseAnonKey = readPublicEnv('VITE_SUPABASE_ANON_KEY');

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase: SupabaseClient<Database> | null = isSupabaseConfigured
  ? createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export function slugifyCooperativeId(name: string): string {
  const cleaned = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || 'benguet-highland';
}
