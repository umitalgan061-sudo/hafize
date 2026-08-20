import assert from 'node:assert/strict';
import {
  createDeviceBridgeHandler,
  DEVICE_ACTION_LEDGER_LIMIT,
  DEVICE_ACTION_TTL,
  normalizeDeviceRequest
} from '../desktop/device-bridge-contract.mjs';

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

assert.equal(DEVICE_ACTION_LEDGER_LIMIT, 512);
assert.equal(DEVICE_ACTION_TTL, 5 * 60_000);

const normalizedBrowser = normalizeDeviceRequest({
  operation: 'browser.open',
  args: {
    url: 'https://example.com/path',
    explicitUserIntent: true,
    actionId: id(1).toUpperCase()
  }
});
assert.deepEqual(normalizedBrowser, {
  operation: 'browser.open',
  args: {
    url: 'https://example.com/path',
    explicitUserIntent: true,
    actionId: id(1)
  }
});
assert.equal(Object.isFrozen(normalizedBrowser), true);
assert.equal(Object.isFrozen(normalizedBrowser.args), true);

assert.throws(() => normalizeDeviceRequest({
  operation: 'browser.open',
  args: { url: 'https://example.com', explicitUserIntent: true, actionId: 'not-a-uuid' }
}), /INVALID_DEVICE_ACTION_ID/);
assert.throws(() => normalizeDeviceRequest({
  operation: 'app.open',
  args: { appId: 'spotify', explicitUserIntent: true, actionId: '00000000-0000-1000-8000-000000000001' }
}), /INVALID_DEVICE_ACTION_ID/);
assert.throws(() => normalizeDeviceRequest({
  operation: 'app.open',
  args: { appId: 'spotify', explicitUserIntent: true, actionId: id(1), extra: true }
}), /DEVICE_ACTION_REQUIRES_EXPLICIT_USER_INTENT/);

{
  const calls = [];
  const handler = createDeviceBridgeHandler({
    getSystemInfo: async () => ({}),
    openExternal: async (url) => calls.push(['browser', url]),
    allowedBrowserOrigins: ['https://example.com'],
    appOpeners: { spotify: async () => calls.push(['app', 'spotify']) }
  });

  const browserRequest = {
    operation: 'browser.open',
    args: { url: 'https://example.com/a', explicitUserIntent: true, actionId: id(1) }
  };
  assert.deepEqual(await handler.handle(browserRequest), {
    ok: true,
    value: { opened: true, kind: 'browser' }
  });
  assert.deepEqual(await handler.handle(browserRequest), {
    ok: false,
    error: 'DEVICE_ACTION_REPLAYED'
  });
  assert.deepEqual(calls, [['browser', 'https://example.com/a']]);

  const appRequest = {
    operation: 'app.open',
    args: { appId: 'spotify', explicitUserIntent: true, actionId: id(2) }
  };
  assert.deepEqual(await handler.handle(appRequest), {
    ok: true,
    value: { opened: true, kind: 'app', appId: 'spotify' }
  });
  assert.deepEqual(await handler.handle(appRequest), {
    ok: false,
    error: 'DEVICE_ACTION_REPLAYED'
  });
  assert.deepEqual(calls, [
    ['browser', 'https://example.com/a'],
    ['app', 'spotify']
  ]);
}

{
  const calls = [];
  const handler = createDeviceBridgeHandler({
    getSystemInfo: async () => ({}),
    openExternal: async (url) => calls.push(url),
    allowedBrowserOrigins: ['https://example.com']
  });
  const reusedAcrossCommands = id(10);
  assert.equal((await handler.handle({
    operation: 'browser.open',
    args: { url: 'https://example.com/first', explicitUserIntent: true, actionId: reusedAcrossCommands }
  })).ok, true);
  assert.deepEqual(await handler.handle({
    operation: 'browser.open',
    args: { url: 'https://example.com/second', explicitUserIntent: true, actionId: reusedAcrossCommands }
  }), { ok: false, error: 'DEVICE_ACTION_REPLAYED' });
  assert.deepEqual(calls, ['https://example.com/first']);
}

