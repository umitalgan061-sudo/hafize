import { DEVICE_BRIDGE_CHANNEL } from './device-bridge-contract.mjs';

function fail(code) { throw new Error(code); }

export function exposeDeviceBridge({
  contextBridge,
  ipcRenderer,
  namespace = 'hafizeDevice',
  hasActiveUserGesture = () => globalThis.navigator?.userActivation?.isActive === true
} = {}) {
  if (typeof contextBridge?.exposeInMainWorld !== 'function') fail('INVALID_DEVICE_PRELOAD:contextBridge');
  if (typeof ipcRenderer?.invoke !== 'function') fail('INVALID_DEVICE_PRELOAD:ipcRenderer');
  if (typeof namespace !== 'string' || !/^[a-z][A-Za-z0-9]{2,40}$/.test(namespace)) fail('INVALID_DEVICE_PRELOAD:namespace');
  if (typeof hasActiveUserGesture !== 'function') fail('INVALID_DEVICE_PRELOAD:userGesture');

  const invoke = (operation, args = {}) => ipcRenderer.invoke(DEVICE_BRIDGE_CHANNEL, { operation, args });
  const invokeUserAction = (operation, args) => {
    if (hasActiveUserGesture() !== true) return Promise.resolve({ ok: false, error: 'DEVICE_ACTION_REQUIRES_ACTIVE_USER_GESTURE' });
    return invoke(operation, { ...args, explicitUserIntent: true });
  };
  const api = Object.freeze({
    getSystemInfo: () => invoke('system.info'),
    getCapabilities: () => invoke('capabilities.read'),
    openBrowser: (url) => invokeUserAction('browser.open', { url }),
    openApp: (appId) => invokeUserAction('app.open', { appId })
  });
  contextBridge.exposeInMainWorld(namespace, api);
  return api;
}
