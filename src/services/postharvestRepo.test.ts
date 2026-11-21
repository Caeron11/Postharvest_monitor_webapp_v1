import assert from 'node:assert/strict';
import test from 'node:test';
import { slugifyCooperativeId, type AlertRow, type BatchRow, type StorageRoomRow } from '../lib/supabase';
import {
  extractRulesFromRooms,
  mapAlertRow,
  mapBatchRow,
  mapStorageRoomRow,
} from './postharvestRepo';

test('slugifyCooperativeId normalizes cooperative names and falls back cleanly', () => {
  assert.equal(slugifyCooperativeId('Benguet Highland'), 'benguet-highland');
  assert.equal(
    slugifyCooperativeId('  La Trinidad / Cold Storage #2  '),
    'la-trinidad-cold-storage-2'
  );
  assert.equal(slugifyCooperativeId('   '), 'benguet-highland');
});

test('mapStorageRoomRow converts PostgreSQL row to StorageRoom with racks and history', () => {
  const row: StorageRoomRow = {
    id: 'benguet-highland-room-c',
    cooperative_id: 'benguet-highland',
    cooperative_name: 'Benguet Highland',
    name: 'Room C',
    crop: 'Strawberries',
    temp_c: 4.8,
    humidity_pct: 91.4,
    co2_ppm: 620,
    gas_index: 2.7,
    min_temp: 0,
    max_temp: 2,
    min_humidity: 90,
    max_humidity: 95,
    co2_max: 1000,
    gas_index_max: 3,
    equipment_mode: 'boost',
    defrost_active: true,
    sensor_online: true,
    updated_at: '2026-11-21T06:30:00.000Z',
  };

  const mapped = mapStorageRoomRow(row);
  assert.equal(mapped.id, 'benguet-highland-room-c');
  assert.equal(mapped.name, 'Room C');
  assert.equal(mapped.crop, 'Strawberries');
  assert.equal(mapped.tempC, 4.8);
  assert.equal(mapped.compressorMode, 'boost');
  assert.equal(mapped.defrostActive, true);
  assert.equal(mapped.online, true);
  assert.equal(mapped.gasRising, true);
  assert.ok(mapped.racks.length > 0);
  assert.ok(mapped.history24h.length > 0);
});

test('mapBatchRow maps hold and released status flags accurately', () => {
  const holdRow: BatchRow = {
    id: 'benguet-highland-B-001',
    cooperative_id: 'benguet-highland',
    room_id: 'benguet-highland-room-c',
    rack_id: 'R1',
    crop: 'Strawberries',
    quantity_kg: 420,
    shelf_life_days: 2,
    shelf_life_limit: 5,
    current_price_php: 285,
    target_price_php: 260,
    status: 'hold',
    release_note: 'Inspecting crates',
    created_at: '2026-11-16T08:00:00.000Z',
  };

  const mappedHold = mapBatchRow(holdRow);
  assert.equal(mappedHold.manualHold, true);
  assert.equal(mappedHold.released, false);
  assert.equal(mappedHold.harvestedDate, '2026-11-16');
  assert.equal(mappedHold.releaseNote, 'Inspecting crates');

  const releasedRow: BatchRow = { ...holdRow, status: 'released' };
  const mappedReleased = mapBatchRow(releasedRow);
  assert.equal(mappedReleased.manualHold, false);
  assert.equal(mappedReleased.released, true);
  assert.ok(mappedReleased.releasedAt);
});

test('mapAlertRow resolves room name and metric category', () => {
  const room = mapStorageRoomRow({
    id: 'coop-room-b',
    cooperative_id: 'coop',
    cooperative_name: 'Coop',
    name: 'Room B',
    crop: 'Bell Peppers',
    temp_c: 8.2,
    humidity_pct: 86.4,
    co2_ppm: 480,
    gas_index: 1.4,
    min_temp: 7,
    max_temp: 10,
    min_humidity: 90,
    max_humidity: 95,
    co2_max: 900,
    gas_index_max: 2.5,
    equipment_mode: 'auto',
    defrost_active: false,
    sensor_online: true,
    updated_at: '2026-11-21T06:00:00.000Z',
  });

  const alertRow: AlertRow = {
    id: '00000000-0000-0000-0000-000000000001',
    cooperative_id: 'coop',
    room_id: 'coop-room-b',
    type: 'Humidity near limit',
    severity: 'warning',
    message: 'Room B humidity outside 90-95%',
    acknowledged: false,
    created_at: '2026-11-21T05:52:00.000Z',
  };

  const mapped = mapAlertRow(alertRow, [room]);
  assert.equal(mapped.roomName, 'Room B');
  assert.equal(mapped.metric, 'humidity');
  assert.equal(mapped.severity, 'warning');
  assert.equal(mapped.acknowledged, false);
});

test('extractRulesFromRooms hydrates crop threshold rules from room rows', () => {
  const rows: StorageRoomRow[] = [
    {
      id: 'coop-room-c',
      cooperative_id: 'coop',
      cooperative_name: 'Coop',
      name: 'Room C',
      crop: 'Strawberries',
      temp_c: 1.5,
      humidity_pct: 92,
      co2_ppm: 500,
      gas_index: 1.0,
      min_temp: 0.5,
      max_temp: 2.5,
      min_humidity: 88,
      max_humidity: 94,
      co2_max: 950,
      gas_index_max: 2.8,
      equipment_mode: 'auto',
      defrost_active: false,
      sensor_online: true,
      updated_at: '2026-11-21T06:00:00.000Z',
    },
  ];

  const rules = extractRulesFromRooms(rows);
  assert.equal(rules.Strawberries.tempMin, 0.5);
  assert.equal(rules.Strawberries.tempMax, 2.5);
  assert.equal(rules.Strawberries.humidityMin, 88);
  assert.equal(rules.Strawberries.co2Max, 950);
  assert.equal(rules.Strawberries.gasIndexMax, 2.8);
});
