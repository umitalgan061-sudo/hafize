import assert from 'node:assert/strict';
import {
  createDeviceBridge,
  DEVICE_BRIDGE_CONTRACT,
  normalizeDeviceBridgeCommand,
  normalizeSystemInfo
} from '../lib/device-bridge-contract.mjs';

assert.deepEqual(normalizeDeviceBridgeCommand({ action: 'system.info' }), {
  ok: true,
  command: { action: 'system.info' }
});
assert.deepEqual(normalizeDeviceBridgeCommand({
  action: 'browser.open',
  explicitUserIntent: true,
  url: 'https://example.com/path?q=1'
}), {
  ok: true,
  command: {
    action: 'browser.open',
    url: 'https://example.com/path?q=1'
  }
});
assert.deepEqual(normalizeDeviceBridgeCommand({
  action: 'app.open',
  explicitUserIntent: true,
  appId: 'Browser.Chrome'
}), {
  ok: true,
  command: { action: 'app.open', appId: 'browser.chrome' }
});

for (const invalid of [
  null,
  { action: 'shell.run', explicitUserIntent: true },
  { action: 'browser.open', url: 'https://example.com' },
  { action: 'browser.open', explicitUserIntent: true, url: 'http://example.com' },
  { action: 'browser.open', explicitUserIntent: true, url: 'https://user:pass@example.com' },
  { action: 'browser.open', explicitUserIntent: true, url: 'not-a-url' },
  { action: 'app.open', explicitUserIntent: true, appId: '../calc' },
  { action: 'system.info', url: 'https://example.com' },
  { action: 'system.info', arbitrary: true }
]) {
  assert.equal(normalizeDeviceBridgeCommand(invalid).ok, false);
}

assert.deepEqual(normalizeSystemInfo({
  platform: 'darwin',
  arch: 'arm64',
  release: '25.0.0',
  hostname: 'hafize-mac'
}), {
  ok: true,
  info: {
    platform: 'darwin',
    arch: 'arm64',
    release: '25.0.0',
    hostname: 'hafize-mac'
  }
});
assert.equal(normalizeSystemInfo({ platform: 'darwin' }).ok, false);
assert.equal(normalizeSystemInfo({ platform: 'darwin', arch: 'arm64', username: 'umit' }).ok, false);

const calls = [];
const bridge = createDeviceBridge({
  allowedApps: ['browser.chrome', 'editor.vscode'],
  systemInfo: async () => ({
    platform: 'win32',
    arch: 'x64',
    release: '10.0.99999',
    hostname: 'desktop'
  }),
  openExternal: async (url) => calls.push(['external', url]),
  openApp: async (appId) => calls.push(['app', appId])
});

assert.deepEqual(bridge.allowedApps, ['browser.chrome', 'editor.vscode']);
assert.deepEqual(await bridge.execute({ action: 'system.info' }), {
  ok: true,
  action: 'system.info',
  info: {
    platform: 'win32',
    arch: 'x64',
    release: '10.0.99999',
    hostname: 'desktop'
  }
});
assert.deepEqual(await bridge.execute({
  action: 'browser.open',
  explicitUserIntent: true,
  url: 'https://openai.com/'
}), {
  ok: true,
  action: 'browser.open'
});
assert.deepEqual(await bridge.execute({
  action: 'app.open',
  explicitUserIntent: true,
  appId: 'browser.chrome'
}), {
  ok: true,
  action: 'app.open',
  appId: 'browser.chrome'
});
assert.deepEqual(calls, [
  ['external', 'https://openai.com/'],
  ['app', 'browser.chrome']
]);

assert.deepEqual(await bridge.execute({
  action: 'app.open',
  explicitUserIntent: true,
  appId: 'terminal'
}), {
  ok: false,
  error: 'DEVICE_BRIDGE_APP_NOT_ALLOWED'
});
assert.equal(calls.length, 2);

const noIntent = await bridge.execute({ action: 'app.open', appId: 'browser.chrome' });
assert.deepEqual(noIntent, {
  ok: false,
  error: 'DEVICE_BRIDGE_ACTION_REQUIRES_EXPLICIT_USER_INTENT'
});
assert.equal(calls.length, 2);

const failingBridge = createDeviceBridge({
  allowedApps: [],
  systemInfo: async () => { throw new Error('SYSTEM_INFO_FAILED'); },
  openExternal: async () => { throw new Error('OPEN_EXTERNAL_FAILED'); },
  openApp: async () => { throw new Error('OPEN_APP_FAILED'); }
});
assert.deepEqual(await failingBridge.execute({ action: 'system.info' }), {
  ok: false,
  error: 'SYSTEM_INFO_FAILED'
});
assert.deepEqual(await failingBridge.execute({
  action: 'browser.open',
  explicitUserIntent: true,
  url: 'https://example.com'
}), {
  ok: false,
  error: 'OPEN_EXTERNAL_FAILED'
});

for (const options of [
  {},
  { systemInfo: async () => ({}) },
  { systemInfo: async () => ({}), openExternal: async () => {} },
  {
    systemInfo: async () => ({}),
    openExternal: async () => {},
    openApp: async () => {},
    allowedApps: 'browser.chrome'
  }
]) {
  assert.throws(() => createDeviceBridge(options), /INVALID_DEVICE_BRIDGE/);
}

assert.equal(DEVICE_BRIDGE_CONTRACT.shellExecutionAllowed, false);
assert.deepEqual(DEVICE_BRIDGE_CONTRACT.browserProtocols, ['https:']);
assert.equal(DEVICE_BRIDGE_CONTRACT.actions.includes('shell.run'), false);

console.log('device bridge contract tests passed');
