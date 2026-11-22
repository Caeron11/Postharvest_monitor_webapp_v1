import { relations } from 'drizzle-orm';
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export interface ProfileThemePrefs {
  theme: 'light' | 'dark';
  blurPx: number;
  frostPct: number;
  depthScale: number;
  dispersionPct: number;
}

export interface ProfileNotificationPrefs {
  criticalTemp: boolean;
  sensorOffline: boolean;
  fefoReminders: boolean;
  audibleChime: boolean;
}

export const profiles = pgTable(
  'profiles',
  {
    uid: text('uid').primaryKey(),
    cooperativeId: text('cooperative_id').notNull(),
    fullName: text('full_name').notNull(),
    email: text('email').notNull(),
    cooperativeName: text('cooperative_name').notNull(),
    role: text('role').notNull().default('Facility Manager'),
    language: text('language').notNull().default('en'),
    themePrefs: jsonb('theme_prefs')
      .$type<ProfileThemePrefs>()
      .notNull()
      .default({
        theme: 'light',
        blurPx: 24,
        frostPct: 68,
        depthScale: 1.0,
        dispersionPct: 100,
      }),
    notificationPrefs: jsonb('notification_prefs')
      .$type<ProfileNotificationPrefs>()
      .notNull()
      .default({
        criticalTemp: true,
        sensorOffline: true,
        fefoReminders: true,
        audibleChime: false,
      }),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index('profiles_cooperative_idx').on(table.cooperativeId)]
);

export const storageRooms = pgTable(
  'storage_rooms',
  {
    id: text('id').primaryKey(),
    cooperativeId: text('cooperative_id').notNull(),
    cooperativeName: text('cooperative_name').notNull(),
    name: text('name').notNull(),
    crop: text('crop').notNull(),
    tempC: doublePrecision('temp_c').notNull(),
    humidityPct: doublePrecision('humidity_pct').notNull(),
    co2Ppm: doublePrecision('co2_ppm').notNull(),
    gasIndex: doublePrecision('gas_index').notNull(),
    minTemp: doublePrecision('min_temp').notNull(),
    maxTemp: doublePrecision('max_temp').notNull(),
    minHumidity: doublePrecision('min_humidity').notNull().default(90),
    maxHumidity: doublePrecision('max_humidity').notNull().default(95),
    co2Max: doublePrecision('co2_max').notNull().default(450),
    gasIndexMax: doublePrecision('gas_index_max').notNull().default(200),
    equipmentMode: text('equipment_mode').notNull().default('auto'),
    defrostActive: boolean('defrost_active').notNull().default(false),
    sensorOnline: boolean('sensor_online').notNull().default(true),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index('storage_rooms_cooperative_idx').on(table.cooperativeId)]
);

export const batches = pgTable(
  'batches',
  {
    id: text('id').primaryKey(),
    cooperativeId: text('cooperative_id').notNull(),
    roomId: text('room_id')
      .notNull()
      .references(() => storageRooms.id, { onDelete: 'cascade' }),
    rackId: text('rack_id').notNull().default('R1'),
    crop: text('crop').notNull(),
    quantityKg: doublePrecision('quantity_kg').notNull(),
    shelfLifeDays: integer('shelf_life_days').notNull(),
    shelfLifeLimit: integer('shelf_life_limit').notNull(),
    currentPricePhp: doublePrecision('current_price_php').notNull(),
    targetPricePhp: doublePrecision('target_price_php').notNull(),
    status: text('status').notNull().default('active'),
    releaseNote: text('release_note'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('batches_cooperative_idx').on(table.cooperativeId),
    index('batches_room_idx').on(table.roomId),
  ]
);

export const alerts = pgTable(
  'alerts',
  {
    id: text('id').primaryKey(),
    cooperativeId: text('cooperative_id').notNull(),
    roomId: text('room_id')
      .notNull()
      .references(() => storageRooms.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    severity: text('severity').notNull(),
    message: text('message').notNull(),
    acknowledged: boolean('acknowledged').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('alerts_cooperative_idx').on(table.cooperativeId),
    index('alerts_room_idx').on(table.roomId),
  ]
);

export const storageRoomsRelations = relations(storageRooms, ({ many }) => ({
  batches: many(batches),
  alerts: many(alerts),
}));

export const batchesRelations = relations(batches, ({ one }) => ({
  room: one(storageRooms, {
    fields: [batches.roomId],
    references: [storageRooms.id],
  }),
}));

export const alertsRelations = relations(alerts, ({ one }) => ({
  room: one(storageRooms, {
    fields: [alerts.roomId],
    references: [storageRooms.id],
  }),
}));
