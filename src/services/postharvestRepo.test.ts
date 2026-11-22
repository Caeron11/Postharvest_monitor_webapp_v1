import assert from 'node:assert/strict';
import test from 'node:test';
import {
  slugifyCooperativeId,
  type AlertRow,
  type BatchRow,
  type StorageRoomRow,
} from '../lib/supabase';
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
    id: 'benguet-highland-room-a',
    cooperative_id: 'benguet-highland',
    cooperative_name: 'Benguet Highland',
    name: 'Room A',
    crop: 'Broccoli',
    temp_c: 4.6,
    humidity_pct: 96.0,
    co2_ppm: 390,
    gas_index: 180,
    min_temp: 0.0,
    max_temp: 2.0,
    min_humidity: 95,
    max_humidity: 98,
    co2_max: 450,
    gas_index_max: 200,
    equipment_mode: 'boost',
    defrost_active: true,
    sensor_online: true,
    updated_at: '2026-11-21T06:30:00.000Z',
  };

  const mapped = mapStorageRoomRow(row);
  assert.equal(mapped.id, 'benguet-highland-room-a');
  assert.equal(mapped.name, 'Room A');
  assert.equal(mapped.crop, 'Broccoli');
  assert.equal(mapped.tempC, 4.6);
  assert.equal(mapped.co2Ppm, 390);
  assert.equal(mapped.gasIndex, 180);
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
    room_id: 'benguet-highland-room-a',
    rack_id: 'R1',
    crop: 'Broccoli',
    quantity_kg: 420,
    shelf_life_days: 2,
    shelf_life_limit: 14,
    current_price_php: 158,
    target_price_php: 145,
    status: 'hold',
    release_note: 'Inspecting crates',
    created_at: '2026-11-16T08:00:00.000Z',
  };

  const mappedHold = mapBatchRow(holdRow);
  assert.equal(mappedHold.crop, 'Broccoli');
  assert.equal(mappedHold.shelfLifeLimitDays, 14);
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
    id: 'coop-room-c',
    cooperative_id: 'coop',
    cooperative_name: 'Coop',
    name: 'Room C',
    crop: 'Tomato',
    temp_c: 15.4,
    humidity_pct: 88.0,
    co2_ppm: 485,
    gas_index: 215,
    min_temp: 10.0,
    max_temp: 13.0,
    min_humidity: 90,
    max_humidity: 95,
    co2_max: 450,
    gas_index_max: 200,
    equipment_mode: 'boost',
    defrost_active: false,
    sensor_online: true,
    updated_at: '2026-11-21T06:00:00.000Z',
  });

  const alertRow: AlertRow = {
    id: '00000000-0000-0000-0000-000000000001',
    cooperative_id: 'coop',
    room_id: 'coop-room-c',
    type: 'Temperature high',
    severity: 'critical',
    message:
      'Room C temperature above range (15.4 °C, accelerated ripening risk; CO2 485 ppm, C2H4 215 ppm)',
    acknowledged: false,
    created_at: '2026-11-21T06:18:00.000Z',
  };

  const mapped = mapAlertRow(alertRow, [room]);
  assert.equal(mapped.roomName, 'Room C');
  assert.equal(mapped.metric, 'temperature');
  assert.equal(mapped.severity, 'critical');
  assert.equal(mapped.acknowledged, false);
});

test('extractRulesFromRooms hydrates Tomato and Broccoli RRL threshold rules from room rows', () => {
  const rows: StorageRoomRow[] = [
    {
      id: 'coop-room-c',
      cooperative_id: 'coop',
      cooperative_name: 'Coop',
      name: 'Room C',
      crop: 'Tomato',
      temp_c: 11.4,
      humidity_pct: 92,
      co2_ppm: 380,
      gas_index: 85,
      min_temp: 10.0,
      max_temp: 13.0,
      min_humidity: 90,
      max_humidity: 95,
      co2_max: 450,
      gas_index_max: 200,
      equipment_mode: 'auto',
      defrost_active: false,
      sensor_online: true,
      updated_at: '2026-11-21T06:00:00.000Z',
    },
  ];

  const rules = extractRulesFromRooms(rows);
  assert.equal(rules.Tomato.tempMin, 10.0);
  assert.equal(rules.Tomato.tempMax, 13.0);
  assert.equal(rules.Tomato.humidityMin, 90);
  assert.equal(rules.Tomato.humidityMax, 95);
  assert.equal(rules.Tomato.co2Max, 450);
  assert.equal(rules.Tomato.gasIndexMax, 200);
});
