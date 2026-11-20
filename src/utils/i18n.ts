import type { LanguageCode } from '../types/postharvest';

export interface UiCopy {
  navDashboard: string;
  navRooms: string;
  navInventory: string;
  navAlerts: string;
  navRoomsShort: string;
  navInventoryShort: string;
  navAlertsShort: string;
  darkGlass: string;
  lightGlass: string;
  signOut: string;
  cooperativeLabel: string;
  roleLabel: string;
  simulatedNotice: string;
  updatedLabel: string;
  autoRefreshLabel: string;
  onLabel: string;
  offLabel: string;
  activeAlerts: string;
  roomsInRange: string;
  batchesInStorage: string;
  releaseWindowOpening: string;
  reviewRecommendations: string;
  storageRoomsHeading: string;
  decisionsToday: string;
  farmgatePriceHeading: string;
  backToDashboard: string;
  equipmentControls: string;
  batchesInRoom: string;
  activeRules: string;
  editThresholds: string;
  inventoryHeading: string;
  addBatch: string;
  filterLabel: string;
  sortByLabel: string;
  batchesHeading: string;
  recommendationFor: string;
  markAsReleased: string;
  holdBatch: string;
  clearHold: string;
  releaseAction: string;
  alertsSettingsHeading: string;
  tabAlertsSim: string;
  tabSystemSettings: string;
  alertLogHeading: string;
  simulatorHeading: string;
  runScenario: string;
  thresholdRulesHeading: string;
  saveRules: string;
  resetSource: string;
  settingsAccount: string;
  settingsLanguage: string;
  settingsNotifications: string;
  settingsGlassTheme: string;
  resetGlassDefault: string;
  signInTitle: string;
  createAccountTitle: string;
  demoManagerLogin: string;
}

const EN_COPY: UiCopy = {
  navDashboard: 'Dashboard',
  navRooms: 'Storage rooms',
  navInventory: 'Inventory & release',
  navAlerts: 'Alerts & settings',
  navRoomsShort: 'Rooms',
  navInventoryShort: 'Inventory',
  navAlertsShort: 'Alerts',
  darkGlass: 'Dark glass',
  lightGlass: 'Light glass',
  signOut: 'Sign out',
  cooperativeLabel: 'Cooperative',
  roleLabel: 'Role',
  simulatedNotice: 'Simulated data: not live sensor readings',
  updatedLabel: 'Updated',
  autoRefreshLabel: 'Auto-refresh',
  onLabel: 'On',
  offLabel: 'Off',
  activeAlerts: 'Active alerts',
  roomsInRange: 'Rooms in range',
  batchesInStorage: 'Batches in storage',
  releaseWindowOpening: 'Release window opening',
  reviewRecommendations: 'Review recommendations',
  storageRoomsHeading: 'Storage rooms (most severe first)',
  decisionsToday: 'Decisions today: release or hold',
  farmgatePriceHeading: 'Farmgate price vs. release window',
  backToDashboard: 'Back to dashboard',
  equipmentControls: 'Equipment & sensor controls',
  batchesInRoom: 'Batches in this room',
  activeRules: 'Active rules',
  editThresholds: 'Edit thresholds',
  inventoryHeading: 'Inventory & release planner',
  addBatch: 'Add batch',
  filterLabel: 'Filter',
  sortByLabel: 'Sort by',
  batchesHeading: 'Batches',
  recommendationFor: 'Recommendation for batch',
  markAsReleased: 'Mark as released',
  holdBatch: 'Hold batch',
  clearHold: 'Clear hold',
  releaseAction: 'Release',
  alertsSettingsHeading: 'Alerts & settings',
  tabAlertsSim: 'Alerts & Simulator',
  tabSystemSettings: 'System Settings',
  alertLogHeading: 'Alert log',
  simulatorHeading: 'Scenario simulator (for evaluation)',
  runScenario: 'Run scenario',
  thresholdRulesHeading: 'Threshold rules by crop',
  saveRules: 'Save rules',
  resetSource: 'Reset to source values',
  settingsAccount: 'Account',
  settingsLanguage: 'Language',
  settingsNotifications: 'Notifications',
  settingsGlassTheme: 'System theme & optical glass tuner',
  resetGlassDefault: 'Reset to iOS Default',
  signInTitle: 'Sign in',
  createAccountTitle: 'Create account',
  demoManagerLogin: 'Demo Manager Login',
};

const FIL_COPY: UiCopy = {
  navDashboard: 'Buod',
  navRooms: 'Mga silid-imbakan',
  navInventory: 'Imbentaryo at labas',
  navAlerts: 'Alerto at setting',
  navRoomsShort: 'Silid',
  navInventoryShort: 'Imbentaryo',
  navAlertsShort: 'Alerto',
  darkGlass: 'Madilim na salamin',
  lightGlass: 'Maliwanag na salamin',
  signOut: 'Mag-sign out',
  cooperativeLabel: 'Kooperatiba',
  roleLabel: 'Tungkulin',
  simulatedNotice: 'Simulated na datos: hindi live na sensor',
  updatedLabel: 'Na-update',
  autoRefreshLabel: 'Auto-refresh',
  onLabel: 'Bukas',
  offLabel: 'Sarado',
  activeAlerts: 'Mga aktibong alerto',
  roomsInRange: 'Silid na nasa saklaw',
  batchesInStorage: 'Mga batch sa imbakan',
  releaseWindowOpening: 'Bukas na palugit ng labas',
  reviewRecommendations: 'Suriin ang rekomendasyon',
  storageRoomsHeading: 'Mga silid-imbakan (pinakamalala muna)',
  decisionsToday: 'Desisyon ngayon: ilabas o hawakan',
  farmgatePriceHeading: 'Presyo sa bukid vs. palugit ng labas',
  backToDashboard: 'Bumalik sa buod',
  equipmentControls: 'Kontrol ng kagamitan at sensor',
  batchesInRoom: 'Mga batch sa silid na ito',
  activeRules: 'Mga aktibong panuntunan',
  editThresholds: 'I-edit ang mga hangganan',
  inventoryHeading: 'Plano ng imbentaryo at paglabas',
  addBatch: 'Magdagdag ng batch',
  filterLabel: 'Salain',
  sortByLabel: 'Ayusin ayon sa',
  batchesHeading: 'Mga batch',
  recommendationFor: 'Rekomendasyon para sa batch',
  markAsReleased: 'Markahang nailabas',
  holdBatch: 'Hawakan ang batch',
  clearHold: 'Alisin ang hold',
  releaseAction: 'Ilabas',
  alertsSettingsHeading: 'Mga alerto at setting',
  tabAlertsSim: 'Alerto at Simulator',
  tabSystemSettings: 'Mga Setting ng Sistema',
  alertLogHeading: 'Talaan ng alerto',
  simulatorHeading: 'Simulator ng senaryo',
  runScenario: 'Patakbuhin ang senaryo',
  thresholdRulesHeading: 'Mga hangganan bawat pananim',
  saveRules: 'I-save ang panuntunan',
  resetSource: 'Ibalik sa orihinal',
  settingsAccount: 'Account',
  settingsLanguage: 'Wika',
  settingsNotifications: 'Mga Abiso',
  settingsGlassTheme: 'Tema at optical glass tuner',
  resetGlassDefault: 'Ibalik sa iOS Default',
  signInTitle: 'Mag-sign in',
  createAccountTitle: 'Gumawa ng account',
  demoManagerLogin: 'Demo Manager Login',
};

export function getUiCopy(lang: LanguageCode): UiCopy {
  return lang === 'fil' ? FIL_COPY : EN_COPY;
}
