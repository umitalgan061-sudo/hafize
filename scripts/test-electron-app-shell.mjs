import assert from 'node:assert/strict';
import { createElectronAppShell } from '../desktop/app-shell.mjs';

class FakeWebContents {
  constructor() {
    this.handlers = new Map();
    this.openHandler = null;
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
  async loadURL(url) { this.loaded = url; }
  isDestroyed() { return this.destroyed; }
  show() { this.shown = true; }
  destroy() {
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

assert.equal(bridgeOptions.isTrustedSender({
  sender: windowRef.webContents,
  senderFrame: { url: 'http://127.0.0.1:4173/chat' }
}), true);
assert.equal(bridgeOptions.isTrustedSender({
  sender: {},
  senderFrame: { url: 'http://127.0.0.1:4173/chat' }
}), false);
assert.equal(bridgeOptions.isTrustedSender({
  sender: windowRef.webContents,
  senderFrame: { url: 'https://evil.example/' }
}), false);
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
  registerDeviceBridge() {}
}), /INVALID_DESKTOP_APP_URL/);
assert.throws(() => createElectronAppShell({
  app: createFakeApp(),
  BrowserWindow: FakeWindow,
  preloadPath: 'relative/preload.mjs',
  registerDeviceBridge() {}
}), /INVALID_DESKTOP_WINDOW:preloadPath/);

console.log('desktop app shell tests passed');
