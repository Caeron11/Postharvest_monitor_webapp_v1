import type {
  AlertItem,
  CropProfileId,
  CropProfileMetadata,
  CropThresholdRule,
  CropType,
  GlassSettings,
  InventoryBatch,
  NotificationSettings,
  PostharvestState,
  PricePoint,
  StorageRoom,
  TelemetryPoint,
  TomatoMaturityPreset,
  UserProfile,
} from '../types/postharvest';
import { syncAlertsWithRooms } from '../utils/postharvestEngine';

export const STATE_SCHEMA_VERSION = 4;

export const CROP_LIST: CropType[] = ['Broccoli', 'Tomato'];

export const CROP_PROFILES: Record<CropProfileId, CropProfileMetadata> = {
  broccoli: {
    id: 'broccoli',
    crop: 'Broccoli',
    displayName: 'Broccoli',
    scientificName: 'Brassica oleracea var. italica',
    tempMin: 0.0,
    tempMax: 2.0,
    rhMin: 95,
    rhMax: 98,
    co2MaxPpm: 450,
    ethyleneMaxPpm: 200,
    ethyleneNote:
      'Very low ethylene production (< 0.1 uL/kg-h), high ethylene sensitivity',
    shelfLifeLimitDays: 14,
    baselineLossRange: '17.70% - 23.03%',
    baselineLossMinPct: 17.7,
    baselineLossMaxPct: 23.03,
    retailLossNote: 'Farm-to-trading post / Buguias benchmark; 26% retail',
    sources: 'Antolin & Malanon (2025), Makule et al. (2022), Mohammed et al. (2022)',
  },
  tomato_mature_green: {
    id: 'tomato_mature_green',
    crop: 'Tomato',
    maturityPreset: 'mature_green',
    displayName: 'Tomato (Mature-Green)',
    scientificName: 'Solanum lycopersicum',
    tempMin: 10.0,
    tempMax: 13.0,
    rhMin: 90,
    rhMax: 95,
    co2MaxPpm: 450,
    ethyleneMaxPpm: 200,
    ethyleneNote:
      'High ethylene sensitivity; chilling injury occurs below 10.0 °C',
    shelfLifeLimitDays: 14,
    baselineLossRange: '10.94% - 24.14%',
    baselineLossMinPct: 10.94,
    baselineLossMaxPct: 24.14,
    retailLossNote: 'Farm-to-market routes; 14%-18% public markets; up to 30% midstream',
    sources:
      'SEARCA (2022), Bayogan, Urquiola, et al. (2023), Digal et al. (2024), Makule et al. (2022), Mohammed et al. (2022)',
  },
  tomato_firm_ripe: {
    id: 'tomato_firm_ripe',
    crop: 'Tomato',
    maturityPreset: 'firm_ripe',
    displayName: 'Tomato (Firm-Ripe)',
    scientificName: 'Solanum lycopersicum',
    tempMin: 8.0,
    tempMax: 10.0,
    rhMin: 85,
    rhMax: 90,
    co2MaxPpm: 450,
    ethyleneMaxPpm: 200,
    ethyleneNote:
      'High ethylene production; isolate from ethylene-sensitive Broccoli',
    shelfLifeLimitDays: 8,
    baselineLossRange: '14.00% - 18.00%',
    baselineLossMinPct: 14.0,
    baselineLossMaxPct: 18.0,
    retailLossNote: 'Public market benchmark; up to 30% midstream without cold chain',
    sources:
      'SEARCA (2022), Makule et al. (2022), Beaulah et al. (2025), Mohammed et al. (2022)',
  },
};

export const TOMATO_MATURITY_PRESETS: Record<
  TomatoMaturityPreset,
  CropThresholdRule
> = {
  mature_green: {
    crop: 'Tomato',
    maturityPreset: 'mature_green',
    tempMin: 10.0,
    tempMax: 13.0,
    humidityMin: 90,
    humidityMax: 95,
    co2Max: 450,
    gasIndexMax: 200,
    tempHoldMinutes: 20,
    notifyInApp: true,
    notifySms: true,
  },
  firm_ripe: {
    crop: 'Tomato',
    maturityPreset: 'firm_ripe',
    tempMin: 8.0,
    tempMax: 10.0,
    humidityMin: 85,
    humidityMax: 90,
    co2Max: 450,
    gasIndexMax: 200,
    tempHoldMinutes: 20,
    notifyInApp: true,
    notifySms: true,
  },
};

