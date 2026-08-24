import assert from 'node:assert/strict';
import { createElectronAppShell } from '../desktop/app-shell.mjs';

function createApp() {
  const listeners = new Map();
  return {
    listeners,
    quitCalls: 0,
    async whenReady() {},
    on(name, fn) { listeners.set(name, fn); },
    removeListener(name, fn) { if (listeners.get(name) === fn) listeners.delete(name); },
    quit() { this.quitCalls += 1; },
    getVersion() { return '0.1.0'; }
  };
}

function createBrowserWindowClass() {
  const windows = [];
  class BrowserWindow {
    static getAllWindows() { return windows.filter((window) => !window.destroyed); }
    constructor(options) {
      this.options = options;
      this.destroyed = false;
      this.events = new Map();
      this.shown = false;
      this.loaded = null;
      this.webContents = {
        listeners: new Map(),
        mainFrame: { url: 'http://127.0.0.1:4173/' },
        on(name, fn) { this.listeners.set(name, fn); },
        removeListener(name, fn) { if (this.listeners.get(name) === fn) this.listeners.delete(name); },
        setWindowOpenHandler(fn) { this.windowOpenHandler = fn; }
      };
      windows.push(this);
    }
    once(name, fn) { this.events.set(name, fn); }
    async loadURL(url) { this.loaded = url; this.webContents.mainFrame.url = url; }
    show() { this.shown = true; }
    isDestroyed() { return this.destroyed; }
    destroy() { this.destroyed = true; }
  }
  return BrowserWindow;
}

const app = createApp();
const BrowserWindow = createBrowserWindowClass();
let trustedSender;
let bridgeDisposed = 0;
let permissionDisposed = 0;
let bridgeArgs;
let permissionArgs;

const shell = createElectronAppShell({
  app,
  BrowserWindow,
  ipcMain: { handle() {}, removeHandler() {} },
  shell: { openExternal() {} },
  osModule: {},
  preloadPath: '/safe/preload.mjs',
  startUrl: 'http://127.0.0.1:4173/',
  appOpeners: { calculator() {} },
  allowedBrowserOrigins: ['https://github.com'],
  registerDeviceBridge(args) {
    bridgeArgs = args;
    trustedSender = args.isTrustedSender;
    return { dispose() { bridgeDisposed += 1; } };
  },
  installPermissionPolicy(args) {
    permissionArgs = args;
    return { dispose() { permissionDisposed += 1; } };
  },
  platform: 'linux'
});

const windowRef = await shell.start();
assert.equal(windowRef.loaded, 'http://127.0.0.1:4173/');
assert.equal(shell.rendererOrigin, 'http://127.0.0.1:4173');
assert.deepEqual(bridgeArgs.allowedBrowserOrigins, ['https://github.com']);
assert.equal(typeof bridgeArgs.appOpeners.calculator, 'function');
assert.equal(permissionArgs.rendererOrigin, 'http://127.0.0.1:4173');

assert.equal(trustedSender({ sender: windowRef.webContents, senderFrame: windowRef.webContents.mainFrame }), true);
assert.equal(trustedSender({ sender: {}, senderFrame: windowRef.webContents.mainFrame }), false);
assert.equal(trustedSender({ sender: windowRef.webContents, senderFrame: {} }), false);

windowRef.webContents.mainFrame.url = 'https://evil.example/';
assert.equal(trustedSender({ sender: windowRef.webContents, senderFrame: windowRef.webContents.mainFrame }), false);
windowRef.webContents.mainFrame.url = 'http://127.0.0.1:4173/chat';
assert.equal(trustedSender({ sender: windowRef.webContents, senderFrame: windowRef.webContents.mainFrame }), true);

const navigate = windowRef.webContents.listeners.get('will-navigate');
let blocked = 0;
navigate({ preventDefault() { blocked += 1; } }, 'https://evil.example/');
assert.equal(blocked, 1);
navigate({ preventDefault() { blocked += 1; } }, 'http://127.0.0.1:4173/settings');
assert.equal(blocked, 1);
assert.deepEqual(windowRef.webContents.windowOpenHandler(), { action: 'deny' });

windowRef.events.get('ready-to-show')();
assert.equal(windowRef.shown, true);
windowRef.events.get('closed')();
assert.equal(bridgeDisposed, 1);
assert.equal(permissionDisposed, 1);

const recreated = await shell.createWindow();
assert.notEqual(recreated, windowRef);
assert.equal(recreated.loaded, 'http://127.0.0.1:4173/');

app.listeners.get('window-all-closed')();
assert.equal(app.quitCalls, 1);
shell.dispose();
assert.equal(bridgeDisposed, 2);
assert.equal(permissionDisposed, 2);
assert.equal(app.listeners.size, 0);
assert.equal(recreated.destroyed, true);
await assert.rejects(shell.createWindow(), /DESKTOP_APP_SHELL_DISPOSED/);

for (const badUrl of ['https://example.com/', 'file:///tmp/app.html', 'http://user:pass@127.0.0.1:4173/']) {
  assert.throws(() => createElectronAppShell({
    app: createApp(), BrowserWindow: createBrowserWindowClass(), ipcMain: {}, shell: {}, osModule: {}, preloadPath: '/x',
    startUrl: badUrl, registerDeviceBridge() {}, installPermissionPolicy() {}
  }), /INVALID_DESKTOP_APP_URL/);
}

console.log('desktop app shell device trust tests passed');
