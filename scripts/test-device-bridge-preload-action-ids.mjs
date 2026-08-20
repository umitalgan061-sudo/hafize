import assert from 'node:assert/strict';
import { DEVICE_BRIDGE_CHANNEL } from '../desktop/device-bridge-contract.mjs';
import { exposeDeviceBridge } from '../desktop/device-bridge-preload.mjs';

const IDS = [
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000003'
];

function fixture({ gesture = true, ids = [...IDS] } = {}) {
  const exposures = [];
  const invocations = [];
  const api = exposeDeviceBridge({
    contextBridge: {
      exposeInMainWorld(name, value) { exposures.push({ name, value }); }
    },
    ipcRenderer: {
      invoke(channel, request) {
        invocations.push({ channel, request });
        return Promise.resolve({ ok: true, value: request.operation });
      }
    },
    hasActiveUserGesture: () => gesture,
    createActionId: () => ids.shift()
  });
  return { api, exposures, invocations, ids };
}

{
  const f = fixture();
  assert.equal(f.exposures.length, 1);
  assert.equal(f.exposures[0].name, 'hafizeDevice');
  assert.equal(f.exposures[0].value, f.api);
  assert.equal(Object.isFrozen(f.api), true);

  await f.api.getSystemInfo();
  await f.api.getCapabilities();
  assert.deepEqual(f.invocations, [
    { channel: DEVICE_BRIDGE_CHANNEL, request: { operation: 'system.info', args: {} } },
    { channel: DEVICE_BRIDGE_CHANNEL, request: { operation: 'capabilities.read', args: {} } }
  ]);
  assert.equal(f.ids.length, 3, 'read-only bridge calls must not spend action ids');
}

{
  const f = fixture();
  await f.api.openBrowser('https://example.com/a');
  await f.api.openBrowser('https://example.com/b');
  await f.api.openApp('spotify');
  assert.deepEqual(f.invocations, [
    {
      channel: DEVICE_BRIDGE_CHANNEL,
      request: {
        operation: 'browser.open',
        args: {
          url: 'https://example.com/a',
          explicitUserIntent: true,
          actionId: IDS[0]
        }
      }
    },
    {
      channel: DEVICE_BRIDGE_CHANNEL,
      request: {
        operation: 'browser.open',
        args: {
          url: 'https://example.com/b',
          explicitUserIntent: true,
          actionId: IDS[1]
        }
      }
    },
    {
      channel: DEVICE_BRIDGE_CHANNEL,
      request: {
        operation: 'app.open',
        args: {
          appId: 'spotify',
          explicitUserIntent: true,
          actionId: IDS[2]
        }
      }
    }
  ]);
  assert.equal(new Set(f.invocations.map((entry) => entry.request.args.actionId)).size, 3, 'every user action receives a distinct id');
}

{
  const f = fixture({ gesture: false });
  assert.deepEqual(await f.api.openBrowser('https://example.com'), {
    ok: false,
    error: 'DEVICE_ACTION_REQUIRES_ACTIVE_USER_GESTURE'
  });
  assert.deepEqual(await f.api.openApp('spotify'), {
    ok: false,
    error: 'DEVICE_ACTION_REQUIRES_ACTIVE_USER_GESTURE'
  });
  assert.equal(f.invocations.length, 0, 'no IPC request may be emitted without a live user gesture');
  assert.equal(f.ids.length, 3, 'gesture rejection must happen before action-id allocation');
}

{
  const invocations = [];
  const api = exposeDeviceBridge({
    contextBridge: { exposeInMainWorld() {} },
    ipcRenderer: {
      invoke(channel, request) {
        invocations.push({ channel, request });
        return Promise.resolve({ ok: true });
      }
    },
    hasActiveUserGesture: () => true,
    createActionId: () => undefined
  });
  assert.deepEqual(await api.openBrowser('https://example.com'), {
    ok: false,
    error: 'DEVICE_ACTION_ID_UNAVAILABLE'
  });
  assert.equal(invocations.length, 0, 'missing secure action id fails closed before IPC');
}

{
  const invocations = [];
  const api = exposeDeviceBridge({
    contextBridge: { exposeInMainWorld() {} },
    ipcRenderer: {
      invoke(channel, request) {
        invocations.push({ channel, request });
        return Promise.resolve({ ok: true });
      }
    },
    hasActiveUserGesture: () => true,
    createActionId() { throw new Error('random source unavailable'); }
  });
  assert.deepEqual(await api.openApp('spotify'), {
    ok: false,
    error: 'DEVICE_ACTION_ID_UNAVAILABLE'
  });
  assert.equal(invocations.length, 0, 'action-id generation exceptions do not reach IPC');
}

{
  let gesture = true;
  let generated = 0;
  const invocations = [];
  const api = exposeDeviceBridge({
    contextBridge: { exposeInMainWorld() {} },
    ipcRenderer: {
      invoke(channel, request) {
        invocations.push({ channel, request });
        return Promise.resolve({ ok: true });
      }
    },
    hasActiveUserGesture: () => gesture,
    createActionId() {
      generated += 1;
      return IDS[generated - 1];
    }
  });
  await api.openBrowser('https://example.com/first');
  gesture = false;
  const blocked = await api.openBrowser('https://example.com/blocked');
  gesture = true;
  await api.openBrowser('https://example.com/second');
  assert.deepEqual(blocked, { ok: false, error: 'DEVICE_ACTION_REQUIRES_ACTIVE_USER_GESTURE' });
  assert.equal(generated, 2);
  assert.deepEqual(invocations.map((entry) => entry.request.args.actionId), [IDS[0], IDS[1]]);
}

assert.throws(() => exposeDeviceBridge({
  contextBridge: { exposeInMainWorld() {} },
  ipcRenderer: { invoke() {} },
  createActionId: null
}), /INVALID_DEVICE_PRELOAD:actionId/);

console.log('device bridge preload action-id tests passed');
