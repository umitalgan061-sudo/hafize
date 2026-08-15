import { createSecureWebPreferences } from './browser-window-security.mjs';
import { registerElectronDeviceBridge } from './device-bridge-main.mjs';

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function normalizeAppUrl(value) {
  if (typeof value !== 'string' || !value.trim()) fail('INVALID_DESKTOP_APP_URL');
  let url;
  try { url = new URL(value); } catch { fail('INVALID_DESKTOP_APP_URL'); }
  if (!['http:', 'https:'].includes(url.protocol)) fail('INVALID_DESKTOP_APP_URL');
  if (!['127.0.0.1', 'localhost', '::1'].includes(url.hostname)) fail('INVALID_DESKTOP_APP_URL');
  if (url.username || url.password || url.hash) fail('INVALID_DESKTOP_APP_URL');
  return Object.freeze({ href: url.toString(), origin: url.origin });
}

function isAllowedRendererUrl(value, origin) {
  if (typeof value !== 'string' || !value) return false;
  try {
    const url = new URL(value);
    return url.origin === origin && ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}

function createTrustedSender(windowRef, origin) {
  return (event) => {
    if (!windowRef || windowRef.isDestroyed?.()) return false;
    if (event?.sender !== windowRef.webContents) return false;
    const frameUrl = event?.senderFrame?.url;
    return isAllowedRendererUrl(frameUrl, origin);
  };
}

function installNavigationGuards(windowRef, origin) {
  const contents = windowRef?.webContents;
  if (!contents || typeof contents.on !== 'function' || typeof contents.setWindowOpenHandler !== 'function') {
    fail('INVALID_DESKTOP_APP_SHELL:webContents');
  }

  const handleNavigate = (event, targetUrl) => {
    if (!isAllowedRendererUrl(targetUrl, origin)) event?.preventDefault?.();
  };
  contents.on('will-navigate', handleNavigate);
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));

  return () => {
    contents.removeListener?.('will-navigate', handleNavigate);
    contents.setWindowOpenHandler?.(() => ({ action: 'deny' }));
  };
}

export function createElectronAppShell({
  app,
  BrowserWindow,
  ipcMain,
  shell,
  osModule,
  preloadPath,
  startUrl = 'http://127.0.0.1:4173/',
  appOpeners = {},
  allowedBrowserOrigins = [],
  platform = process.platform,
  registerDeviceBridge = registerElectronDeviceBridge
} = {}) {
  if (typeof app?.whenReady !== 'function' || typeof app?.on !== 'function' || typeof app?.quit !== 'function') fail('INVALID_DESKTOP_APP_SHELL:app');
  if (typeof BrowserWindow !== 'function' || typeof BrowserWindow.getAllWindows !== 'function') fail('INVALID_DESKTOP_APP_SHELL:BrowserWindow');
  if (typeof registerDeviceBridge !== 'function') fail('INVALID_DESKTOP_APP_SHELL:registerDeviceBridge');
  if (typeof platform !== 'string' || !platform) fail('INVALID_DESKTOP_APP_SHELL:platform');
  const appUrl = normalizeAppUrl(startUrl);
  const webPreferences = createSecureWebPreferences({ preloadPath });
  let windowRef = null;
  let bridgeRef = null;
  let removeNavigationGuards = null;
  let disposed = false;

  function disposeWindowBindings() {
    removeNavigationGuards?.();
    removeNavigationGuards = null;
    bridgeRef?.dispose?.();
    bridgeRef = null;
  }

  async function createWindow() {
    if (disposed) fail('DESKTOP_APP_SHELL_DISPOSED');
    if (windowRef && !windowRef.isDestroyed?.()) return windowRef;
    const window = new BrowserWindow({
      width: 1280,
      height: 820,
      minWidth: 360,
      minHeight: 640,
      show: false,
      backgroundColor: '#f7f5f0',
      webPreferences
    });
    windowRef = window;
    removeNavigationGuards = installNavigationGuards(window, appUrl.origin);
    bridgeRef = registerDeviceBridge({
      ipcMain,
      shell,
      app,
      osModule,
      appOpeners,
      allowedBrowserOrigins,
      isTrustedSender: createTrustedSender(window, appUrl.origin)
    });
    window.once?.('ready-to-show', () => window.show?.());
    window.once?.('closed', () => {
      if (windowRef !== window) return;
      disposeWindowBindings();
      windowRef = null;
    });
    try {
      await window.loadURL(appUrl.href);
    } catch {
      disposeWindowBindings();
      window.destroy?.();
      windowRef = null;
      fail('DESKTOP_APP_LOAD_FAILED');
    }
    return window;
  }

  function handleActivate() {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow();
  }

  function handleWindowAllClosed() {
    if (platform !== 'darwin') app.quit();
  }

  async function start() {
    if (disposed) fail('DESKTOP_APP_SHELL_DISPOSED');
    await app.whenReady();
    app.on('activate', handleActivate);
    app.on('window-all-closed', handleWindowAllClosed);
    return createWindow();
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    app.removeListener?.('activate', handleActivate);
    app.removeListener?.('window-all-closed', handleWindowAllClosed);
    disposeWindowBindings();
    if (windowRef && !windowRef.isDestroyed?.()) windowRef.destroy?.();
    windowRef = null;
  }

  return Object.freeze({
    start,
    createWindow,
    dispose,
    getWindow: () => windowRef,
    startUrl: appUrl.href,
    rendererOrigin: appUrl.origin
  });
}

export const DESKTOP_APP_DEFAULT_URL = 'http://127.0.0.1:4173/';
