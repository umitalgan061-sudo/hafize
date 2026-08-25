import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  MICROPHONE_DEVICE_REASON,
  createRevokeEvent,
  hasAudioInput
} = require('../public/hands-free-background-guard.js');

const privateInventory = [
  {
    kind: 'audioinput',
    label: 'Ümit private USB microphone',
    deviceId: 'private-microphone-device-id',
    groupId: 'private-hardware-group-id'
  },
  {
    kind: 'videoinput',
    label: 'Private camera',
    deviceId: 'private-camera-device-id',
    groupId: 'private-camera-group-id'
  }
];

assert.equal(hasAudioInput(privateInventory), true);
assert.equal(
  hasAudioInput(privateInventory.map((device) => ({ ...device, kind: device.kind === 'audioinput' ? 'audiooutput' : device.kind }))),
  false
);

class FakeCustomEvent {
  constructor(type, options = {}) {
    this.type = type;
    this.detail = options.detail;
  }
}

const event = createRevokeEvent({ CustomEvent: FakeCustomEvent }, MICROPHONE_DEVICE_REASON);
assert.deepEqual(
  Object.keys(event.detail).sort(),
  ['reason', 'source'],
  'revoke metadata is intentionally narrower than the browser device inventory'
);
assert.equal(event.detail.reason, MICROPHONE_DEVICE_REASON);
assert.equal(event.detail.source, 'hands-free-background-guard');
assert.equal(Object.isFrozen(event.detail), true);

const serialized = JSON.stringify(event.detail);
for (const forbidden of [
  'Ümit private USB microphone',
  'private-microphone-device-id',
  'private-hardware-group-id',
  'Private camera',
  'private-camera-device-id',
  'private-camera-group-id',
  'deviceId',
  'groupId',
  'label'
]) {
  assert.equal(serialized.includes(forbidden), false, `revoke metadata must redact ${forbidden}`);
}

const fallbackEvent = createRevokeEvent({}, MICROPHONE_DEVICE_REASON);
assert.deepEqual(Object.keys(fallbackEvent.detail).sort(), ['reason', 'source']);
assert.equal(Object.isFrozen(fallbackEvent.detail), true);

console.log('hands-free microphone device redaction tests passed');