export const DEFAULT_GLASS_SETTINGS: GlassSettings = {
  blurPx: 24,
  frostPct: 68,
  depthScale: 1.0,
  dispersionPct: 100,
};

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  criticalTemp: true,
  sensorOffline: true,
  fefoReminders: true,
  audibleChime: false,
};

export const DEFAULT_USER_PROFILE: UserProfile = {
  fullName: 'Elena Ramos',
  email: 'manager@benguetcoop.ph',
  cooperativeName: 'Benguet Highland',
  role: 'Facility Manager',
};

export const DEFAULT_CROP_RULES: Record<CropType, CropThresholdRule> = {
  Broccoli: {
    crop: 'Broccoli',
    tempMin: 0.0,
    tempMax: 2.0,
    humidityMin: 95,
    humidityMax: 98,
    co2Max: 450,
    gasIndexMax: 200,
    tempHoldMinutes: 15,
    notifyInApp: true,
    notifySms: true,
  },
  Tomato: {
    ...TOMATO_MATURITY_PRESETS.mature_green,
  },
};

function buildSeries(
  temps: number[],
  hums: number[],
  co2s: number[],
  ethylenesPpm: number[]
): TelemetryPoint[] {
  const labels = [
    '06:00',
    '09:00',
    '12:00',
    '15:00',
    '18:00',
    '21:00',
    '00:00',
    '03:00',
    '06:00',
  ];
  return labels.map((hourLabel, i) => ({
    hourLabel,
    tempC: temps[i],
    humidityPct: hums[i],
    co2Ppm: co2s[i],
    gasIndex: ethylenesPpm[i],
  }));
}

export const INITIAL_ROOMS: StorageRoom[] = [
  {
    id: 'room-a',
    name: 'Room A',
    crop: 'Broccoli',
    variety: 'Crown Cut',
    online: true,
    tempC: 4.6,
    humidityPct: 96.0,
    co2Ppm: 390,
    gasIndex: 85,
    gasRising: false,
    breachDurationMin: 38,
    compressorMode: 'boost',
    defrostActive: false,
    doorClosed: true,
    racks: [
      { id: 'R1', label: 'Rack R1', capacityKg: 600 },
      { id: 'R2', label: 'Rack R2', capacityKg: 600 },
      { id: 'R3', label: 'Rack R3', capacityKg: 500 },
    ],
    history24h: buildSeries(
      [1.2, 1.5, 1.9, 2.3, 2.8, 3.3, 3.8, 4.2, 4.6],
      [96.8, 96.6, 96.5, 96.4, 96.3, 96.2, 96.1, 96.0, 96.0],
      [340, 348, 355, 362, 370, 376, 382, 386, 390],
      [40, 46, 52, 58, 64, 70, 76, 81, 85]
    ),
  },
  {
    id: 'room-b',
    name: 'Room B',
    crop: 'Broccoli',
    variety: 'Highland Florets',
    online: true,
    tempC: 1.2,
    humidityPct: 96.0,
    co2Ppm: 365,
    gasIndex: 42,
    gasRising: false,
    breachDurationMin: 0,
    compressorMode: 'auto',
    defrostActive: false,
    doorClosed: true,
    racks: [
      { id: 'R1', label: 'Rack R1', capacityKg: 700 },
      { id: 'R2', label: 'Rack R2', capacityKg: 700 },
      { id: 'R3', label: 'Rack R3', capacityKg: 600 },
    ],
    history24h: buildSeries(
      [1.1, 1.2, 1.3, 1.2, 1.1, 1.2, 1.3, 1.2, 1.2],
      [96.2, 96.1, 96.0, 95.9, 96.1, 96.2, 96.0, 95.9, 96.0],
      [350, 354, 358, 360, 358, 361, 364, 366, 365],
      [36, 38, 40, 41, 40, 41, 42, 43, 42]
    ),
  },
  {
    id: 'room-c',
    name: 'Room C',
    crop: 'Tomato',
    variety: 'Mature-Green',
    maturityPreset: 'mature_green',
    online: true,
    tempC: 15.4,
    humidityPct: 88.0,
    co2Ppm: 485,
    gasIndex: 215,
    gasRising: true,
    breachDurationMin: 72,
    compressorMode: 'boost',
    defrostActive: false,
    doorClosed: true,
    racks: [
      { id: 'R1', label: 'Rack R1', capacityKg: 900 },
      { id: 'R2', label: 'Rack R2', capacityKg: 900 },
      { id: 'R3', label: 'Rack R3', capacityKg: 800 },
    ],
    history24h: buildSeries(
      [11.4, 11.9, 12.5, 13.1, 13.7, 14.2, 14.7, 15.1, 15.4],
      [92.5, 91.8, 91.2, 90.6, 90.0, 89.4, 88.9, 88.4, 88.0],
      [370, 385, 402, 418, 432, 448, 462, 474, 485],
      [110, 124, 138, 152, 166, 180, 194, 205, 215]
    ),
  },
  {
    id: 'room-d',
    name: 'Room D',
    crop: 'Tomato',
    variety: 'Firm-Ripe',
    maturityPreset: 'firm_ripe',
    online: false,
    offlineSince: '05:14',
    tempC: 9.0,
    humidityPct: 88.0,
    co2Ppm: 380,
    gasIndex: 95,
    gasRising: false,
    breachDurationMin: 0,
    compressorMode: 'standby',
    defrostActive: false,
    doorClosed: true,
    racks: [
      { id: 'R1', label: 'Rack R1', capacityKg: 1200 },
      { id: 'R2', label: 'Rack R2', capacityKg: 1200 },
      { id: 'R3', label: 'Rack R3', capacityKg: 1000 },
    ],
    history24h: buildSeries(
      [8.9, 9.0, 9.1, 9.0, 8.9, 9.0, 9.1, 9.0, 9.0],
      [88.4, 88.2, 88.0, 87.9, 88.1, 88.0, 87.9, 88.0, 88.0],
      [365, 368, 372, 375, 374, 378, 380, 381, 380],
      [84, 86, 88, 90, 91, 92, 94, 95, 95]
    ),
  },
];

