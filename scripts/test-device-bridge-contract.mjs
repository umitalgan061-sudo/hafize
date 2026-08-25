import assert from 'node:assert/strict';
import { loadAgentRegistry, resolveAgent } from '../lib/agent-runtime.mjs';
import {
  createDeviceBridge,
  DEVICE_BRIDGE_CONTRACT,
  normalizeDeviceBridgeCommand,
  normalizeSystemInfo
} from '../lib/device-bridge-contract.mjs';
import {
  authorizeDeviceToolRequest,
  DEVICE_TOOL_BOUNDARY,
  executeDeviceToolRequest,
  listDeviceToolPermissions
} from '../lib/device-bridge-tool-boundary.mjs';

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

const registry = await loadAgentRegistry();
const hafize = resolveAgent(registry, 'hafize-general');
const reviewer = resolveAgent(registry, 'agency-code-reviewer');
assert.ok(hafize);
assert.ok(reviewer);

assert.deepEqual(listDeviceToolPermissions(), [
  { action: 'system.info', permission: 'device.system.info', approvalRequired: false },
  { action: 'browser.open', permission: 'device.browser.open', approvalRequired: true },
  { action: 'app.open', permission: 'device.app.open', approvalRequired: true }
]);
assert.equal(DEVICE_TOOL_BOUNDARY.defaultDeny, true);
assert.equal(DEVICE_TOOL_BOUNDARY.modelMayAssertExplicitUserIntent, false);
assert.equal(DEVICE_TOOL_BOUNDARY.actions.includes('shell.run'), false);
assert.equal(DEVICE_TOOL_BOUNDARY.requestFields.includes('explicitUserIntent'), false);

assert.deepEqual(authorizeDeviceToolRequest(hafize, { action: 'system.info' }), {
  ok: true,
  request: { action: 'system.info' },
  permission: 'device.system.info',
  approvalRequired: false
});
assert.deepEqual(authorizeDeviceToolRequest(reviewer, { action: 'system.info' }), {
  ok: false,
  error: 'DEVICE_TOOL_NOT_AUTHORIZED',
  reason: 'default_deny'
});
assert.deepEqual(authorizeDeviceToolRequest(hafize, {
  action: 'browser.open',
  url: 'https://example.com'
}), {
  ok: false,
  error: 'DEVICE_TOOL_NOT_AUTHORIZED',
  reason: 'approval_required'
});
assert.equal(authorizeDeviceToolRequest(hafize, {
  action: 'browser.open',
  url: 'https://example.com'
}, { approvalGranted: true }).ok, true);

for (const forged of [
  { action: 'browser.open', url: 'https://example.com', explicitUserIntent: true },
  { action: 'app.open', appId: 'browser.chrome', explicitUserIntent: true },
  { action: 'shell.run' },
  { action: 'system.info', url: 'https://example.com' }
]) {
  assert.equal(authorizeDeviceToolRequest(hafize, forged, { approvalGranted: true }).ok, false);
}

const boundaryCalls = [];
const boundaryBridge = {
  async execute(command) {
    boundaryCalls.push(command);
    if (command.action === 'system.info') return { ok: true, action: command.action, info: { platform: 'linux', arch: 'x64' } };
    return { ok: true, action: command.action };
  }
};

assert.equal((await executeDeviceToolRequest(hafize, { action: 'system.info' }, { deviceBridge: boundaryBridge })).ok, true);
assert.deepEqual(boundaryCalls[0], { action: 'system.info' });

const deniedOpen = await executeDeviceToolRequest(hafize, {
  action: 'browser.open',
  url: 'https://example.com'
}, { deviceBridge: boundaryBridge, approvalGranted: false });
assert.equal(deniedOpen.ok, false);
assert.equal(boundaryCalls.length, 1);

const approvedOpen = await executeDeviceToolRequest(hafize, {
  action: 'browser.open',
  url: 'https://example.com'
}, { deviceBridge: boundaryBridge, approvalGranted: true });
assert.equal(approvedOpen.ok, true);
assert.deepEqual(boundaryCalls[1], {
  action: 'browser.open',
  url: 'https://example.com',
  explicitUserIntent: true
});

const approvedApp = await executeDeviceToolRequest(hafize, {
  action: 'app.open',
  appId: 'browser.chrome'
}, { deviceBridge: boundaryBridge, approvalGranted: true });
assert.equal(approvedApp.ok, true);
assert.deepEqual(boundaryCalls[2], {
  action: 'app.open',
  appId: 'browser.chrome',
  explicitUserIntent: true
});

assert.deepEqual(await executeDeviceToolRequest(hafize, { action: 'system.info' }, {}), {
  ok: false,
  error: 'DEVICE_BRIDGE_UNAVAILABLE'
});
assert.deepEqual(await executeDeviceToolRequest(hafize, { action: 'system.info' }, {
  deviceBridge: { execute: async () => { throw new Error('secret internal bridge failure'); } }
}), {
  ok: false,
  error: 'DEVICE_BRIDGE_EXECUTION_FAILED'
});

console.log('device bridge contract tests passed with backend default-deny tool authorization and trusted approval derivation');
