import assert from 'node:assert/strict';
import { createDeviceBridgeHandler, DEVICE_BRIDGE_CHANNEL, normalizeDeviceRequest } from '../desktop/device-bridge-contract.mjs';
import { exposeDeviceBridge } from '../desktop/device-bridge-preload.mjs';

const ACTION_A = '00000000-0000-4000-8000-000000000001';
const ACTION_B = '00000000-0000-4000-8000-000000000002';
const ACTION_C = '00000000-0000-4000-8000-000000000003';

assert.equal(DEVICE_BRIDGE_CHANNEL, 'hafize:device:invoke');
assert.deepEqual(normalizeDeviceRequest({ operation: 'system.info', args: {} }), { operation: 'system.info', args: {} });
assert.throws(() => normalizeDeviceRequest({ operation: 'browser.open', args: { url: 'https://openai.com' } }), /DEVICE_ACTION_REQUIRES_EXPLICIT_USER_INTENT/);
assert.throws(() => normalizeDeviceRequest({ operation: 'browser.open', args: { url: 'http://example.com', explicitUserIntent: true, actionId: ACTION_A } }), /INVALID_DEVICE_URL/);
assert.throws(() => normalizeDeviceRequest({ operation: 'browser.open', args: { url: 'file:///tmp/x', explicitUserIntent: true, actionId: ACTION_A } }), /INVALID_DEVICE_URL/);
assert.throws(() => normalizeDeviceRequest({ operation: 'browser.open', args: { url: 'https://user:pass@example.com', explicitUserIntent: true, actionId: ACTION_A } }), /INVALID_DEVICE_URL/);
assert.throws(() => normalizeDeviceRequest({ operation: 'browser.open', args: { url: 'https://example.com', explicitUserIntent: true } }), /INVALID_DEVICE_ACTION_ID/);
assert.throws(() => normalizeDeviceRequest({ operation: 'app.open', args: { appId: '../../calc', explicitUserIntent: true, actionId: ACTION_A } }), /INVALID_DEVICE_APP_ID/);
assert.throws(() => normalizeDeviceRequest({ operation: 'shell.exec', args: {} }), /DEVICE_OPERATION_NOT_ALLOWED/);
assert.throws(() => normalizeDeviceRequest({ operation: 'system.info', args: { command: 'whoami' } }), /INVALID_DEVICE_REQUEST/);

const calls = [];
const handler = createDeviceBridgeHandler({
  async getSystemInfo() {
    return { platform: 'darwin', arch: 'arm64', appVersion: '1.2.3', cpuCount: 12, totalMemoryMb: 32768, secretPath: '/Users/x' };
  },
  async openExternal(url) { calls.push(['url', url]); },
  allowedBrowserOrigins: ['https://example.com'],
  appOpeners: {
    spotify: async () => calls.push(['app', 'spotify']),
    vscode: async () => calls.push(['app', 'vscode'])
  }
});
assert.deepEqual(handler.allowedBrowserOrigins, ['https://example.com']);

const info = await handler.handle({ operation: 'system.info', args: {} });
assert.deepEqual(info, { ok: true, value: { platform: 'darwin', arch: 'arm64', appVersion: '1.2.3', cpuCount: 12, totalMemoryMb: 32768 } });
assert.equal(JSON.stringify(info).includes('/Users/x'), false);

assert.deepEqual(await handler.handle({ operation: 'browser.open', args: { url: 'https://example.com/a', explicitUserIntent: true, actionId: ACTION_A } }), { ok: true, value: { opened: true, kind: 'browser' } });
assert.deepEqual(calls.shift(), ['url', 'https://example.com/a']);
assert.deepEqual(await handler.handle({ operation: 'browser.open', args: { url: 'https://sub.example.com/a', explicitUserIntent: true, actionId: ACTION_B } }), { ok: false, error: 'DEVICE_BROWSER_ORIGIN_NOT_ALLOWED' });
assert.deepEqual(await handler.handle({ operation: 'browser.open', args: { url: 'https://example.com.evil.test/a', explicitUserIntent: true, actionId: ACTION_B } }), { ok: false, error: 'DEVICE_BROWSER_ORIGIN_NOT_ALLOWED' });
assert.equal(calls.length, 0, 'blocked browser origins must never reach shell.openExternal');
assert.deepEqual(await handler.handle({ operation: 'app.open', args: { appId: 'spotify', explicitUserIntent: true, actionId: ACTION_B } }), { ok: true, value: { opened: true, kind: 'app', appId: 'spotify' } });
assert.deepEqual(calls.shift(), ['app', 'spotify']);
assert.deepEqual(await handler.handle({ operation: 'app.open', args: { appId: 'terminal', explicitUserIntent: true, actionId: ACTION_C } }), { ok: false, error: 'DEVICE_APP_NOT_ALLOWED' });
assert.deepEqual(await handler.handle({ operation: 'browser.open', args: { url: 'javascript:alert(1)', explicitUserIntent: true, actionId: ACTION_C } }), { ok: false, error: 'INVALID_DEVICE_URL' });