export const INITIAL_BATCHES: InventoryBatch[] = [
  {
    id: 'B-001',
    crop: 'Broccoli',
    roomId: 'room-a',
    rackId: 'R1',
    qtyKg: 420,
    harvestedDate: '2026-11-16',
    shelfLifeDays: 2,
    shelfLifeLimitDays: 14,
    currentPricePhp: 158,
    targetPricePhp: 145,
    manualHold: false,
    released: false,
  },
  {
    id: 'B-002',
    crop: 'Broccoli',
    roomId: 'room-a',
    rackId: 'R2',
    qtyKg: 360,
    harvestedDate: '2026-11-17',
    shelfLifeDays: 4,
    shelfLifeLimitDays: 14,
    currentPricePhp: 152,
    targetPricePhp: 145,
    manualHold: false,
    released: false,
  },
  {
    id: 'B-003',
    crop: 'Tomato',
    maturityPreset: 'mature_green',
    roomId: 'room-c',
    rackId: 'R1',
    qtyKg: 680,
    harvestedDate: '2026-11-15',
    shelfLifeDays: 3,
    shelfLifeLimitDays: 14,
    currentPricePhp: 88,
    targetPricePhp: 82,
    manualHold: false,
    released: false,
  },
  {
    id: 'B-004',
    crop: 'Tomato',
    maturityPreset: 'mature_green',
    roomId: 'room-c',
    rackId: 'R2',
    qtyKg: 590,
    harvestedDate: '2026-11-16',
    shelfLifeDays: 6,
    shelfLifeLimitDays: 14,
    currentPricePhp: 84,
    targetPricePhp: 82,
    manualHold: false,
    released: false,
  },
  {
    id: 'B-005',
    crop: 'Broccoli',
    roomId: 'room-b',
    rackId: 'R1',
    qtyKg: 510,
    harvestedDate: '2026-11-18',
    shelfLifeDays: 9,
    shelfLifeLimitDays: 14,
    currentPricePhp: 134,
    targetPricePhp: 148,
    manualHold: false,
    released: false,
  },
  {
    id: 'B-006',
    crop: 'Tomato',
    maturityPreset: 'firm_ripe',
    roomId: 'room-d',
    rackId: 'R1',
    qtyKg: 920,
    harvestedDate: '2026-11-17',
    shelfLifeDays: 7,
    shelfLifeLimitDays: 8,
    currentPricePhp: 72,
    targetPricePhp: 85,
    manualHold: false,
    released: false,
  },
  {
    id: 'B-007',
    crop: 'Broccoli',
    roomId: 'room-b',
    rackId: 'R2',
    qtyKg: 440,
    harvestedDate: '2026-11-19',
    shelfLifeDays: 12,
    shelfLifeLimitDays: 14,
    currentPricePhp: 128,
    targetPricePhp: 148,
    manualHold: false,
    released: false,
  },
];

