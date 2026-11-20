import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRoutePath, parseRoutePath } from './routeSync';

const ROOM_IDS = ['room-c', 'room-b', 'room-a', 'room-d'];

test('parseRoutePath resolves all four application routes and room deep-links', () => {
  assert.deepEqual(parseRoutePath('/', ROOM_IDS), { view: 'dashboard' });
  assert.deepEqual(parseRoutePath('/dashboard/', ROOM_IDS), {
    view: 'dashboard',
  });
  assert.deepEqual(parseRoutePath('/rooms', ROOM_IDS), { view: 'rooms' });
  assert.deepEqual(parseRoutePath('/rooms/room-b', ROOM_IDS), {
    view: 'rooms',
    roomId: 'room-b',
  });
  assert.deepEqual(parseRoutePath('/rooms/unknown-room', ROOM_IDS), {
    view: 'rooms',
  });
  assert.deepEqual(parseRoutePath('/inventory', ROOM_IDS), {
    view: 'inventory',
  });
  assert.deepEqual(parseRoutePath('/alerts', ROOM_IDS), { view: 'alerts' });
  assert.equal(parseRoutePath('/nonexistent', ROOM_IDS), null);
});

test('buildRoutePath constructs canonical SPA URLs', () => {
  assert.equal(buildRoutePath('dashboard'), '/');
  assert.equal(buildRoutePath('rooms', 'room-c'), '/rooms/room-c');
  assert.equal(buildRoutePath('rooms'), '/rooms');
  assert.equal(buildRoutePath('inventory'), '/inventory');
  assert.equal(buildRoutePath('alerts'), '/alerts');
});
