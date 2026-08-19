import { createSecureWebPreferences } from './browser-window-security.mjs';
import { registerElectronDeviceBridge } from './device-bridge-main.mjs';
import { installElectronSessionPermissionPolicy } from './session-permission-policy.mjs';

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
    const contents = windowRef.webContents;
    if (!contents || event?.sender !== contents) return false;
    if (!contents.mainFrame || event?.senderFrame !== contents.mainFrame) return false;
    return isAllowedRendererUrl(contents.mainFrame.url, origin);
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
  allowAudioMedia = false,
  platform = process.platform,
  registerDeviceBridge = registerElectronDeviceBridge,
  installPermissionPolicy = installElectronSessionPermissionPolicy
} = {}) {
  if (typeof app?.whenReady !== 'function' || typeof app?.on !== 'function' || typeof app?.quit !== 'function') fail('INVALID_DESKTOP_APP_SHELL:app');
  if (typeof BrowserWindow !== 'function' || typeof BrowserWindow.getAllWindows !== 'function') fail('INVALID_DESKTOP_APP_SHELL:BrowserWindow');
  if (typeof registerDeviceBridge !== 'function') fail('INVALID_DESKTOP_APP_SHELL:registerDeviceBridge');
  if (typeof installPermissionPolicy !== 'function') fail('INVALID_DESKTOP_APP_SHELL:installPermissionPolicy');
  if (typeof platform !== 'string' || !platform) fail('INVALID_DESKTOP_APP_SHELL:platform');
  const appUrl = normalizeAppUrl(startUrl);
  const webPreferences = createSecureWebPreferences({ preloadPath });
  let windowRef = null;
  let bridgeRef = null;
  let permissionRef = null;
  let removeNavigationGuards = null;
  let readyToShowRef = null;
  let appListenersInstalled = false;
  let startInFlight = null;
  let disposed = false;

  function clearReadyToShow(window = windowRef) {
    if (!readyToShowRef || readyToShowRef.window !== window) return;
    window?.removeListener?.('ready-to-show', readyToShowRef.handler);
    readyToShowRef = null;
  }

  function disposeWindowBindings(window = windowRef) {
    clearReadyToShow(window);
    removeNavigationGuards?.();
    removeNavigationGuards = null;
    bridgeRef?.dispose?.();
    bridgeRef = null;
    permissionRef?.dispose?.();
    permissionRef = null;
  }

  function handleActivate() {
    if (disposed || BrowserWindow.getAllWindows().length !== 0) return;
    void createWindow().catch(() => {});
  }

  function handleWindowAllClosed() {
    if (platform !== 'darwin') app.quit();
  }

  function installAppListeners() {
    if (appListenersInstalled) return;
    app.on('activate', handleActivate);
    try {
      app.on('window-all-closed', handleWindowAllClosed);
    } catch (error) {
      app.removeListener?.('activate', handleActivate);
      throw error;
    }
    appListenersInstalled = true;
  }

  function removeAppListeners() {
    if (!appListenersInstalled) return;
    appListenersInstalled = false;
    app.removeListener?.('activate', handleActivate);
    app.removeListener?.('window-all-closed', handleWindowAllClosed);
  }

  function cleanupFailedWindow(window) {
    disposeWindowBindings(window);
    window.destroy?.();
    if (windowRef === window) windowRef = null;
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
    window.once?.('closed', () => {
      if (windowRef !== window) return;
      disposeWindowBindings(window);
      windowRef = null;
    });

    try {
      removeNavigationGuards = installNavigationGuards(window, appUrl.origin);
      permissionRef = installPermissionPolicy({ webContents: window.webContents, rendererOrigin: appUrl.origin, allowAudioMedia });
      bridgeRef = registerDeviceBridge({
        ipcMain,
        shell,
        app,
        osModule,
        appOpeners,
        allowedBrowserOrigins,
        isTrustedSender: createTrustedSender(window, appUrl.origin)
      });
      const handleReadyToShow = () => {
        if (readyToShowRef?.window === window) readyToShowRef = null;
        if (disposed || windowRef !== window || window.isDestroyed?.()) return;
        window.show?.();
      };
      readyToShowRef = { window, handler: handleReadyToShow };
      window.once?.('ready-to-show', handleReadyToShow);
    } catch {
      cleanupFailedWindow(window);
      fail('DESKTOP_APP_BINDINGS_FAILED');
    }

    try {
      await window.loadURL(appUrl.href);
    } catch {
      cleanupFailedWindow(window);
      fail('DESKTOP_APP_LOAD_FAILED');
    }
    return window;
  }

  async function start() {
    if (disposed) fail('DESKTOP_APP_SHELL_DISPOSED');
    if (startInFlight) return startInFlight;
    const run = (async () => {
      await app.whenReady();
      if (disposed) fail('DESKTOP_APP_SHELL_DISPOSED');
      installAppListeners();
      return createWindow();
    })();
    startInFlight = run;
    try {
      return await run;
    } catch (error) {
      if (!disposed && !windowRef) removeAppListeners();
      throw error;
    } finally {
      if (startInFlight === run) startInFlight = null;
    }
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    removeAppListeners();
    disposeWindowBindings(windowRef);
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
