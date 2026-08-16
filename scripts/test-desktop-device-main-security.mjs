import assert from 'node:assert/strict';
import { registerElectronDeviceBridge } from '../desktop/device-bridge-main.mjs';
import { DEVICE_BRIDGE_CHANNEL } from '../desktop/device-bridge-contract.mjs';

function createIpcMain() {
  const handlers = new Map();
  const removed = [];
  return {
    handlers,
    removed,
    handle(channel, fn) {
      assert.equal(typeof channel, 'string');
      assert.equal(typeof fn, 'function');
      assert.equal(handlers.has(channel), false, `duplicate handler: ${channel}`);
      handlers.set(channel, fn);
    },
    removeHandler(channel) {
      removed.push(channel);
      handlers.delete(channel);
    }
  };
}

function createFixture({ trusted = true, shellFailure = false, appFailure = false } = {}) {
  const ipcMain = createIpcMain();
  const opened = [];
  const appOpened = [];
  let trustChecks = 0;
  const shell = {
    async openExternal(url) {
      if (shellFailure) throw new Error('blocked');
      opened.push(url);
    }
  };
  const app = { getVersion: () => '0.1.0' };
  const osModule = {
    platform: () => 'linux',
    arch: () => 'x64',
    cpus: () => Array.from({ length: 8 }, () => ({})),
    totalmem: () => 16 * 1024 * 1024 * 1024
  };
  const bridge = registerElectronDeviceBridge({
    ipcMain,
    shell,
    app,
    osModule,
    allowedBrowserOrigins: ['https://github.com'],
    appOpeners: {
      calculator: async () => {
        if (appFailure) throw new Error('blocked');
        appOpened.push('calculator');
      }
    },
    isTrustedSender(event) {
      trustChecks += 1;
      return trusted && event?.trusted === true;
    }
  });
  return { ipcMain, opened, appOpened, bridge, getTrustChecks: () => trustChecks };
}

{
  const fixture = createFixture();
  assert.deepEqual(fixture.bridge.allowedBrowserOrigins, ['https://github.com']);
  assert.deepEqual(fixture.bridge.allowedApps, ['calculator']);
  assert.equal(fixture.ipcMain.handlers.size, 1);
  assert.equal(fixture.ipcMain.handlers.has(DEVICE_BRIDGE_CHANNEL), true);

  const invoke = fixture.ipcMain.handlers.get(DEVICE_BRIDGE_CHANNEL);
  const info = await invoke({ trusted: true }, { operation: 'system.info', args: {} });
  assert.deepEqual(info, {
    ok: true,
    value: { platform: 'linux', arch: 'x64', appVersion: '0.1.0', cpuCount: 8, totalMemoryMb: 16384 }
  });

  const capabilities = await invoke({ trusted: true }, { operation: 'capabilities.read', args: {} });
  assert.deepEqual(capabilities, {
    ok: true,
    value: { browserOrigins: ['https://github.com'], appIds: ['calculator'] }
  });

  const browser = await invoke(
    { trusted: true },
    { operation: 'browser.open', args: { url: 'https://github.com/', explicitUserIntent: true } }
  );
  assert.deepEqual(browser, { ok: true, value: { opened: true, kind: 'browser' } });
  assert.deepEqual(fixture.opened, ['https://github.com/']);

  const app = await invoke(
    { trusted: true },
    { operation: 'app.open', args: { appId: 'calculator', explicitUserIntent: true } }
  );
  assert.deepEqual(app, { ok: true, value: { opened: true, kind: 'app', appId: 'calculator' } });
  assert.deepEqual(fixture.appOpened, ['calculator']);
  assert.equal(fixture.getTrustChecks(), 4);

  fixture.bridge.dispose();
  assert.deepEqual(fixture.ipcMain.removed, [DEVICE_BRIDGE_CHANNEL]);
  assert.equal(fixture.ipcMain.handlers.size, 0);
}

{
  const fixture = createFixture({ trusted: false });
  const invoke = fixture.ipcMain.handlers.get(DEVICE_BRIDGE_CHANNEL);
  const result = await invoke({ trusted: true }, { operation: 'system.info', args: {} });
  assert.deepEqual(result, { ok: false, error: 'DEVICE_RENDERER_NOT_TRUSTED' });
  assert.deepEqual(fixture.opened, []);
  assert.deepEqual(fixture.appOpened, []);
  assert.equal(fixture.getTrustChecks(), 1);
}

{
  const fixture = createFixture();
  const invoke = fixture.ipcMain.handlers.get(DEVICE_BRIDGE_CHANNEL);
  const wrongOrigin = await invoke(
    { trusted: true },
    { operation: 'browser.open', args: { url: 'https://example.com/', explicitUserIntent: true } }
  );
  assert.deepEqual(wrongOrigin, { ok: false, error: 'DEVICE_BROWSER_ORIGIN_NOT_ALLOWED' });
  assert.deepEqual(fixture.opened, []);

  const wrongApp = await invoke(
    { trusted: true },
    { operation: 'app.open', args: { appId: 'terminal', explicitUserIntent: true } }
  );
  assert.deepEqual(wrongApp, { ok: false, error: 'DEVICE_APP_NOT_ALLOWED' });
  assert.deepEqual(fixture.appOpened, []);

  const missingIntent = await invoke(
    { trusted: true },
    { operation: 'browser.open', args: { url: 'https://github.com/' } }
  );
  assert.deepEqual(missingIntent, { ok: false, error: 'DEVICE_ACTION_REQUIRES_EXPLICIT_USER_INTENT' });

  const unknownOperation = await invoke({ trusted: true }, { operation: 'shell.exec', args: {} });
  assert.deepEqual(unknownOperation, { ok: false, error: 'DEVICE_OPERATION_NOT_ALLOWED' });
}

{
  const shellFixture = createFixture({ shellFailure: true });
  const invoke = shellFixture.ipcMain.handlers.get(DEVICE_BRIDGE_CHANNEL);
  const result = await invoke(
    { trusted: true },
    { operation: 'browser.open', args: { url: 'https://github.com/', explicitUserIntent: true } }
  );
  assert.deepEqual(result, { ok: false, error: 'DEVICE_ACTION_FAILED' });

  const appFixture = createFixture({ appFailure: true });
  const invokeApp = appFixture.ipcMain.handlers.get(DEVICE_BRIDGE_CHANNEL);
  const appResult = await invokeApp(
    { trusted: true },
    { operation: 'app.open', args: { appId: 'calculator', explicitUserIntent: true } }
  );
  assert.deepEqual(appResult, { ok: false, error: 'DEVICE_ACTION_FAILED' });
}

for (const invalid of [
  {},
  { ipcMain: createIpcMain() },
  { ipcMain: createIpcMain(), shell: { openExternal() {} }, app: { getVersion() {} }, osModule: {}, isTrustedSender() { return true; } }
]) {
  assert.throws(() => registerElectronDeviceBridge(invalid), /INVALID_DEVICE_MAIN/);
}

console.log('desktop device main security tests passed');
