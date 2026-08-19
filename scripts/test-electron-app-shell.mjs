import assert from 'node:assert/strict';
import { createElectronAppShell } from '../desktop/app-shell.mjs';

class FakeWebContents {
  constructor() {
    this.handlers = new Map();
    this.openHandler = null;
    this.mainFrame = { url: '' };
  }
  on(name, fn) { this.handlers.set(name, fn); }
  removeListener(name, fn) {
    if (this.handlers.get(name) === fn) this.handlers.delete(name);
  }
  setWindowOpenHandler(fn) { this.openHandler = fn; }
}

const windows = [];
class FakeWindow {
  static getAllWindows() { return windows.filter((item) => !item.destroyed); }
  constructor(options) {
    this.options = options;
    this.webContents = new FakeWebContents();
    this.onceHandlers = new Map();
    this.destroyed = false;
    this.shown = false;
    this.loaded = null;
    windows.push(this);
  }
  once(name, fn) { this.onceHandlers.set(name, fn); }
  removeListener(name, fn) {
    if (this.onceHandlers.get(name) === fn) this.onceHandlers.delete(name);
  }
  async loadURL(url) {
    this.loaded = url;
    this.webContents.mainFrame.url = url;
  }
  isDestroyed() { return this.destroyed; }
  show() { this.shown = true; }
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.onceHandlers.get('closed')?.();
  }
}

function createFakeApp() {
  const handlers = new Map();
  return {
    quitCalls: 0,
    async whenReady() {},
    on(name, fn) { handlers.set(name, fn); },
    removeListener(name, fn) {
      if (handlers.get(name) === fn) handlers.delete(name);
    },
    quit() { this.quitCalls += 1; },
    getVersion() { return '1.0.0'; },
    emit(name) { handlers.get(name)?.(); },
    handlers
  };
}

const app = createFakeApp();
let bridgeOptions = null;
let bridgeDisposeCalls = 0;
let permissionOptions = null;
let permissionDisposeCalls = 0;
const appShell = createElectronAppShell({
  app,
  BrowserWindow: FakeWindow,
  ipcMain: {},
  shell: {},
  osModule: {},
  preloadPath: '/absolute/preload.mjs',
  startUrl: 'http://127.0.0.1:4173/',
  appOpeners: { browser: async () => {} },
  platform: 'linux',
  registerDeviceBridge(options) {
    bridgeOptions = options;
    return { dispose() { bridgeDisposeCalls += 1; } };
  },
  installPermissionPolicy(options) {
    permissionOptions = options;
    return { dispose() { permissionDisposeCalls += 1; } };
  }
});

const windowRef = await appShell.start();
assert.equal(windowRef.loaded, 'http://127.0.0.1:4173/');
assert.equal(windowRef.options.webPreferences.contextIsolation, true);
assert.equal(windowRef.options.webPreferences.sandbox, true);
assert.equal(windowRef.options.webPreferences.nodeIntegration, false);
assert.equal(windowRef.options.webPreferences.webSecurity, true);
assert.equal(typeof bridgeOptions.isTrustedSender, 'function');
assert.equal(bridgeOptions.app, app);
assert.equal(bridgeOptions.appOpeners.browser instanceof Function, true);
assert.equal(permissionOptions.webContents, windowRef.webContents);
assert.equal(permissionOptions.rendererOrigin, 'http://127.0.0.1:4173');
assert.equal(permissionOptions.allowAudioMedia, false);

assert.equal(bridgeOptions.isTrustedSender({
  sender: windowRef.webContents,
  senderFrame: windowRef.webContents.mainFrame
}), true);
assert.equal(bridgeOptions.isTrustedSender({
  sender: windowRef.webContents,
  senderFrame: { url: 'http://127.0.0.1:4173/chat' }
}), false, 'same-origin subframes must not inherit device IPC authority');
assert.equal(bridgeOptions.isTrustedSender({
  sender: {},
  senderFrame: windowRef.webContents.mainFrame
}), false);
const trustedUrl = windowRef.webContents.mainFrame.url;
windowRef.webContents.mainFrame.url = 'https://evil.example/';
assert.equal(bridgeOptions.isTrustedSender({
  sender: windowRef.webContents,
  senderFrame: windowRef.webContents.mainFrame
}), false);
windowRef.webContents.mainFrame.url = trustedUrl;
assert.equal(bridgeOptions.isTrustedSender({
  sender: windowRef.webContents,
  senderFrame: { url: 'file:///tmp/index.html' }
}), false);