{
  const calls = [];
  const handler = createDeviceBridgeHandler({
    getSystemInfo: async () => ({}),
    openExternal: async (url) => calls.push(url),
    allowedBrowserOrigins: ['https://example.com']
  });
  const actionId = id(20);
  assert.deepEqual(await handler.handle({
    operation: 'browser.open',
    args: { url: 'https://evil.example/a', explicitUserIntent: true, actionId }
  }), { ok: false, error: 'DEVICE_BROWSER_ORIGIN_NOT_ALLOWED' });
  assert.equal(calls.length, 0);
  assert.equal((await handler.handle({
    operation: 'browser.open',
    args: { url: 'https://example.com/a', explicitUserIntent: true, actionId }
  })).ok, true, 'blocked policy checks must not consume the action id');
  assert.deepEqual(calls, ['https://example.com/a']);
}

{
  const calls = [];
  const handler = createDeviceBridgeHandler({
    getSystemInfo: async () => ({}),
    openExternal: async (url) => {
      calls.push(url);
      throw new Error('platform result ambiguous');
    },
    allowedBrowserOrigins: ['https://example.com']
  });
  const actionId = id(30);
  assert.deepEqual(await handler.handle({
    operation: 'browser.open',
    args: { url: 'https://example.com/ambiguous', explicitUserIntent: true, actionId }
  }), { ok: false, error: 'DEVICE_ACTION_FAILED' });
  assert.deepEqual(await handler.handle({
    operation: 'browser.open',
    args: { url: 'https://example.com/ambiguous', explicitUserIntent: true, actionId }
  }), { ok: false, error: 'DEVICE_ACTION_REPLAYED' });
  assert.equal(calls.length, 1, 'ambiguous side effect must not be blindly retried with the same action id');
}

{
  let now = 1_000;
  const calls = [];
  const handler = createDeviceBridgeHandler({
    getSystemInfo: async () => ({}),
    openExternal: async (url) => calls.push(url),
    allowedBrowserOrigins: ['https://example.com'],
    now: () => now,
    actionTtlMs: 50,
    maxActions: 2
  });
  const request = (actionId, suffix) => ({
    operation: 'browser.open',
    args: { url: `https://example.com/${suffix}`, explicitUserIntent: true, actionId }
  });
  assert.equal((await handler.handle(request(id(40), 'one'))).ok, true);
  assert.equal((await handler.handle(request(id(41), 'two'))).ok, true);
  assert.deepEqual(await handler.handle(request(id(42), 'three')), {
    ok: false,
    error: 'DEVICE_ACTION_LEDGER_FULL'
  });
  assert.deepEqual(calls, ['https://example.com/one', 'https://example.com/two']);

  now += 51;
  assert.equal((await handler.handle(request(id(42), 'three'))).ok, true, 'expired ids are pruned before admitting a new action');
  assert.deepEqual(calls, [
    'https://example.com/one',
    'https://example.com/two',
    'https://example.com/three'
  ]);
}

{
  const handler = createDeviceBridgeHandler({
    getSystemInfo: async () => ({}),
    openExternal: async () => {},
    allowedBrowserOrigins: ['https://example.com'],
    now: () => Number.NaN
  });
  assert.deepEqual(await handler.handle({
    operation: 'browser.open',
    args: { url: 'https://example.com', explicitUserIntent: true, actionId: id(60) }
  }), { ok: false, error: 'INVALID_DEVICE_ACTION_LEDGER_TIME' });
}

assert.throws(() => createDeviceBridgeHandler({
  getSystemInfo: async () => ({}),
  openExternal: async () => {},
  actionTtlMs: 0
}), /INVALID_DEVICE_ACTION_LEDGER_TTL/);
assert.throws(() => createDeviceBridgeHandler({
  getSystemInfo: async () => ({}),
  openExternal: async () => {},
  maxActions: 0
}), /INVALID_DEVICE_ACTION_LEDGER_SIZE/);
assert.throws(() => createDeviceBridgeHandler({
  getSystemInfo: async () => ({}),
  openExternal: async () => {},
  now: null
}), /INVALID_DEVICE_ACTION_LEDGER_NOW/);

console.log('device bridge replay guard tests passed');
