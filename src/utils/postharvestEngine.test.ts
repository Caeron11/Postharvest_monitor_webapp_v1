import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyScenarioToRooms,
  computeBatchRecommendation,
  computeFacilityKpis,
  evaluateRoomStatus,
  projectScenarioImpact,
  sortRoomsBySeverity,
  syncAlertsWithRooms,
  validateAuthForm,
  validateThresholdRule,
} from './postharvestEngine';
import {
  createInitialState,
  DEFAULT_CROP_RULES,
  INITIAL_BATCHES,
  INITIAL_ROOMS,
} from '../data/seedData';

test('evaluateRoomStatus classifies critical, warning, no_data, and in_range rooms', () => {
  const roomC = INITIAL_ROOMS.find((r) => r.id === 'room-c')!;
  const roomB = INITIAL_ROOMS.find((r) => r.id === 'room-b')!;
  const roomA = INITIAL_ROOMS.find((r) => r.id === 'room-a')!;
  const roomD = INITIAL_ROOMS.find((r) => r.id === 'room-d')!;

  assert.equal(
    evaluateRoomStatus(roomC, DEFAULT_CROP_RULES[roomC.crop]).severity,
    'critical'
  );
  assert.equal(
    evaluateRoomStatus(roomB, DEFAULT_CROP_RULES[roomB.crop]).severity,
    'warning'
  );
  assert.equal(
    evaluateRoomStatus(roomA, DEFAULT_CROP_RULES[roomA.crop]).severity,
    'in_range'
  );
  assert.equal(
    evaluateRoomStatus(roomD, DEFAULT_CROP_RULES[roomD.crop]).severity,
    'no_data'
  );
});

test('sortRoomsBySeverity places critical before warning before no_data before in_range', () => {
  const sorted = sortRoomsBySeverity(
    [...INITIAL_ROOMS].reverse(),
    DEFAULT_CROP_RULES
  );
  assert.deepEqual(
    sorted.map((r) => r.id),
    ['room-c', 'room-b', 'room-d', 'room-a']
  );
});

test('lowering crop tempMax triggers critical breach and generates open alert', () => {
  const stricterRules = {
    ...DEFAULT_CROP_RULES,
    'Highland Lettuce': {
      ...DEFAULT_CROP_RULES['Highland Lettuce'],
      tempMax: 1.0,
    },
  };
  const roomA = INITIAL_ROOMS.find((r) => r.id === 'room-a')!;
  const evalA = evaluateRoomStatus(roomA, stricterRules['Highland Lettuce']);
  assert.equal(evalA.severity, 'critical');
  assert.equal(evalA.tempState, 'above');

  const syncedAlerts = syncAlertsWithRooms(
    INITIAL_ROOMS,
    stricterRules,
    [],
    '06:45'
  );
  const roomAAlert = syncedAlerts.find((a) => a.roomId === 'room-a');
  assert.ok(roomAAlert);
  assert.equal(roomAAlert.severity, 'critical');
  assert.equal(roomAAlert.acknowledged, false);
});

test('validateThresholdRule rejects tempMin >= tempMax and humidityMin >= humidityMax', () => {
  const invalidTemp = validateThresholdRule({
    ...DEFAULT_CROP_RULES.Strawberries,
    tempMin: 5,
    tempMax: 2,
  });
  assert.equal(
    invalidTemp.summary,
    'Error: Temp min must be lower than temp max.'
  );

  const invalidHum = validateThresholdRule({
    ...DEFAULT_CROP_RULES.Strawberries,
    humidityMin: 96,
    humidityMax: 90,
  });
  assert.equal(
    invalidHum.summary,
    'Error: Humidity min must be lower than humidity max.'
  );

  const valid = validateThresholdRule(DEFAULT_CROP_RULES.Strawberries);
  assert.equal(Object.keys(valid).length, 0);
});

test('computeBatchRecommendation returns RELEASE NOW, RELEASE SOON, HOLD, and RELEASED', () => {
  const roomC = INITIAL_ROOMS.find((r) => r.id === 'room-c')!;
  const roomB = INITIAL_ROOMS.find((r) => r.id === 'room-b')!;
  const roomA = INITIAL_ROOMS.find((r) => r.id === 'room-a')!;

  const b1 = computeBatchRecommendation(
    INITIAL_BATCHES[0],
    evaluateRoomStatus(roomC, DEFAULT_CROP_RULES[roomC.crop])
  );
  assert.equal(b1.status, 'release_now');

  const b2 = computeBatchRecommendation(
    INITIAL_BATCHES[1],
    evaluateRoomStatus(roomB, DEFAULT_CROP_RULES[roomB.crop])
  );
  assert.equal(b2.status, 'release_soon');

  const b3 = computeBatchRecommendation(
    INITIAL_BATCHES[2],
    evaluateRoomStatus(roomA, DEFAULT_CROP_RULES[roomA.crop])
  );
  assert.equal(b3.status, 'hold');

  const released = computeBatchRecommendation(
    { ...INITIAL_BATCHES[0], released: true, releasedAt: '06:40' },
    evaluateRoomStatus(roomC, DEFAULT_CROP_RULES[roomC.crop])
  );
  assert.equal(released.status, 'released');
});

