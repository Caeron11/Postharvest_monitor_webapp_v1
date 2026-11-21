export type ViewId = 'dashboard' | 'rooms' | 'inventory' | 'alerts';

export type AlertsSubTab = 'alerts' | 'settings';

export type LanguageCode = 'en' | 'fil';

export type UserRole =
  | 'Facility Manager'
  | 'Cold-Chain Operator'
  | 'Quality Inspector';

export type CropType =
  | 'Strawberries'
  | 'Bell Peppers'
  | 'Highland Lettuce'
  | 'Carrots';

export type SeverityLevel = 'critical' | 'warning' | 'no_data' | 'in_range';

export type MetricState = 'above' | 'below' | 'rising' | 'in_range' | 'no_data';

export type RecommendationStatus =
  | 'release_now'
  | 'release_soon'
  | 'hold'
  | 'released';

export type ScenarioType = 'normal' | 'equipment_failure' | 'harvest_glut';

export type CompressorMode = 'auto' | 'boost' | 'standby';

export interface UserProfile {
  fullName: string;
  email: string;
  cooperativeName: string;
  role: UserRole;
}

export type AuthSessionMode = 'demo' | 'supabase' | 'cloudsql';

export interface AuthState {
  isAuthenticated: boolean;
  mode?: AuthSessionMode;
  userId?: string;
  cooperativeId?: string;
  user: UserProfile;
  password: string;
}

export interface NotificationSettings {
  criticalTemp: boolean;
  sensorOffline: boolean;
  fefoReminders: boolean;
  audibleChime: boolean;
}

export interface GlassSettings {
  blurPx: number;
  frostPct: number;
  depthScale: number;
  dispersionPct: number;
}

export interface TelemetryPoint {
  hourLabel: string;
  tempC: number;
  humidityPct: number;
  co2Ppm: number;
  gasIndex: number;
}

export interface RackBay {
  id: string;
  label: string;
  capacityKg: number;
}

export interface StorageRoom {
  id: string;
  name: string;
  crop: CropType;
  online: boolean;
  offlineSince?: string;
  tempC: number;
  humidityPct: number;
  co2Ppm: number;
  gasIndex: number;
  gasRising: boolean;
  breachDurationMin: number;
  compressorMode: CompressorMode;
  defrostActive: boolean;
  doorClosed: boolean;
  racks: RackBay[];
  history24h: TelemetryPoint[];
}

export interface CropThresholdRule {
  crop: CropType;
  tempMin: number;
  tempMax: number;
  humidityMin: number;
  humidityMax: number;
  co2Max: number;
  gasIndexMax: number;
  tempHoldMinutes: number;
  notifyInApp: boolean;
  notifySms: boolean;
}

export interface ThresholdValidationErrors {
  tempMin?: string;
  tempMax?: string;
  humidityMin?: string;
  humidityMax?: string;
  co2Max?: string;
  gasIndexMax?: string;
  summary?: string;
}

export interface PricePoint {
  dayLabel: string;
  pricePhp: number;
  inReleaseWindow: boolean;
}

export interface InventoryBatch {
  id: string;
  crop: CropType;
  roomId: string;
  rackId: string;
  qtyKg: number;
  harvestedDate: string;
  shelfLifeDays: number;
  shelfLifeLimitDays: number;
  currentPricePhp: number;
  targetPricePhp: number;
  manualHold: boolean;
  released: boolean;
  releasedAt?: string;
  releaseNote?: string;
}

export interface AlertItem {
  id: string;
  roomId: string;
  roomName: string;
  metric: 'temperature' | 'humidity' | 'co2' | 'gas' | 'sensor';
  typeLabel: string;
  message: string;
  severity: Exclude<SeverityLevel, 'in_range'>;
  timestamp: string;
  acknowledged: boolean;
}

export interface SimulatorConfig {
  scenario: ScenarioType;
  durationHours: number;
  ambientOffsetC: number;
  compressorLoadPct: number;
  lastRunAt?: string;
  lastRunSummary?: string;
}

export interface RoomEvaluation {
  severity: SeverityLevel;
  primaryMetric: 'temperature' | 'humidity' | 'co2' | 'gas' | 'sensor' | null;
  statusLabel: string;
  tempState: MetricState;
  humidityState: MetricState;
  co2State: MetricState;
  gasState: MetricState;
}

export interface BatchRecommendation {
  status: RecommendationStatus;
  badgeLabel: string;
  summaryText: string;
  urgencyScore: number;
}

export interface ScenarioProjection {
  spoilageRiskPct: number;
  shelfLifeDeltaDays: number;
  projectedBreachRooms: number;
  peakTempDeltaC: number;
}

export interface FacilityKpis {
  openAlertsCount: number;
  criticalAlertsCount: number;
  warningAlertsCount: number;
  noDataAlertsCount: number;
  roomsInRangeCount: number;
  offlineRoomsCount: number;
  totalRoomsCount: number;
  activeBatchesCount: number;
  totalStorageKg: number;
  releaseOpeningCount: number;
}

export interface PostharvestState {
  schemaVersion: number;
  activeView: ViewId;
  alertsSubTab: AlertsSubTab;
  selectedRoomId: string;
  selectedBatchId: string;
  selectedRuleCrop: CropType;
  theme: 'light' | 'dark';
  language: LanguageCode;
  autoRefresh: boolean;
  lastUpdated: string;
  auth: AuthState;
  notifications: NotificationSettings;
  glass: GlassSettings;
  rooms: StorageRoom[];
  rules: Record<CropType, CropThresholdRule>;
  batches: InventoryBatch[];
  alerts: AlertItem[];
  priceSeriesByCrop: Record<CropType, PricePoint[]>;
  simulator: SimulatorConfig;
}
