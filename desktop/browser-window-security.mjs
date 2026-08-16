import { isAbsolute } from 'node:path';

function fail(field) { throw new Error(`INVALID_DESKTOP_WINDOW:${field}`); }

export function createSecureWebPreferences({ preloadPath } = {}) {
  if (typeof preloadPath !== 'string' || !isAbsolute(preloadPath)) fail('preloadPath');
  return Object.freeze({
    preload: preloadPath,
    contextIsolation: true,
    sandbox: true,
    nodeIntegration: false,
    nodeIntegrationInWorker: false,
    webSecurity: true,
    allowRunningInsecureContent: false,
    webviewTag: false
  });
}

export function assertSecureWebPreferences(value) {
  if (!value || Array.isArray(value) || typeof value !== 'object') fail('webPreferences');
  const required = {
    contextIsolation: true,
    sandbox: true,
    nodeIntegration: false,
    nodeIntegrationInWorker: false,
    webSecurity: true,
    allowRunningInsecureContent: false,
    webviewTag: false
  };
  for (const [key, expected] of Object.entries(required)) {
    if (value[key] !== expected) fail(key);
  }
  if (typeof value.preload !== 'string' || !isAbsolute(value.preload)) fail('preload');
  return true;
}
