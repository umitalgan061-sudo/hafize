const CHANNEL = 'hafize:device:invoke';
const APP_ID_PATTERN = /^[a-z][a-z0-9._-]{1,63}$/;
const ACTION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_URL_LENGTH = 2048;
const MAX_BROWSER_ORIGINS = 32;
const MAX_DEVICE_ACTIONS = 512;
const DEVICE_ACTION_TTL_MS = 5 * 60_000;

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

function normalizeActionId(value) {
  if (typeof value !== 'string' || !ACTION_ID_PATTERN.test(value)) fail('INVALID_DEVICE_ACTION_ID');
  return value.toLowerCase();
}

export function normalizeDeviceRequest(input) {
  if (!exactObject(input, new Set(['operation', 'args']))) fail('INVALID_DEVICE_REQUEST');
  if (typeof input.operation !== 'string') fail('INVALID_DEVICE_REQUEST');
  const args = input.args ?? {};

  if (input.operation === 'system.info' || input.operation === 'capabilities.read') {
    if (!exactObject(args, new Set())) fail('INVALID_DEVICE_REQUEST');
    return Object.freeze({ operation: input.operation, args: Object.freeze({}) });
  }

  if (input.operation === 'browser.open') {
    if (!exactObject(args, new Set(['url', 'explicitUserIntent', 'actionId'])) || args.explicitUserIntent !== true) {
      fail('DEVICE_ACTION_REQUIRES_EXPLICIT_USER_INTENT');
    }
    return Object.freeze({
      operation: 'browser.open',
      args: Object.freeze({
        url: normalizeHttpsUrl(args.url),
        explicitUserIntent: true,
        actionId: normalizeActionId(args.actionId)
      })
    });
  }

  if (input.operation === 'app.open') {
    if (!exactObject(args, new Set(['appId', 'explicitUserIntent', 'actionId'])) || args.explicitUserIntent !== true) {
      fail('DEVICE_ACTION_REQUIRES_EXPLICIT_USER_INTENT');
    }
    return Object.freeze({
      operation: 'app.open',
      args: Object.freeze({
        appId: normalizeAppId(args.appId),
        explicitUserIntent: true,
        actionId: normalizeActionId(args.actionId)
      })
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

function createReplayLedger({ now = Date.now, ttlMs = DEVICE_ACTION_TTL_MS, maxActions = MAX_DEVICE_ACTIONS } = {}) {
  if (typeof now !== 'function') fail('INVALID_DEVICE_ACTION_LEDGER_NOW');
  if (!Number.isSafeInteger(ttlMs) || ttlMs < 1 || ttlMs > 60 * 60_000) fail('INVALID_DEVICE_ACTION_LEDGER_TTL');
  if (!Number.isSafeInteger(maxActions) || maxActions < 1 || maxActions > 4096) fail('INVALID_DEVICE_ACTION_LEDGER_SIZE');
  const consumed = new Map();

  function prune(timestamp) {
    for (const [actionId, consumedAt] of consumed) {
      if (timestamp - consumedAt < ttlMs) continue;
      consumed.delete(actionId);
    }
  }

  function consume(actionId) {
    const timestamp = Number(now());
    if (!Number.isFinite(timestamp) || timestamp < 0) fail('INVALID_DEVICE_ACTION_LEDGER_TIME');
    prune(timestamp);
    if (consumed.has(actionId)) return false;
    if (consumed.size >= maxActions) fail('DEVICE_ACTION_LEDGER_FULL');
    consumed.set(actionId, timestamp);
    return true;
  }

  return Object.freeze({ consume });
}

export function createDeviceBridgeHandler({
  getSystemInfo,
  openExternal,
  appOpeners = {},
  allowedBrowserOrigins = [],
  now = Date.now,
  actionTtlMs = DEVICE_ACTION_TTL_MS,
  maxActions = MAX_DEVICE_ACTIONS
} = {}) {
  if (typeof getSystemInfo !== 'function') fail('INVALID_DEVICE_BRIDGE:getSystemInfo');
  if (typeof openExternal !== 'function') fail('INVALID_DEVICE_BRIDGE:openExternal');
  if (!appOpeners || Array.isArray(appOpeners) || typeof appOpeners !== 'object') fail('INVALID_DEVICE_BRIDGE:appOpeners');
  const browserOrigins = normalizeBrowserOrigins(allowedBrowserOrigins);
  const allowedBrowserOriginSet = new Set(browserOrigins);
  const replayLedger = createReplayLedger({ now, ttlMs: actionTtlMs, maxActions });

  const allowedApps = new Map();
  for (const [appId, opener] of Object.entries(appOpeners)) {
    normalizeAppId(appId);
    if (typeof opener !== 'function') fail('INVALID_DEVICE_BRIDGE:appOpener');
    allowedApps.set(appId, opener);
  }
  const capabilities = Object.freeze({
    browserOrigins,
    appIds: Object.freeze([...allowedApps.keys()])
  });

  function consumeAction(actionId) {
    try {
      return replayLedger.consume(actionId)
        ? null
        : { ok: false, error: 'DEVICE_ACTION_REPLAYED' };
    } catch (error) {
      return { ok: false, error: error?.code || 'DEVICE_ACTION_REPLAY_GUARD_FAILED' };
    }
  }

  async function handle(rawRequest) {
    let request;
    try { request = normalizeDeviceRequest(rawRequest); }
    catch (error) { return { ok: false, error: error?.code || 'INVALID_DEVICE_REQUEST' }; }

    try {
      if (request.operation === 'system.info') {
        return { ok: true, value: sanitizeSystemInfo(await getSystemInfo()) };
      }
      if (request.operation === 'capabilities.read') {
        return { ok: true, value: capabilities };
      }
      if (request.operation === 'browser.open') {
        const origin = new URL(request.args.url).origin;
        if (!allowedBrowserOriginSet.has(origin)) return { ok: false, error: 'DEVICE_BROWSER_ORIGIN_NOT_ALLOWED' };
        const replayError = consumeAction(request.args.actionId);
        if (replayError) return replayError;
        await openExternal(request.args.url);
        return { ok: true, value: { opened: true, kind: 'browser' } };
      }
      const opener = allowedApps.get(request.args.appId);
      if (!opener) return { ok: false, error: 'DEVICE_APP_NOT_ALLOWED' };
      const replayError = consumeAction(request.args.actionId);
      if (replayError) return replayError;
      await opener();
      return { ok: true, value: { opened: true, kind: 'app', appId: request.args.appId } };
    } catch {
      return { ok: false, error: 'DEVICE_ACTION_FAILED' };
    }
  }

  return Object.freeze({
    channel: CHANNEL,
    handle,
    allowedApps: capabilities.appIds,
    allowedBrowserOrigins: browserOrigins
  });
}

export const DEVICE_BRIDGE_CHANNEL = CHANNEL;
export const DEVICE_ACTION_TTL = DEVICE_ACTION_TTL_MS;
export const DEVICE_ACTION_LEDGER_LIMIT = MAX_DEVICE_ACTIONS;
