import { DEVICE_BRIDGE_CHANNEL } from './device-bridge-contract.mjs';

function fail(code) { throw new Error(code); }

export function exposeDeviceBridge({ contextBridge, ipcRenderer, namespace = 'hafizeDevice' } = {}) {
  if (typeof contextBridge?.exposeInMainWorld !== 'function') fail('INVALID_DEVICE_PRELOAD:contextBridge');
  if (typeof ipcRenderer?.invoke !== 'function') fail('INVALID_DEVICE_PRELOAD:ipcRenderer');
  if (typeof namespace !== 'string' || !/^[a-z][A-Za-z0-9]{2,40}$/.test(namespace)) fail('INVALID_DEVICE_PRELOAD:namespace');

  const invoke = (operation, args = {}) => ipcRenderer.invoke(DEVICE_BRIDGE_CHANNEL, { operation, args });
  const api = Object.freeze({
    getSystemInfo: () => invoke('system.info'),
    openBrowser: (url, { explicitUserIntent = false } = {}) => invoke('browser.open', { url, explicitUserIntent }),
    openApp: (appId, { explicitUserIntent = false } = {}) => invoke('app.open', { appId, explicitUserIntent })
  });
  contextBridge.exposeInMainWorld(namespace, api);
  return api;
}
