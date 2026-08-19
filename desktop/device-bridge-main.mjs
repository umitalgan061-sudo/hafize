import { createDeviceBridgeHandler, DEVICE_BRIDGE_CHANNEL } from './device-bridge-contract.mjs';

const activeRegistrations = new WeakMap();

function fail(code) { throw new Error(code); }

export function registerElectronDeviceBridge({
  ipcMain,
  shell,
  app,
  osModule,
  appOpeners = {},
  allowedBrowserOrigins = [],
  isTrustedSender
} = {}) {
  if (typeof ipcMain?.handle !== 'function' || typeof ipcMain?.removeHandler !== 'function') fail('INVALID_DEVICE_MAIN:ipcMain');
  if (typeof shell?.openExternal !== 'function') fail('INVALID_DEVICE_MAIN:shell');
  if (typeof app?.getVersion !== 'function') fail('INVALID_DEVICE_MAIN:app');
  if (typeof isTrustedSender !== 'function') fail('INVALID_DEVICE_MAIN:isTrustedSender');
  if (typeof osModule?.platform !== 'function' || typeof osModule?.arch !== 'function' || typeof osModule?.cpus !== 'function' || typeof osModule?.totalmem !== 'function') {
    fail('INVALID_DEVICE_MAIN:os');
  }
  if (activeRegistrations.has(ipcMain)) fail('DEVICE_BRIDGE_ALREADY_REGISTERED');

  const handler = createDeviceBridgeHandler({
    appOpeners,
    allowedBrowserOrigins,
    openExternal: (url) => shell.openExternal(url),
    getSystemInfo: async () => ({
      platform: osModule.platform(),
      arch: osModule.arch(),
      appVersion: app.getVersion(),
      cpuCount: osModule.cpus().length,
      totalMemoryMb: Math.round(osModule.totalmem() / (1024 * 1024))
    })
  });
  const registration = Object.freeze({ token: Symbol('device-bridge-registration') });
  let disposed = false;

  ipcMain.handle(DEVICE_BRIDGE_CHANNEL, async (event, request) => {
    if (isTrustedSender(event) !== true) return { ok: false, error: 'DEVICE_RENDERER_NOT_TRUSTED' };
    return handler.handle(request);
  });
  activeRegistrations.set(ipcMain, registration);

  return Object.freeze({
    allowedApps: handler.allowedApps,
    allowedBrowserOrigins: handler.allowedBrowserOrigins,
    dispose() {
      if (disposed) return;
      disposed = true;
      if (activeRegistrations.get(ipcMain) !== registration) return;
      activeRegistrations.delete(ipcMain);
      ipcMain.removeHandler(DEVICE_BRIDGE_CHANNEL);
    }
  });
}