let exposed;
const invoked = [];
const generatedIds = [ACTION_A, ACTION_B];
const api = exposeDeviceBridge({
  contextBridge: { exposeInMainWorld(name, value) { exposed = { name, value }; } },
  ipcRenderer: { invoke(channel, request) { invoked.push([channel, request]); return Promise.resolve({ ok: true }); } },
  hasActiveUserGesture: () => true,
  createActionId: () => generatedIds.shift()
});
assert.equal(exposed.name, 'hafizeDevice');
assert.equal(exposed.value, api);
await api.getSystemInfo();
await api.openBrowser('https://openai.com');
await api.openApp('vscode');
assert.deepEqual(invoked, [
  [DEVICE_BRIDGE_CHANNEL, { operation: 'system.info', args: {} }],
  [DEVICE_BRIDGE_CHANNEL, { operation: 'browser.open', args: { url: 'https://openai.com', explicitUserIntent: true, actionId: ACTION_A } }],
  [DEVICE_BRIDGE_CHANNEL, { operation: 'app.open', args: { appId: 'vscode', explicitUserIntent: true, actionId: ACTION_B } }]
]);

assert.throws(() => exposeDeviceBridge({ contextBridge: {}, ipcRenderer: { invoke() {} } }), /contextBridge/);

const { registerElectronDeviceBridge } = await import('../desktop/device-bridge-main.mjs');
let ipcHandler;
let removed = false;
const externalCalls = [];
const registered = registerElectronDeviceBridge({
  ipcMain: {
    handle(channel, handlerFn) { assert.equal(channel, DEVICE_BRIDGE_CHANNEL); ipcHandler = handlerFn; },
    removeHandler(channel) { assert.equal(channel, DEVICE_BRIDGE_CHANNEL); removed = true; }
  },
  shell: { async openExternal(url) { externalCalls.push(url); } },
  app: { getVersion() { return '9.9.9'; } },
  osModule: {
    platform() { return 'win32'; },
    arch() { return 'x64'; },
    cpus() { return [{}, {}, {}, {}]; },
    totalmem() { return 8 * 1024 * 1024 * 1024; }
  },
  allowedBrowserOrigins: ['https://example.com'],
  appOpeners: { spotify: async () => {} },
  isTrustedSender: (event) => event?.trusted === true
});
assert.deepEqual(registered.allowedApps, ['spotify']);
assert.deepEqual(registered.allowedBrowserOrigins, ['https://example.com']);
assert.deepEqual(await ipcHandler({ trusted: false }, { operation: 'system.info', args: {} }), { ok: false, error: 'DEVICE_RENDERER_NOT_TRUSTED' });
assert.deepEqual(await ipcHandler({ trusted: true }, { operation: 'system.info', args: {} }), {
  ok: true,
  value: { platform: 'win32', arch: 'x64', appVersion: '9.9.9', cpuCount: 4, totalMemoryMb: 8192 }
});
assert.deepEqual(await ipcHandler({ trusted: true }, { operation: 'browser.open', args: { url: 'https://evil.example', explicitUserIntent: true, actionId: ACTION_A } }), {
  ok: false,
  error: 'DEVICE_BROWSER_ORIGIN_NOT_ALLOWED'
});
assert.deepEqual(externalCalls, []);
await ipcHandler({ trusted: true }, { operation: 'browser.open', args: { url: 'https://example.com', explicitUserIntent: true, actionId: ACTION_A } });
assert.deepEqual(externalCalls, ['https://example.com/']);
assert.throws(() => registerElectronDeviceBridge({ ipcMain: { handle() {}, removeHandler() {} }, shell: { openExternal() {} }, app: { getVersion() {} }, osModule: { platform() {}, arch() {}, cpus() {}, totalmem() {} } }), /isTrustedSender/);
registered.dispose();
assert.equal(removed, true);
assert.deepEqual(await ipcHandler({ trusted: true }, { operation: 'browser.open', args: { url: 'https://example.com/after-dispose', explicitUserIntent: true, actionId: ACTION_B } }), {
  ok: false,
  error: 'DEVICE_BRIDGE_NOT_ACTIVE'
});
assert.deepEqual(externalCalls, ['https://example.com/'], 'stale IPC handler must not perform side effects after dispose');