let prevented = false;
windowRef.webContents.handlers.get('will-navigate')(
  { preventDefault() { prevented = true; } },
  'https://evil.example/'
);
assert.equal(prevented, true);
prevented = false;
windowRef.webContents.handlers.get('will-navigate')(
  { preventDefault() { prevented = true; } },
  'http://127.0.0.1:4173/next'
);
assert.equal(prevented, false);
assert.deepEqual(windowRef.webContents.openHandler({ url: 'https://example.com' }), { action: 'deny' });

windowRef.onceHandlers.get('ready-to-show')?.();
assert.equal(windowRef.shown, true);
const sameWindow = await appShell.createWindow();
assert.equal(sameWindow, windowRef);

windowRef.destroy();
assert.equal(bridgeDisposeCalls, 1);
assert.equal(permissionDisposeCalls, 1);
assert.equal(appShell.getWindow(), null);
app.emit('activate');
await new Promise((resolve) => setImmediate(resolve));
assert.equal(FakeWindow.getAllWindows().length, 1);
app.emit('window-all-closed');
assert.equal(app.quitCalls, 1);

appShell.dispose();
assert.equal(app.handlers.has('activate'), false);
assert.equal(app.handlers.has('window-all-closed'), false);
await assert.rejects(() => appShell.createWindow(), /DESKTOP_APP_SHELL_DISPOSED/);

assert.throws(() => createElectronAppShell({
  app: createFakeApp(),
  BrowserWindow: FakeWindow,
  preloadPath: '/x',
  startUrl: 'https://example.com',
  registerDeviceBridge() {},
  installPermissionPolicy() {}
}), /INVALID_DESKTOP_APP_URL/);
assert.throws(() => createElectronAppShell({
  app: createFakeApp(),
  BrowserWindow: FakeWindow,
  preloadPath: 'relative/preload.mjs',
  registerDeviceBridge() {},
  installPermissionPolicy() {}
}), /INVALID_DESKTOP_WINDOW:preloadPath/);

function createCountingApp({ readyPromise = Promise.resolve() } = {}) {
  const handlers = new Map();
  const onCalls = [];
  const removeCalls = [];
  return {
    onCalls,
    removeCalls,
    handlers,
    whenReady() { return readyPromise; },
    on(name, fn) {
      onCalls.push(name);
      const list = handlers.get(name) || [];
      list.push(fn);
      handlers.set(name, list);
    },
    removeListener(name, fn) {
      removeCalls.push(name);
      const list = handlers.get(name) || [];
      const index = list.indexOf(fn);
      if (index >= 0) list.splice(index, 1);
      handlers.set(name, list);
    },
    quit() {},
    getVersion() { return '1.0.0'; }
  };
}

function createLifecycleWindowClass({ loadError = null } = {}) {
  const instances = [];
  class LifecycleWindow extends FakeWindow {
    static getAllWindows() { return instances.filter((item) => !item.destroyed); }
    constructor(options) {
      super(options);
      instances.push(this);
    }
    async loadURL(url) {
      if (loadError) throw loadError;
      return super.loadURL(url);
    }
  }
  return { LifecycleWindow, instances };
}

const repeatedApp = createCountingApp();
const { LifecycleWindow: RepeatedWindow, instances: repeatedWindows } = createLifecycleWindowClass();
const repeatedShell = createElectronAppShell({
  app: repeatedApp,
  BrowserWindow: RepeatedWindow,
  preloadPath: '/absolute/preload.mjs',
  registerDeviceBridge() { return { dispose() {} }; },
  installPermissionPolicy() { return { dispose() {} }; }
});
const [firstStartWindow, concurrentStartWindow] = await Promise.all([repeatedShell.start(), repeatedShell.start()]);
assert.equal(firstStartWindow, concurrentStartWindow);
assert.equal(repeatedWindows.length, 1, 'concurrent start must create only one window');
assert.deepEqual(repeatedApp.onCalls, ['activate', 'window-all-closed']);
assert.equal(await repeatedShell.start(), firstStartWindow);
assert.deepEqual(repeatedApp.onCalls, ['activate', 'window-all-closed'], 'repeated start must not duplicate app listeners');
repeatedShell.dispose();
assert.deepEqual(repeatedApp.removeCalls, ['activate', 'window-all-closed']);