export const INITIAL_PRICE_SERIES: Record<CropType, PricePoint[]> = {
  Broccoli: [
    { dayLabel: 'D-6', pricePhp: 118, inReleaseWindow: false },
    { dayLabel: 'D-4', pricePhp: 132, inReleaseWindow: false },
    { dayLabel: 'D-2', pricePhp: 146, inReleaseWindow: true },
    { dayLabel: 'Today', pricePhp: 158, inReleaseWindow: true },
    { dayLabel: 'D+2', pricePhp: 162, inReleaseWindow: true },
    { dayLabel: 'D+4', pricePhp: 149, inReleaseWindow: true },
    { dayLabel: 'D+6', pricePhp: 136, inReleaseWindow: false },
  ],
  Tomato: [
    { dayLabel: 'D-6', pricePhp: 68, inReleaseWindow: false },
    { dayLabel: 'D-4', pricePhp: 74, inReleaseWindow: false },
    { dayLabel: 'D-2', pricePhp: 83, inReleaseWindow: true },
    { dayLabel: 'Today', pricePhp: 88, inReleaseWindow: true },
    { dayLabel: 'D+2', pricePhp: 93, inReleaseWindow: true },
    { dayLabel: 'D+4', pricePhp: 85, inReleaseWindow: true },
    { dayLabel: 'D+6', pricePhp: 76, inReleaseWindow: false },
  ],
};

export const INITIAL_ALERTS: AlertItem[] = [
  {
    id: 'alert-room-a-temperature',
    roomId: 'room-a',
    roomName: 'Room A',
    metric: 'temperature',
    typeLabel: 'Temperature high',
    message: 'Room A temperature above range (4.6 °C, floret yellowing risk)',
    severity: 'critical',
    timestamp: '06:24',
    acknowledged: false,
  },
  {
    id: 'alert-room-c-temperature',
    roomId: 'room-c',
    roomName: 'Room C',
    metric: 'temperature',
    typeLabel: 'Temperature high',
    message:
      'Room C temperature above range (15.4 °C, accelerated ripening risk; CO2 485 ppm, C2H4 215 ppm)',
    severity: 'critical',
    timestamp: '06:18',
    acknowledged: false,
  },
  {
    id: 'alert-room-d-sensor',
    roomId: 'room-d',
    roomName: 'Room D',
    metric: 'sensor',
    typeLabel: 'Sensor offline',
    message: 'Room D sensor offline since 05:14',
    severity: 'no_data',
    timestamp: '05:14',
    acknowledged: false,
  },
];

export function createInitialState(): PostharvestState {
  const initialAlerts = syncAlertsWithRooms(
    INITIAL_ROOMS,
    DEFAULT_CROP_RULES,
    INITIAL_ALERTS,
    '06:32'
  );

  return {
    schemaVersion: STATE_SCHEMA_VERSION,
    activeView: 'dashboard',
    alertsSubTab: 'alerts',
    selectedRoomId: 'room-a',
    selectedBatchId: 'B-001',
    selectedRuleCrop: 'Broccoli',
    theme: 'light',
    language: 'en',
    autoRefresh: true,
    lastUpdated: '06:32',
    auth: {
      isAuthenticated: false,
      mode: 'demo',
      user: { ...DEFAULT_USER_PROFILE },
      password: '',
    },
    notifications: { ...DEFAULT_NOTIFICATION_SETTINGS },
    glass: { ...DEFAULT_GLASS_SETTINGS },
    rooms: INITIAL_ROOMS,
    rules: { ...DEFAULT_CROP_RULES },
    batches: INITIAL_BATCHES,
    alerts: initialAlerts,
    priceSeriesByCrop: INITIAL_PRICE_SERIES,
    simulator: {
      scenario: 'normal',
      durationHours: 12,
      ambientOffsetC: 0,
      compressorLoadPct: 72,
    },
  };
}
