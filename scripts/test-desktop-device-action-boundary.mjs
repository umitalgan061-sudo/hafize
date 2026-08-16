import assert from 'node:assert/strict';
import { createDeviceBridgeHandler, normalizeDeviceRequest } from '../desktop/device-bridge-contract.mjs';
import { exposeDeviceBridge } from '../desktop/device-bridge-preload.mjs';

assert.deepEqual(normalizeDeviceRequest({ operation: 'capabilities.read', args: {} }), { operation: 'capabilities.read', args: {} });
assert.throws(() => normalizeDeviceRequest({ operation: 'browser.open', args: { url: 'https://github.com' } }), /DEVICE_ACTION_REQUIRES_EXPLICIT_USER_INTENT/);
assert.throws(() => normalizeDeviceRequest({ operation: 'browser.open', args: { url: 'http://github.com', explicitUserIntent: true } }), /INVALID_DEVICE_URL/);

const opened = [];
const handler = createDeviceBridgeHandler({
  getSystemInfo: async () => ({ platform: 'linux', arch: 'x64', appVersion: '0.1.0', cpuCount: 8, totalMemoryMb: 8192 }),
  openExternal: async (url) => opened.push(['browser', url]),
  allowedBrowserOrigins: ['https://github.com'],
  appOpeners: { calculator: async () => opened.push(['app', 'calculator']) }
});

assert.deepEqual(await handler.handle({ operation: 'capabilities.read', args: {} }), {
  ok: true,
  value: { browserOrigins: ['https://github.com'], appIds: ['calculator'] }
});
assert.deepEqual(await handler.handle({ operation: 'browser.open', args: { url: 'https://example.com/', explicitUserIntent: true } }), {
  ok: false,
  error: 'DEVICE_BROWSER_ORIGIN_NOT_ALLOWED'
});
assert.deepEqual(await handler.handle({ operation: 'app.open', args: { appId: 'terminal', explicitUserIntent: true } }), {
  ok: false,
  error: 'DEVICE_APP_NOT_ALLOWED'
});
assert.equal(opened.length, 0);

let exposed;
const invocations = [];
let activeGesture = false;
const api = exposeDeviceBridge({
  contextBridge: { exposeInMainWorld(name, value) { assert.equal(name, 'hafizeDevice'); exposed = value; } },
  ipcRenderer: { async invoke(channel, request) { invocations.push({ channel, request }); return { ok: true, value: request }; } },
  hasActiveUserGesture: () => activeGesture
});
assert.equal(api, exposed);

await api.getCapabilities();
assert.equal(invocations.at(-1).request.operation, 'capabilities.read');

const rejectedBrowser = await api.openBrowser('https://github.com/');
assert.deepEqual(rejectedBrowser, { ok: false, error: 'DEVICE_ACTION_REQUIRES_ACTIVE_USER_GESTURE' });
assert.equal(invocations.length, 1);

activeGesture = true;
await api.openBrowser('https://github.com/');
assert.deepEqual(invocations.at(-1).request, {
  operation: 'browser.open',
  args: { url: 'https://github.com/', explicitUserIntent: true }
});
await api.openApp('calculator');
assert.deepEqual(invocations.at(-1).request, {
  operation: 'app.open',
  args: { appId: 'calculator', explicitUserIntent: true }
});

activeGesture = false;
const rejectedApp = await api.openApp('calculator');
assert.deepEqual(rejectedApp, { ok: false, error: 'DEVICE_ACTION_REQUIRES_ACTIVE_USER_GESTURE' });

await handler.handle({ operation: 'browser.open', args: { url: 'https://github.com/', explicitUserIntent: true } });
await handler.handle({ operation: 'app.open', args: { appId: 'calculator', explicitUserIntent: true } });
assert.deepEqual(opened, [['browser', 'https://github.com/'], ['app', 'calculator']]);

console.log('desktop device action boundary tests passed');