let throwingTrustHandler;
const throwingTrustRegistration = registerElectronDeviceBridge({
  ipcMain: {
    handle(_channel, handlerFn) { throwingTrustHandler = handlerFn; },
    removeHandler() {}
  },
  shell: { async openExternal() { throw new Error('must not run'); } },
  app: { getVersion() { return '1.0.0'; } },
  osModule: {
    platform() { return 'linux'; },
    arch() { return 'x64'; },
    cpus() { return [{}]; },
    totalmem() { return 1024 * 1024 * 1024; }
  },
  isTrustedSender() { throw new Error('sender frame destroyed'); }
});
assert.deepEqual(await throwingTrustHandler({}, { operation: 'system.info', args: {} }), {
  ok: false,
  error: 'DEVICE_RENDERER_NOT_TRUSTED'
});
throwingTrustRegistration.dispose();

const ownershipCalls = [];
const ownershipIpc = {
  handle(channel) { ownershipCalls.push(['handle', channel]); },
  removeHandler(channel) { ownershipCalls.push(['remove', channel]); }
};
const bridgeOptions = {
  ipcMain: ownershipIpc,
  shell: { async openExternal() {} },
  app: { getVersion() { return '1.0.0'; } },
  osModule: {
    platform() { return 'linux'; },
    arch() { return 'x64'; },
    cpus() { return [{}]; },
    totalmem() { return 1024 * 1024 * 1024; }
  },
  isTrustedSender: () => true
};
const firstRegistration = registerElectronDeviceBridge(bridgeOptions);
assert.throws(() => registerElectronDeviceBridge(bridgeOptions), /DEVICE_BRIDGE_ALREADY_REGISTERED/);
assert.deepEqual(ownershipCalls, [['handle', DEVICE_BRIDGE_CHANNEL]]);
firstRegistration.dispose();
firstRegistration.dispose();
assert.deepEqual(ownershipCalls, [
  ['handle', DEVICE_BRIDGE_CHANNEL],
  ['remove', DEVICE_BRIDGE_CHANNEL]
]);
const secondRegistration = registerElectronDeviceBridge(bridgeOptions);
firstRegistration.dispose();
assert.deepEqual(ownershipCalls, [
  ['handle', DEVICE_BRIDGE_CHANNEL],
  ['remove', DEVICE_BRIDGE_CHANNEL],
  ['handle', DEVICE_BRIDGE_CHANNEL]
]);
secondRegistration.dispose();
assert.deepEqual(ownershipCalls.at(-1), ['remove', DEVICE_BRIDGE_CHANNEL]);

let failHandle = true;
const rollbackCalls = [];
const rollbackIpc = {
  handle(channel) {
    rollbackCalls.push(['handle', channel]);
    if (failHandle) throw new Error('simulated registration failure');
  },
  removeHandler(channel) { rollbackCalls.push(['remove', channel]); }
};
const rollbackOptions = { ...bridgeOptions, ipcMain: rollbackIpc };
assert.throws(() => registerElectronDeviceBridge(rollbackOptions), /simulated registration failure/);
failHandle = false;
const recoveredRegistration = registerElectronDeviceBridge(rollbackOptions);
assert.deepEqual(rollbackCalls, [
  ['handle', DEVICE_BRIDGE_CHANNEL],
  ['handle', DEVICE_BRIDGE_CHANNEL]
], 'failed ipcMain.handle setup must release ownership for a clean retry');
recoveredRegistration.dispose();
assert.deepEqual(rollbackCalls.at(-1), ['remove', DEVICE_BRIDGE_CHANNEL]);

console.log('device bridge contract tests passed');
