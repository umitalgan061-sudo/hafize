const SYSTEM_INFO_FIELDS = new Set(['platform', 'arch', 'release', 'hostname']);
const COMMAND_FIELDS = new Set(['action', 'explicitUserIntent', 'url', 'appId']);
const ACTIONS = new Set(['system.info', 'browser.open', 'app.open']);
const APP_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{1,63}$/;
const MAX_URL_LENGTH = 2048;

function fail(error) {
  return { ok: false, error };
}

function requireObject(input, error = 'INVALID_DEVICE_BRIDGE_COMMAND:input') {
  if (!input || Array.isArray(input) || typeof input !== 'object') throw new Error(error);
}

function exactFields(input, allowed) {
  for (const key of Object.keys(input)) {
    if (!allowed.has(key)) throw new Error('INVALID_DEVICE_BRIDGE_COMMAND:field');
  }
}

function cleanText(value, label, max = 200) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > max) throw new Error(`INVALID_DEVICE_BRIDGE_COMMAND:${label}`);
  return text;
}

function normalizeUrl(value) {
  const text = cleanText(value, 'url', MAX_URL_LENGTH);
  let parsed;
  try {
    parsed = new URL(text);
  } catch {
    throw new Error('INVALID_DEVICE_BRIDGE_COMMAND:url');
  }
  if (parsed.protocol !== 'https:') throw new Error('DEVICE_BRIDGE_URL_PROTOCOL_NOT_ALLOWED');
  if (parsed.username || parsed.password) throw new Error('DEVICE_BRIDGE_URL_CREDENTIALS_NOT_ALLOWED');
  return parsed.toString();
}

function normalizeAppId(value) {
  const appId = cleanText(value, 'appId', 64).toLowerCase();
  if (!APP_ID_PATTERN.test(appId)) throw new Error('INVALID_DEVICE_BRIDGE_COMMAND:appId');
  return appId;
}

export function normalizeDeviceBridgeCommand(input) {
  try {
    requireObject(input);
    exactFields(input, COMMAND_FIELDS);
    const action = cleanText(input.action, 'action', 40);
    if (!ACTIONS.has(action)) throw new Error('DEVICE_BRIDGE_ACTION_NOT_ALLOWED');

    if (action === 'system.info') {
      if ('url' in input || 'appId' in input) throw new Error('INVALID_DEVICE_BRIDGE_COMMAND:field');
      return { ok: true, command: { action } };
    }

    if (input.explicitUserIntent !== true) {
      throw new Error('DEVICE_BRIDGE_ACTION_REQUIRES_EXPLICIT_USER_INTENT');
    }

    if (action === 'browser.open') {
      if ('appId' in input) throw new Error('INVALID_DEVICE_BRIDGE_COMMAND:field');
      return { ok: true, command: { action, url: normalizeUrl(input.url) } };
    }

    if ('url' in input) throw new Error('INVALID_DEVICE_BRIDGE_COMMAND:field');
    return { ok: true, command: { action, appId: normalizeAppId(input.appId) } };
  } catch (error) {
    return fail(error.message);
  }
}

export function normalizeSystemInfo(input) {
  try {
    requireObject(input, 'INVALID_DEVICE_SYSTEM_INFO:input');
    for (const key of Object.keys(input)) {
      if (!SYSTEM_INFO_FIELDS.has(key)) throw new Error('INVALID_DEVICE_SYSTEM_INFO:field');
    }
    const result = {};
    for (const field of SYSTEM_INFO_FIELDS) {
      if (input[field] != null) result[field] = cleanText(input[field], field, 200);
    }
    if (!result.platform || !result.arch) throw new Error('INVALID_DEVICE_SYSTEM_INFO:required');
    return { ok: true, info: result };
  } catch (error) {
    return fail(error.message);
  }
}

export function createDeviceBridge({ systemInfo, openExternal, openApp, allowedApps = [] } = {}) {
  if (typeof systemInfo !== 'function') throw new Error('INVALID_DEVICE_BRIDGE:systemInfo');
  if (typeof openExternal !== 'function') throw new Error('INVALID_DEVICE_BRIDGE:openExternal');
  if (typeof openApp !== 'function') throw new Error('INVALID_DEVICE_BRIDGE:openApp');
  if (!Array.isArray(allowedApps)) throw new Error('INVALID_DEVICE_BRIDGE:allowedApps');

  const appAllowlist = new Set(allowedApps.map((value) => normalizeAppId(value)));

  async function execute(input) {
    const normalized = normalizeDeviceBridgeCommand(input);
    if (!normalized.ok) return normalized;
    const command = normalized.command;

    try {
      if (command.action === 'system.info') {
        const info = normalizeSystemInfo(await systemInfo());
        return info.ok ? { ok: true, action: command.action, info: info.info } : info;
      }

      if (command.action === 'browser.open') {
        await openExternal(command.url);
        return { ok: true, action: command.action };
      }

      if (!appAllowlist.has(command.appId)) return fail('DEVICE_BRIDGE_APP_NOT_ALLOWED');
      await openApp(command.appId);
      return { ok: true, action: command.action, appId: command.appId };
    } catch (error) {
      return fail(error?.message || 'DEVICE_BRIDGE_EXECUTION_FAILED');
    }
  }

  return Object.freeze({ execute, allowedApps: Object.freeze([...appAllowlist]) });
}

export const DEVICE_BRIDGE_CONTRACT = Object.freeze({
  actions: Object.freeze([...ACTIONS]),
  systemInfoFields: Object.freeze([...SYSTEM_INFO_FIELDS]),
  browserProtocols: Object.freeze(['https:']),
  shellExecutionAllowed: false
});
