import assert from 'node:assert/strict';
import { createElectronAppShell } from '../desktop/app-shell.mjs';
import { DEVICE_BRIDGE_CHANNEL } from '../desktop/device-bridge-contract.mjs';

const ACTION_BROWSER = '30000000-0000-4000-8000-000000000001';
const ACTION_BLOCKED = '30000000-0000-4000-8000-000000000002';
const ACTION_APP = '30000000-0000-4000-8000-000000000003';

class WebContents {
  constructor() {
    this.listeners = new Map();
    this.mainFrame = { url: '' };
  }
  on(name, fn) { this.listeners.set(name, fn); }
  removeListener(name, fn) {
    if (this.listeners.get(name) === fn) this.listeners.delete(name);
  }
  setWindowOpenHandler(fn) { this.openHandler = fn; }
}

const windows = [];
class Window {
  static getAllWindows() { return windows.filter((window) => !window.destroyed); }
  constructor(options) {
    this.options = options;
    this.webContents = new WebContents();
    this.events = new Map();
    windows.push(this);
  }
  once(name, fn) { this.events.set(name, fn); }
  async loadURL(url) {
    this.url = url;
    this.webContents.mainFrame.url = url;
  }
  isDestroyed() { return Boolean(this.destroyed); }
  show() {}
  destroy() {
    this.destroyed = true;
    this.events.get('closed')?.();
  }
}

const ipcHandlers = new Map();
const ipcMain = {
  handle(name, fn) { ipcHandlers.set(name, fn); },
  removeHandler(name) { ipcHandlers.delete(name); }
};
const app = {
  async whenReady() {},
  on() {},
  removeListener() {},
  quit() {},
  getVersion() { return '2.0.0'; }
};
const externalUrls = [];
const shell = { async openExternal(url) { externalUrls.push(url); } };
const osModule = {
  platform: () => 'linux',
  arch: () => 'arm64',
  cpus: () => [{}, {}, {}, {}],
  totalmem: () => 8 * 1024 * 1024 * 1024
};
let appOpenCalls = 0;

const desktop = createElectronAppShell({
  app,
  BrowserWindow: Window,
  ipcMain,
  shell,
  osModule,
  preloadPath: '/absolute/preload.mjs',
  allowedBrowserOrigins: ['https://example.com'],
  appOpeners: { notes: async () => { appOpenCalls += 1; } },
  installPermissionPolicy: () => ({ dispose() {} }),
  platform: 'linux'
});
const windowRef = await desktop.start();
const invoke = ipcHandlers.get(DEVICE_BRIDGE_CHANNEL);
assert.equal(typeof invoke, 'function');
const trustedEvent = {
  sender: windowRef.webContents,
  senderFrame: windowRef.webContents.mainFrame
};

const info = await invoke(trustedEvent, { operation: 'system.info', args: {} });
assert.deepEqual(info, {
  ok: true,
  value: { platform: 'linux', arch: 'arm64', appVersion: '2.0.0', cpuCount: 4, totalMemoryMb: 8192 }
});
const browser = await invoke(trustedEvent, {
  operation: 'browser.open',
  args: { url: 'https://example.com/help', explicitUserIntent: true, actionId: ACTION_BROWSER }
});
assert.equal(browser.ok, true);
assert.deepEqual(externalUrls, ['https://example.com/help']);
const blockedBrowser = await invoke(trustedEvent, {
  operation: 'browser.open',
  args: { url: 'https://evil.example/help', explicitUserIntent: true, actionId: ACTION_BLOCKED }
});
assert.deepEqual(blockedBrowser, { ok: false, error: 'DEVICE_BROWSER_ORIGIN_NOT_ALLOWED' });
assert.deepEqual(externalUrls, ['https://example.com/help'], 'blocked origin must not reach Electron shell');
const openedApp = await invoke(trustedEvent, {
  operation: 'app.open',
  args: { appId: 'notes', explicitUserIntent: true, actionId: ACTION_APP }
});
assert.equal(openedApp.ok, true);
assert.equal(appOpenCalls, 1);

const sameOriginSubframe = await invoke(
  { sender: windowRef.webContents, senderFrame: { url: 'http://127.0.0.1:4173/embedded' } },
  { operation: 'system.info', args: {} }
);
assert.deepEqual(sameOriginSubframe, { ok: false, error: 'DEVICE_RENDERER_NOT_TRUSTED' });

const originalMainUrl = windowRef.webContents.mainFrame.url;
windowRef.webContents.mainFrame.url = 'https://evil.example/';
const navigatedMainFrame = await invoke(trustedEvent, { operation: 'system.info', args: {} });
assert.deepEqual(navigatedMainFrame, { ok: false, error: 'DEVICE_RENDERER_NOT_TRUSTED' });
windowRef.webContents.mainFrame.url = originalMainUrl;

desktop.dispose();
assert.equal(ipcHandlers.has(DEVICE_BRIDGE_CHANNEL), false);
console.log('electron app shell device bridge integration tests passed');
