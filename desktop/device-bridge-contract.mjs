const CHANNEL = 'hafize:device:invoke';
const APP_ID_PATTERN = /^[a-z][a-z0-9._-]{1,63}$/;
const MAX_URL_LENGTH = 2048;
const MAX_BROWSER_ORIGINS = 32;

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function exactObject(value, allowed) {
  if (!value || Array.isArray(value) || typeof value !== 'object') return false;
  return Object.keys(value).every((key) => allowed.has(key));
}

function normalizeHttpsUrl(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > MAX_URL_LENGTH) fail('INVALID_DEVICE_URL');
  let url;
  try { url = new URL(value); } catch { fail('INVALID_DEVICE_URL'); }
  if (url.protocol !== 'https:' || url.username || url.password) fail('INVALID_DEVICE_URL');
  return url.toString();
}

function normalizeBrowserOrigins(value) {
  if (!Array.isArray(value) || value.length > MAX_BROWSER_ORIGINS) fail('INVALID_DEVICE_BROWSER_ORIGINS');
  const origins = new Set();
  for (const candidate of value) {
    if (typeof candidate !== 'string' || !candidate.trim() || candidate.length > MAX_URL_LENGTH) fail('INVALID_DEVICE_BROWSER_ORIGIN');
    let url;
    try { url = new URL(candidate); } catch { fail('INVALID_DEVICE_BROWSER_ORIGIN'); }
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash || url.origin !== candidate.trim().replace(/\/$/, '')) {
      fail('INVALID_DEVICE_BROWSER_ORIGIN');
    }
    origins.add(url.origin);
  }
  return Object.freeze([...origins]);
}

function normalizeAppId(value) {
  if (typeof value !== 'string' || !APP_ID_PATTERN.test(value)) fail('INVALID_DEVICE_APP_ID');
  return value;
}

export function normalizeDeviceRequest(input) {
  if (!exactObject(input, new Set(['operation', 'args']))) fail('INVALID_DEVICE_REQUEST');
  if (typeof input.operation !== 'string') fail('INVALID_DEVICE_REQUEST');
  const args = input.args ?? {};

  if (input.operation === 'system.info') {
    if (!exactObject(args, new Set())) fail('INVALID_DEVICE_REQUEST');
    return Object.freeze({ operation: 'system.info', args: Object.freeze({}) });
  }

  if (input.operation === 'browser.open') {
    if (!exactObject(args, new Set(['url', 'explicitUserIntent'])) || args.explicitUserIntent !== true) {
      fail('DEVICE_ACTION_REQUIRES_EXPLICIT_USER_INTENT');
    }
    return Object.freeze({
      operation: 'browser.open',
      args: Object.freeze({ url: normalizeHttpsUrl(args.url), explicitUserIntent: true })
    });
  }

  if (input.operation === 'app.open') {
    if (!exactObject(args, new Set(['appId', 'explicitUserIntent'])) || args.explicitUserIntent !== true) {
      fail('DEVICE_ACTION_REQUIRES_EXPLICIT_USER_INTENT');
    }
    return Object.freeze({
      operation: 'app.open',
      args: Object.freeze({ appId: normalizeAppId(args.appId), explicitUserIntent: true })
    });
  }

  fail('DEVICE_OPERATION_NOT_ALLOWED');
}

function sanitizeSystemInfo(value) {
  if (!value || Array.isArray(value) || typeof value !== 'object') fail('INVALID_DEVICE_SYSTEM_INFO');
  const platform = typeof value.platform === 'string' ? value.platform.slice(0, 32) : '';
  const arch = typeof value.arch === 'string' ? value.arch.slice(0, 32) : '';
  const appVersion = typeof value.appVersion === 'string' ? value.appVersion.slice(0, 64) : '';
  const cpuCount = Number.isInteger(value.cpuCount) ? Math.min(Math.max(value.cpuCount, 0), 512) : 0;
  const totalMemoryMb = Number.isInteger(value.totalMemoryMb) ? Math.min(Math.max(value.totalMemoryMb, 0), 16_777_216) : 0;
  return Object.freeze({ platform, arch, appVersion, cpuCount, totalMemoryMb });
}

export function createDeviceBridgeHandler({ getSystemInfo, openExternal, appOpeners = {}, allowedBrowserOrigins = [] } = {}) {
  if (typeof getSystemInfo !== 'function') fail('INVALID_DEVICE_BRIDGE:getSystemInfo');
  if (typeof openExternal !== 'function') fail('INVALID_DEVICE_BRIDGE:openExternal');
  if (!appOpeners || Array.isArray(appOpeners) || typeof appOpeners !== 'object') fail('INVALID_DEVICE_BRIDGE:appOpeners');
  const browserOrigins = normalizeBrowserOrigins(allowedBrowserOrigins);
  const allowedBrowserOriginSet = new Set(browserOrigins);

  const allowedApps = new Map();
  for (const [appId, opener] of Object.entries(appOpeners)) {
    normalizeAppId(appId);
    if (typeof opener !== 'function') fail('INVALID_DEVICE_BRIDGE:appOpener');
    allowedApps.set(appId, opener);
  }

  async function handle(rawRequest) {
    let request;
    try { request = normalizeDeviceRequest(rawRequest); }
    catch (error) { return { ok: false, error: error?.code || 'INVALID_DEVICE_REQUEST' }; }

    try {
      if (request.operation === 'system.info') {
        return { ok: true, value: sanitizeSystemInfo(await getSystemInfo()) };
      }
      if (request.operation === 'browser.open') {
        const origin = new URL(request.args.url).origin;
        if (!allowedBrowserOriginSet.has(origin)) return { ok: false, error: 'DEVICE_BROWSER_ORIGIN_NOT_ALLOWED' };
        await openExternal(request.args.url);
        return { ok: true, value: { opened: true, kind: 'browser' } };
      }
      const opener = allowedApps.get(request.args.appId);
      if (!opener) return { ok: false, error: 'DEVICE_APP_NOT_ALLOWED' };
      await opener();
      return { ok: true, value: { opened: true, kind: 'app', appId: request.args.appId } };
    } catch {
      return { ok: false, error: 'DEVICE_ACTION_FAILED' };
    }
  }

  return Object.freeze({
    channel: CHANNEL,
    handle,
    allowedApps: Object.freeze([...allowedApps.keys()]),
    allowedBrowserOrigins: browserOrigins
  });
}

export const DEVICE_BRIDGE_CHANNEL = CHANNEL;
