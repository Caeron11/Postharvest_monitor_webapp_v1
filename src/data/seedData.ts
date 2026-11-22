import type {
  AlertItem,
  CropThresholdRule,
  CropType,
  GlassSettings,
  InventoryBatch,
  NotificationSettings,
  PostharvestState,
  PricePoint,
  StorageRoom,
  TelemetryPoint,
  UserProfile,
} from '../types/postharvest';
import { syncAlertsWithRooms } from '../utils/postharvestEngine';

export const STATE_SCHEMA_VERSION = 3;

export const CROP_LIST: CropType[] = ['Broccoli', 'Tomato'];

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
    co2Max: 1000,
    gasIndexMax: 1.2,
    tempHoldMinutes: 15,
    notifyInApp: true,
    notifySms: true,
  },
  Tomato: {
    crop: 'Tomato',
    tempMin: 10.0,
    tempMax: 12.5,
    humidityMin: 90,
    humidityMax: 95,
    co2Max: 1500,
    gasIndexMax: 1.8,
    tempHoldMinutes: 20,
    notifyInApp: true,
    notifySms: true,
  },
};

function buildSeries(
  temps: number[],
  hums: number[],
  co2s: number[],
  gases: number[]
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
    gasIndex: gases[i],
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
    co2Ppm: 710,
    gasIndex: 1.1,
    gasRising: true,
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
      [1.2, 1.4, 1.8, 2.2, 2.7, 3.3, 3.8, 4.2, 4.6],
      [96.8, 96.6, 96.5, 96.4, 96.3, 96.2, 96.1, 96.0, 96.0],
      [460, 490, 520, 555, 590, 625, 655, 685, 710],
      [0.5, 0.6, 0.6, 0.7, 0.8, 0.9, 1.0, 1.0, 1.1]
    ),
  },
  {
    id: 'room-b',
    name: 'Room B',
    crop: 'Broccoli',
    variety: 'Highland Florets',
    online: true,
    tempC: 1.4,
    humidityPct: 96.0,
    co2Ppm: 490,
    gasIndex: 0.6,
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
      [1.3, 1.4, 1.5, 1.4, 1.3, 1.4, 1.5, 1.4, 1.4],
      [96.2, 96.1, 96.0, 95.9, 96.1, 96.2, 96.0, 95.9, 96.0],
      [465, 470, 480, 485, 478, 482, 488, 492, 490],
      [0.5, 0.5, 0.6, 0.6, 0.6, 0.5, 0.6, 0.6, 0.6]
    ),
  },
  {
    id: 'room-c',
    name: 'Room C',
    crop: 'Tomato',
    variety: 'Breaker Stage',
    online: true,
    tempC: 15.4,
    humidityPct: 91.2,
    co2Ppm: 980,
    gasIndex: 1.6,
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
      [11.2, 11.6, 12.1, 12.8, 13.4, 14.0, 14.6, 15.1, 15.4],
      [93.0, 92.7, 92.4, 92.2, 91.9, 91.7, 91.5, 91.3, 91.2],
      [620, 670, 725, 770, 815, 860, 905, 945, 980],
      [0.9, 1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.5, 1.6]
    ),
  },
  {
    id: 'room-d',
    name: 'Room D',
    crop: 'Tomato',
    variety: 'Pink-Red Grade A',
    online: false,
    offlineSince: '05:14',
    tempC: 11.2,
    humidityPct: 92.5,
    co2Ppm: 640,
    gasIndex: 0.9,
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
      [11.0, 11.1, 11.2, 11.3, 11.2, 11.1, 11.2, 11.2, 11.2],
      [92.8, 92.6, 92.5, 92.4, 92.6, 92.5, 92.4, 92.5, 92.5],
      [615, 620, 628, 635, 632, 638, 642, 640, 640],
      [0.8, 0.8, 0.9, 0.9, 0.9, 0.8, 0.9, 0.9, 0.9]
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
    shelfLifeLimitDays: 10,
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
    shelfLifeLimitDays: 10,
    currentPricePhp: 152,
    targetPricePhp: 145,
    manualHold: false,
    released: false,
  },
  {
    id: 'B-003',
    crop: 'Tomato',
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
    shelfLifeDays: 8,
    shelfLifeLimitDays: 10,
    currentPricePhp: 134,
    targetPricePhp: 148,
    manualHold: false,
    released: false,
  },
  {
    id: 'B-006',
    crop: 'Tomato',
    roomId: 'room-d',
    rackId: 'R1',
    qtyKg: 920,
    harvestedDate: '2026-11-17',
    shelfLifeDays: 11,
    shelfLifeLimitDays: 14,
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
    shelfLifeDays: 9,
    shelfLifeLimitDays: 10,
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
    message: 'Room C temperature above range (15.4 °C, accelerated ripening risk)',
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