let releaseReady;
const pendingReady = new Promise((resolve) => { releaseReady = resolve; });
const pendingApp = createCountingApp({ readyPromise: pendingReady });
const { LifecycleWindow: PendingWindow, instances: pendingWindows } = createLifecycleWindowClass();
const pendingShell = createElectronAppShell({
  app: pendingApp,
  BrowserWindow: PendingWindow,
  preloadPath: '/absolute/preload.mjs',
  registerDeviceBridge() { return { dispose() {} }; },
  installPermissionPolicy() { return { dispose() {} }; }
});
const pendingStart = pendingShell.start();
pendingShell.dispose();
releaseReady();
await assert.rejects(() => pendingStart, /DESKTOP_APP_SHELL_DISPOSED/);
assert.deepEqual(pendingApp.onCalls, []);
assert.equal(pendingWindows.length, 0, 'dispose during whenReady must not create a window');

let failedPermissionDisposes = 0;
const failedPermissionApp = createCountingApp();
const { LifecycleWindow: FailedPermissionWindow, instances: failedPermissionWindows } = createLifecycleWindowClass();
const failedPermissionShell = createElectronAppShell({
  app: failedPermissionApp,
  BrowserWindow: FailedPermissionWindow,
  preloadPath: '/absolute/preload.mjs',
  registerDeviceBridge() { throw new Error('bridge should not run'); },
  installPermissionPolicy() {
    return { dispose() { failedPermissionDisposes += 1; } };
  }
});
await assert.rejects(() => failedPermissionShell.start(), /DESKTOP_APP_BINDINGS_FAILED/);
assert.equal(failedPermissionWindows.length, 1);
assert.equal(failedPermissionWindows[0].destroyed, true);
assert.equal(failedPermissionWindows[0].webContents.handlers.has('will-navigate'), false);
assert.equal(failedPermissionDisposes, 1, 'partial permission binding must roll back when bridge setup fails');
assert.equal(failedPermissionApp.handlers.get('activate')?.length || 0, 0, 'failed start must remove app activate listener');
assert.equal(failedPermissionApp.handlers.get('window-all-closed')?.length || 0, 0, 'failed start must remove app close listener');
failedPermissionShell.dispose();

let loadBridgeDisposes = 0;
let loadPermissionDisposes = 0;
const loadFailureApp = createCountingApp();
const { LifecycleWindow: LoadFailureWindow, instances: loadFailureWindows } = createLifecycleWindowClass({ loadError: new Error('load failed') });
const loadFailureShell = createElectronAppShell({
  app: loadFailureApp,
  BrowserWindow: LoadFailureWindow,
  preloadPath: '/absolute/preload.mjs',
  registerDeviceBridge() { return { dispose() { loadBridgeDisposes += 1; } }; },
  installPermissionPolicy() { return { dispose() { loadPermissionDisposes += 1; } }; }
});
await assert.rejects(() => loadFailureShell.start(), /DESKTOP_APP_LOAD_FAILED/);
assert.equal(loadFailureWindows[0].destroyed, true);
assert.equal(loadFailureWindows[0].webContents.handlers.has('will-navigate'), false);
assert.equal(loadFailureWindows[0].onceHandlers.has('ready-to-show'), false, 'failed load must remove stale ready-to-show callback');
assert.equal(loadBridgeDisposes, 1);
assert.equal(loadPermissionDisposes, 1);
assert.equal(loadFailureApp.handlers.get('activate')?.length || 0, 0);
assert.equal(loadFailureApp.handlers.get('window-all-closed')?.length || 0, 0);
loadFailureShell.dispose();

const activationFailureApp = createCountingApp();
let activationShouldFail = false;
const activationWindows = [];
class ActivationFailureWindow extends FakeWindow {
  static getAllWindows() { return activationWindows.filter((item) => !item.destroyed); }
  constructor(options) {
    super(options);
    activationWindows.push(this);
  }
  async loadURL(url) {
    if (activationShouldFail) throw new Error('activation load failed');
    return super.loadURL(url);
  }
}
const activationShell = createElectronAppShell({
  app: activationFailureApp,
  BrowserWindow: ActivationFailureWindow,
  preloadPath: '/absolute/preload.mjs',
  registerDeviceBridge() { return { dispose() {} }; },
  installPermissionPolicy() { return { dispose() {} }; }
});
const activationWindow = await activationShell.start();
activationWindow.destroy();
activationShouldFail = true;
for (const handler of activationFailureApp.handlers.get('activate') || []) handler();
await new Promise((resolve) => setImmediate(resolve));
assert.equal(ActivationFailureWindow.getAllWindows().length, 0, 'failed activate recreation must clean up the failed window');
assert.equal(activationFailureApp.handlers.get('activate')?.length || 0, 1, 'activate failure must keep lifecycle listener available for a later retry');
activationShell.dispose();

console.log('desktop app shell tests passed');
