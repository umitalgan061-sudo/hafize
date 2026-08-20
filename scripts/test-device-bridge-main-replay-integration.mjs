import assert from 'node:assert/strict';
import { registerElectronDeviceBridge } from '../desktop/device-bridge-main.mjs';
import { DEVICE_BRIDGE_CHANNEL } from '../desktop/device-bridge-contract.mjs';

const ACTION_A = '30000000-0000-4000-8000-000000000001';
const ACTION_B = '30000000-0000-4000-8000-000000000002';
const ACTION_C = '30000000-0000-4000-8000-000000000003';

let ipcHandler;
const removed = [];
const externalCalls = [];
const appCalls = [];
const ipcMain = {
  handle(channel, handler) {
    assert.equal(channel, DEVICE_BRIDGE_CHANNEL);
    assert.equal(ipcHandler, undefined);
    ipcHandler = handler;
  },
  removeHandler(channel) { removed.push(channel); }
};

const registration = registerElectronDeviceBridge({
  ipcMain,
  shell: {
    async openExternal(url) { externalCalls.push(url); }
  },
  app: { getVersion: () => '2.0.0' },
  osModule: {
    platform: () => 'linux',
    arch: () => 'x64',
    cpus: () => [{}, {}],
    totalmem: () => 4 * 1024 * 1024 * 1024
  },
  allowedBrowserOrigins: ['https://example.com'],
  appOpeners: {
    spotify: async () => appCalls.push('spotify')
  },
  isTrustedSender: (event) => event?.mainFrame === true
});

assert.equal(typeof ipcHandler, 'function');
assert.deepEqual(registration.allowedBrowserOrigins, ['https://example.com']);
assert.deepEqual(registration.allowedApps, ['spotify']);

const untrusted = await ipcHandler({ mainFrame: false }, {
  operation: 'browser.open',
  args: {
    url: 'https://example.com/untrusted',
    explicitUserIntent: true,
    actionId: ACTION_A
  }
});
assert.deepEqual(untrusted, { ok: false, error: 'DEVICE_RENDERER_NOT_TRUSTED' });
assert.equal(externalCalls.length, 0);

const firstBrowser = await ipcHandler({ mainFrame: true }, {
  operation: 'browser.open',
  args: {
    url: 'https://example.com/first',
    explicitUserIntent: true,
    actionId: ACTION_A
  }
});
assert.deepEqual(firstBrowser, { ok: true, value: { opened: true, kind: 'browser' } });
assert.deepEqual(externalCalls, ['https://example.com/first']);

const duplicateBrowser = await ipcHandler({ mainFrame: true }, {
  operation: 'browser.open',
  args: {
    url: 'https://example.com/second',
    explicitUserIntent: true,
    actionId: ACTION_A
  }
});
assert.deepEqual(duplicateBrowser, { ok: false, error: 'DEVICE_ACTION_REPLAYED' });
assert.deepEqual(externalCalls, ['https://example.com/first']);

const appResult = await ipcHandler({ mainFrame: true }, {
  operation: 'app.open',
  args: {
    appId: 'spotify',
    explicitUserIntent: true,
    actionId: ACTION_B
  }
});
assert.deepEqual(appResult, { ok: true, value: { opened: true, kind: 'app', appId: 'spotify' } });
assert.deepEqual(appCalls, ['spotify']);

const crossOperationReplay = await ipcHandler({ mainFrame: true }, {
  operation: 'browser.open',
  args: {
    url: 'https://example.com/cross-operation',
    explicitUserIntent: true,
    actionId: ACTION_B
  }
});
assert.deepEqual(crossOperationReplay, { ok: false, error: 'DEVICE_ACTION_REPLAYED' });
assert.deepEqual(externalCalls, ['https://example.com/first']);

const blockedApp = await ipcHandler({ mainFrame: true }, {
  operation: 'app.open',
  args: {
    appId: 'terminal',
    explicitUserIntent: true,
    actionId: ACTION_C
  }
});
assert.deepEqual(blockedApp, { ok: false, error: 'DEVICE_APP_NOT_ALLOWED' });
assert.deepEqual(appCalls, ['spotify']);

const browserAfterBlockedApp = await ipcHandler({ mainFrame: true }, {
  operation: 'browser.open',
  args: {
    url: 'https://example.com/after-policy-block',
    explicitUserIntent: true,
    actionId: ACTION_C
  }
});
assert.equal(browserAfterBlockedApp.ok, true, 'policy rejection must happen before action id consumption');
assert.deepEqual(externalCalls, [
  'https://example.com/first',
  'https://example.com/after-policy-block'
]);

registration.dispose();
assert.deepEqual(removed, [DEVICE_BRIDGE_CHANNEL]);
assert.deepEqual(await ipcHandler({ mainFrame: true }, {
  operation: 'browser.open',
  args: {
    url: 'https://example.com/after-dispose',
    explicitUserIntent: true,
    actionId: '30000000-0000-4000-8000-000000000004'
  }
}), { ok: false, error: 'DEVICE_BRIDGE_NOT_ACTIVE' });
assert.equal(externalCalls.length, 2, 'disposed registration cannot perform side effects');

console.log('device bridge main replay integration tests passed');
