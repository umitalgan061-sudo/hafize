import assert from 'node:assert/strict';
import { createDeviceBridgeHandler, DEVICE_BRIDGE_CHANNEL, normalizeDeviceRequest } from '../desktop/device-bridge-contract.mjs';
import { exposeDeviceBridge } from '../desktop/device-bridge-preload.mjs';

assert.equal(DEVICE_BRIDGE_CHANNEL, 'hafize:device:invoke');
assert.deepEqual(normalizeDeviceRequest({ operation: 'system.info', args: {} }), { operation: 'system.info', args: {} });
assert.throws(() => normalizeDeviceRequest({ operation: 'browser.open', args: { url: 'https://openai.com' } }), /DEVICE_ACTION_REQUIRES_EXPLICIT_USER_INTENT/);
assert.throws(() => normalizeDeviceRequest({ operation: 'browser.open', args: { url: 'http://example.com', explicitUserIntent: true } }), /INVALID_DEVICE_URL/);
assert.throws(() => normalizeDeviceRequest({ operation: 'browser.open', args: { url: 'file:///tmp/x', explicitUserIntent: true } }), /INVALID_DEVICE_URL/);
assert.throws(() => normalizeDeviceRequest({ operation: 'browser.open', args: { url: 'https://user:pass@example.com', explicitUserIntent: true } }), /INVALID_DEVICE_URL/);
assert.throws(() => normalizeDeviceRequest({ operation: 'app.open', args: { appId: '../../calc', explicitUserIntent: true } }), /INVALID_DEVICE_APP_ID/);
assert.throws(() => normalizeDeviceRequest({ operation: 'shell.exec', args: {} }), /DEVICE_OPERATION_NOT_ALLOWED/);
assert.throws(() => normalizeDeviceRequest({ operation: 'system.info', args: { command: 'whoami' } }), /INVALID_DEVICE_REQUEST/);

const calls = [];
const handler = createDeviceBridgeHandler({
  async getSystemInfo() {
    return { platform: 'darwin', arch: 'arm64', appVersion: '1.2.3', cpuCount: 12, totalMemoryMb: 32768, secretPath: '/Users/x' };
  },
  async openExternal(url) { calls.push(['url', url]); },
  appOpeners: {
    spotify: async () => calls.push(['app', 'spotify']),
    vscode: async () => calls.push(['app', 'vscode'])
  }
});

const info = await handler.handle({ operation: 'system.info', args: {} });
assert.deepEqual(info, { ok: true, value: { platform: 'darwin', arch: 'arm64', appVersion: '1.2.3', cpuCount: 12, totalMemoryMb: 32768 } });
assert.equal(JSON.stringify(info).includes('/Users/x'), false);

assert.deepEqual(await handler.handle({ operation: 'browser.open', args: { url: 'https://example.com/a', explicitUserIntent: true } }), { ok: true, value: { opened: true, kind: 'browser' } });
assert.deepEqual(calls.shift(), ['url', 'https://example.com/a']);
assert.deepEqual(await handler.handle({ operation: 'app.open', args: { appId: 'spotify', explicitUserIntent: true } }), { ok: true, value: { opened: true, kind: 'app', appId: 'spotify' } });
assert.deepEqual(calls.shift(), ['app', 'spotify']);
assert.deepEqual(await handler.handle({ operation: 'app.open', args: { appId: 'terminal', explicitUserIntent: true } }), { ok: false, error: 'DEVICE_APP_NOT_ALLOWED' });
assert.deepEqual(await handler.handle({ operation: 'browser.open', args: { url: 'javascript:alert(1)', explicitUserIntent: true } }), { ok: false, error: 'INVALID_DEVICE_URL' });

let exposed;
const invoked = [];
const api = exposeDeviceBridge({
  contextBridge: { exposeInMainWorld(name, value) { exposed = { name, value }; } },
  ipcRenderer: { invoke(channel, request) { invoked.push([channel, request]); return Promise.resolve({ ok: true }); } }
});
assert.equal(exposed.name, 'hafizeDevice');
assert.equal(exposed.value, api);
await api.getSystemInfo();
await api.openBrowser('https://openai.com', { explicitUserIntent: true });
await api.openApp('vscode', { explicitUserIntent: true });
assert.deepEqual(invoked, [
  [DEVICE_BRIDGE_CHANNEL, { operation: 'system.info', args: {} }],
  [DEVICE_BRIDGE_CHANNEL, { operation: 'browser.open', args: { url: 'https://openai.com', explicitUserIntent: true } }],
  [DEVICE_BRIDGE_CHANNEL, { operation: 'app.open', args: { appId: 'vscode', explicitUserIntent: true } }]
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
  appOpeners: { spotify: async () => {} },
  isTrustedSender: (event) => event?.trusted === true
});
assert.deepEqual(registered.allowedApps, ['spotify']);
assert.deepEqual(await ipcHandler({ trusted: false }, { operation: 'system.info', args: {} }), { ok: false, error: 'DEVICE_RENDERER_NOT_TRUSTED' });
assert.deepEqual(await ipcHandler({ trusted: true }, { operation: 'system.info', args: {} }), {
  ok: true,
  value: { platform: 'win32', arch: 'x64', appVersion: '9.9.9', cpuCount: 4, totalMemoryMb: 8192 }
});
await ipcHandler({ trusted: true }, { operation: 'browser.open', args: { url: 'https://example.com', explicitUserIntent: true } });
assert.deepEqual(externalCalls, ['https://example.com/']);
assert.throws(() => registerElectronDeviceBridge({ ipcMain: { handle() {}, removeHandler() {} }, shell: { openExternal() {} }, app: { getVersion() {} }, osModule: { platform() {}, arch() {}, cpus() {}, totalmem() {} } }), /isTrustedSender/);
registered.dispose();
assert.equal(removed, true);
console.log('device bridge contract tests passed');
