import assert from 'node:assert/strict';
import { createDeviceBridgeHandler } from '../desktop/device-bridge-contract.mjs';

const ACTION = '20000000-0000-4000-8000-000000000001';
const SECOND_ACTION = '20000000-0000-4000-8000-000000000002';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

{
  const gate = deferred();
  const calls = [];
  const handler = createDeviceBridgeHandler({
    getSystemInfo: async () => ({}),
    allowedBrowserOrigins: ['https://example.com'],
    openExternal: async (url) => {
      calls.push(url);
      await gate.promise;
    }
  });
  const request = {
    operation: 'browser.open',
    args: {
      url: 'https://example.com/concurrent',
      explicitUserIntent: true,
      actionId: ACTION
    }
  };

  const first = handler.handle(request);
  await Promise.resolve();
  assert.deepEqual(calls, ['https://example.com/concurrent']);

  const duplicate = await handler.handle(request);
  assert.deepEqual(duplicate, { ok: false, error: 'DEVICE_ACTION_REPLAYED' });
  assert.equal(calls.length, 1, 'duplicate arriving while the first opener is unresolved cannot start a second side effect');

  gate.resolve();
  assert.deepEqual(await first, {
    ok: true,
    value: { opened: true, kind: 'browser' }
  });
}

{
  const firstGate = deferred();
  const secondGate = deferred();
  const calls = [];
  const handler = createDeviceBridgeHandler({
    getSystemInfo: async () => ({}),
    allowedBrowserOrigins: ['https://example.com'],
    openExternal: async (url) => {
      calls.push(url);
      if (url.endsWith('/one')) await firstGate.promise;
      if (url.endsWith('/two')) await secondGate.promise;
    }
  });

  const first = handler.handle({
    operation: 'browser.open',
    args: { url: 'https://example.com/one', explicitUserIntent: true, actionId: ACTION }
  });
  const second = handler.handle({
    operation: 'browser.open',
    args: { url: 'https://example.com/two', explicitUserIntent: true, actionId: SECOND_ACTION }
  });
  await Promise.resolve();
  assert.deepEqual(calls.sort(), [
    'https://example.com/one',
    'https://example.com/two'
  ]);

  firstGate.resolve();
  secondGate.resolve();
  assert.equal((await first).ok, true);
  assert.equal((await second).ok, true);
}

{
  const gate = deferred();
  let appCalls = 0;
  const handler = createDeviceBridgeHandler({
    getSystemInfo: async () => ({}),
    openExternal: async () => {},
    appOpeners: {
      spotify: async () => {
        appCalls += 1;
        await gate.promise;
      }
    }
  });
  const request = {
    operation: 'app.open',
    args: { appId: 'spotify', explicitUserIntent: true, actionId: ACTION }
  };

  const first = handler.handle(request);
  await Promise.resolve();
  assert.equal(appCalls, 1);
  assert.deepEqual(await handler.handle(request), {
    ok: false,
    error: 'DEVICE_ACTION_REPLAYED'
  });
  assert.equal(appCalls, 1);
  gate.resolve();
  assert.deepEqual(await first, {
    ok: true,
    value: { opened: true, kind: 'app', appId: 'spotify' }
  });
}

{
  let systemReads = 0;
  const handler = createDeviceBridgeHandler({
    getSystemInfo: async () => {
      systemReads += 1;
      return { platform: 'linux', arch: 'x64', appVersion: '1', cpuCount: 8, totalMemoryMb: 1024 };
    },
    openExternal: async () => {},
    allowedBrowserOrigins: ['https://example.com'],
    maxActions: 1
  });

  for (let index = 0; index < 20; index += 1) {
    assert.equal((await handler.handle({ operation: 'system.info', args: {} })).ok, true);
    assert.equal((await handler.handle({ operation: 'capabilities.read', args: {} })).ok, true);
  }
  assert.equal(systemReads, 20);

  assert.equal((await handler.handle({
    operation: 'browser.open',
    args: { url: 'https://example.com/one', explicitUserIntent: true, actionId: ACTION }
  })).ok, true);
  assert.deepEqual(await handler.handle({
    operation: 'browser.open',
    args: { url: 'https://example.com/two', explicitUserIntent: true, actionId: SECOND_ACTION }
  }), { ok: false, error: 'DEVICE_ACTION_LEDGER_FULL' });
}

{
  const calls = [];
  const handler = createDeviceBridgeHandler({
    getSystemInfo: async () => ({}),
    openExternal: async (url) => calls.push(url),
    allowedBrowserOrigins: ['https://example.com']
  });
  const malformed = {
    operation: 'browser.open',
    args: { url: 'https://example.com/a', explicitUserIntent: true, actionId: 'bad' }
  };
  for (let index = 0; index < 5; index += 1) {
    assert.deepEqual(await handler.handle(malformed), { ok: false, error: 'INVALID_DEVICE_ACTION_ID' });
  }
  assert.equal(calls.length, 0);
  assert.equal((await handler.handle({
    operation: 'browser.open',
    args: { url: 'https://example.com/a', explicitUserIntent: true, actionId: ACTION }
  })).ok, true, 'malformed requests never consume replay capacity');
}

console.log('device bridge concurrent replay tests passed');
