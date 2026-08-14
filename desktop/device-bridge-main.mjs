import { createDeviceBridgeHandler, DEVICE_BRIDGE_CHANNEL } from './device-bridge-contract.mjs';

function fail(code) { throw new Error(code); }

export function registerElectronDeviceBridge({ ipcMain, shell, app, osModule, appOpeners = {} } = {}) {
  if (typeof ipcMain?.handle !== 'function' || typeof ipcMain?.removeHandler !== 'function') fail('INVALID_DEVICE_MAIN:ipcMain');
  if (typeof shell?.openExternal !== 'function') fail('INVALID_DEVICE_MAIN:shell');
  if (typeof app?.getVersion !== 'function') fail('INVALID_DEVICE_MAIN:app');
  if (typeof osModule?.platform !== 'function' || typeof osModule?.arch !== 'function' || typeof osModule?.cpus !== 'function' || typeof osModule?.totalmem !== 'function') {
    fail('INVALID_DEVICE_MAIN:os');
  }

  const handler = createDeviceBridgeHandler({
    appOpeners,
    openExternal: (url) => shell.openExternal(url),
    getSystemInfo: async () => ({
      platform: osModule.platform(),
      arch: osModule.arch(),
      appVersion: app.getVersion(),
      cpuCount: osModule.cpus().length,
      totalMemoryMb: Math.round(osModule.totalmem() / (1024 * 1024))
    })
  });

  ipcMain.handle(DEVICE_BRIDGE_CHANNEL, async (_event, request) => handler.handle(request));
  return Object.freeze({
    allowedApps: handler.allowedApps,
    dispose() { ipcMain.removeHandler(DEVICE_BRIDGE_CHANNEL); }
  });
}
