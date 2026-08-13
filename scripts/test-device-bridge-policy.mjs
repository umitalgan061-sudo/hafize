import assert from 'node:assert/strict';
import {
  createDeviceBridgePolicy,
  DEVICE_BRIDGE_OPERATIONS,
  DEVICE_BRIDGE_SYSTEM_INFO_FIELDS
} from '../lib/device-bridge-policy.mjs';

assert.deepEqual(DEVICE_BRIDGE_OPERATIONS, ['system.info', 'browser.open', 'app.open']);
assert.equal(DEVICE_BRIDGE_SYSTEM_INFO_FIELDS.includes('hostname'), false);

const policy = createDeviceBridgePolicy({
  allowedWebOrigins: ['https://www.google.com', 'https://github.com'],
  allowedApps: ['com.google.chrome', 'org.mozilla.firefox'],
  allowedSystemInfo: ['platform', 'arch', 'totalMemory']
});

assert.deepEqual(policy.authorize({
  operation: 'browser.open',
  args: { url: 'https://github.com/umitalgan061-sudo/hafize?tab=readme-ov-file' },
  explicitUserIntent: true
}), {
  ok: true,
  request: {
    operation: 'browser.open',
    args: { url: 'https://github.com/umitalgan061-sudo/hafize?tab=readme-ov-file' }
  }
});

assert.deepEqual(policy.authorize({
  operation: 'app.open', args: { appId: 'com.google.chrome' }, explicitUserIntent: true
}), {
  ok: true,
  request: { operation: 'app.open', args: { appId: 'com.google.chrome' } }
});

assert.deepEqual(policy.authorize({
  operation: 'system.info', args: { fields: ['platform', 'totalMemory'] }, explicitUserIntent: true
}), {
  ok: true,
  request: { operation: 'system.info', args: { fields: ['platform', 'totalMemory'] } }
});

for (const request of [
  { operation: 'browser.open', args: { url: 'https://example.com/' }, explicitUserIntent: true },
  { operation: 'app.open', args: { appId: 'com.unknown.app' }, explicitUserIntent: true },
  { operation: 'system.info', args: { fields: ['cpuCount'] }, explicitUserIntent: true }
]) {
  assert.deepEqual(policy.authorize(request), { ok: false, error: 'DEVICE_BRIDGE_TARGET_NOT_ALLOWED' });
}

assert.deepEqual(policy.authorize({
  operation: 'browser.open', args: { url: 'https://github.com/' }
}), { ok: false, error: 'DEVICE_BRIDGE_REQUIRES_EXPLICIT_USER_INTENT' });

for (const request of [
  null,
  {},
  { operation: 'shell.exec', args: {}, explicitUserIntent: true },
  { operation: 'browser.open', args: { url: 'http://github.com/' }, explicitUserIntent: true },
  { operation: 'browser.open', args: { url: 'javascript:alert(1)' }, explicitUserIntent: true },
  { operation: 'browser.open', args: { url: 'https://user:pass@github.com/' }, explicitUserIntent: true },
  { operation: 'browser.open', args: { url: 'https://github.com/', extra: true }, explicitUserIntent: true },
  { operation: 'app.open', args: { appId: '../calc' }, explicitUserIntent: true },
  { operation: 'system.info', args: { fields: ['hostname'] }, explicitUserIntent: true },
  { operation: 'system.info', args: { fields: [] }, explicitUserIntent: true },
  { operation: 'system.info', args: {}, explicitUserIntent: true, extra: true }
]) {
  const result = policy.authorize(request);
  assert.equal(result.ok, false);
  assert.match(result.error, /^(INVALID_DEVICE_BRIDGE|DEVICE_BRIDGE_)/);
}

assert.throws(() => createDeviceBridgePolicy({
  allowedWebOrigins: ['http://github.com']
}), /INVALID_DEVICE_BRIDGE:allowedWebOrigins/);
assert.throws(() => createDeviceBridgePolicy({
  allowedWebOrigins: ['https://github.com/path']
}), /INVALID_DEVICE_BRIDGE:allowedWebOrigins/);
assert.throws(() => createDeviceBridgePolicy({
  allowedApps: ['Calc App']
}), /INVALID_DEVICE_BRIDGE:allowedApps/);
assert.throws(() => createDeviceBridgePolicy({
  allowedSystemInfo: ['hostname']
}), /INVALID_DEVICE_BRIDGE:allowedSystemInfo/);

const defaults = createDeviceBridgePolicy();
assert.deepEqual(defaults.authorize({
  operation: 'system.info', explicitUserIntent: true
}), {
  ok: true,
  request: { operation: 'system.info', args: { fields: ['platform', 'release', 'arch'] } }
});
assert.deepEqual(defaults.authorize({
  operation: 'browser.open', args: { url: 'https://github.com/' }, explicitUserIntent: true
}), { ok: false, error: 'DEVICE_BRIDGE_TARGET_NOT_ALLOWED' });

console.log('device bridge policy tests passed');