test('scenario simulator projects higher risk for equipment_failure than normal and updates rooms', () => {
  const normalProj = projectScenarioImpact(
    INITIAL_ROOMS,
    DEFAULT_CROP_RULES,
    'normal',
    12,
    0,
    70
  );
  const failureProj = projectScenarioImpact(
    INITIAL_ROOMS,
    DEFAULT_CROP_RULES,
    'equipment_failure',
    24,
    3,
    92
  );
  assert.ok(failureProj.spoilageRiskPct > normalProj.spoilageRiskPct);
  assert.ok(failureProj.shelfLifeDeltaDays < 0);

  const normalRooms = applyScenarioToRooms(
    INITIAL_ROOMS,
    DEFAULT_CROP_RULES,
    'normal',
    12,
    0,
    70
  );
  for (const room of normalRooms) {
    assert.equal(
      evaluateRoomStatus(room, DEFAULT_CROP_RULES[room.crop]).severity,
      'in_range'
    );
  }
});

test('computeFacilityKpis stays synchronized across alert ack, room reconnect, and batch release', () => {
  const base = createInitialState();
  const initialKpis = computeFacilityKpis(
    base.rooms,
    base.rules,
    base.batches,
    base.alerts
  );

  assert.equal(initialKpis.totalRoomsCount, 4);
  assert.equal(initialKpis.roomsInRangeCount, 1);
  assert.equal(initialKpis.offlineRoomsCount, 1);
  assert.equal(initialKpis.openAlertsCount, 3);
  assert.equal(initialKpis.criticalAlertsCount, 1);
  assert.equal(initialKpis.activeBatchesCount, base.batches.length);

  // Acknowledge critical alert -> openAlertsCount drops 3 -> 2, criticalAlertsCount 1 -> 0
  const ackedAlerts = base.alerts.map((a) =>
    a.severity === 'critical' ? { ...a, acknowledged: true } : a
  );
  const afterAck = computeFacilityKpis(
    base.rooms,
    base.rules,
    base.batches,
    ackedAlerts
  );
  assert.equal(afterAck.openAlertsCount, 2);
  assert.equal(afterAck.criticalAlertsCount, 0);

  // Reconnect Room D -> roomsInRangeCount rises 1 -> 2, offlineRoomsCount drops 1 -> 0
  const reconnectedRooms = base.rooms.map((r) =>
    r.id === 'room-d' ? { ...r, online: true } : r
  );
  const afterReconnect = computeFacilityKpis(
    reconnectedRooms,
    base.rules,
    base.batches,
    ackedAlerts
  );
  assert.equal(afterReconnect.roomsInRangeCount, 2);
  assert.equal(afterReconnect.offlineRoomsCount, 0);

  // Release B-001 -> activeBatchesCount drops by 1 and totalStorageKg drops by B-001 qty
  const b001 = base.batches[0];
  const afterReleaseBatches = base.batches.map((b) =>
    b.id === b001.id ? { ...b, released: true } : b
  );
  const afterRelease = computeFacilityKpis(
    reconnectedRooms,
    base.rules,
    afterReleaseBatches,
    ackedAlerts
  );
  assert.equal(afterRelease.activeBatchesCount, base.batches.length - 1);
  assert.equal(
    afterRelease.totalStorageKg,
    initialKpis.totalStorageKg - b001.qtyKg
  );
});

test('validateAuthForm validates signin and signup fields with inline errors', () => {
  const invalidEmail = validateAuthForm({
    mode: 'signin',
    email: 'not-an-email',
    password: 'securepassword',
  });
  assert.equal(invalidEmail.valid, false);
  assert.ok(invalidEmail.error?.includes('email'));

  const shortPass = validateAuthForm({
    mode: 'signin',
    email: 'ops@benguetcoop.ph',
    password: '123',
  });
  assert.equal(shortPass.valid, false);
  assert.ok(shortPass.error?.includes('6 characters'));

  const validSignin = validateAuthForm({
    mode: 'signin',
    email: 'ops@benguetcoop.ph',
    password: 'securepassword',
  });
  assert.equal(validSignin.valid, true);

  const missingName = validateAuthForm({
    mode: 'signup',
    fullName: 'A',
    cooperativeName: 'Benguet Highland Cooperative',
    email: 'ops@benguetcoop.ph',
    password: 'securepassword',
  });
  assert.equal(missingName.valid, false);

  const missingCoop = validateAuthForm({
    mode: 'signup',
    fullName: 'Elena Ramos',
    cooperativeName: '',
    email: 'ops@benguetcoop.ph',
    password: 'securepassword',
  });
  assert.equal(missingCoop.valid, false);

  const validSignup = validateAuthForm({
    mode: 'signup',
    fullName: 'Elena Ramos',
    cooperativeName: 'Benguet Highland Cooperative',
    email: 'elena@benguetcoop.ph',
    password: 'securepassword',
  });
  assert.equal(validSignup.valid, true);
});

