const OP_SYSTEM_INFO = 'system.info';
const OP_BROWSER_OPEN = 'browser.open';
const OP_APP_OPEN = 'app.open';
const OPERATIONS = new Set([OP_SYSTEM_INFO, OP_BROWSER_OPEN, OP_APP_OPEN]);
const SYSTEM_INFO_FIELDS = new Set(['platform', 'release', 'arch', 'cpuCount', 'totalMemory']);
const REQUEST_FIELDS = new Set(['operation', 'args', 'explicitUserIntent']);
const APP_ID_PATTERN = /^[a-z][a-z0-9._-]{0,79}$/;
const MAX_ALLOWED_ITEMS = 64;
const MAX_URL_LENGTH = 2048;

function invalid(label) {
  throw new Error(`INVALID_DEVICE_BRIDGE:${label}`);
}

function requireObject(value, label) {
  if (!value || Array.isArray(value) || typeof value !== 'object') invalid(label);
  return value;
}

function normalizeStringList(value, label, validate, maxItems = MAX_ALLOWED_ITEMS) {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > maxItems) invalid(label);
  const output = [];
  const seen = new Set();
  for (const raw of value) {
    const item = typeof raw === 'string' ? raw.trim() : '';
    if (!item || !validate(item) || seen.has(item)) invalid(label);
    seen.add(item);
    output.push(item);
  }
  return output;
}

function normalizeOrigins(value) {
  return normalizeStringList(value, 'allowedWebOrigins', (item) => {
    try {
      const url = new URL(item);
      return url.protocol === 'https:'
        && url.origin === item
        && !url.username
        && !url.password
        && !url.pathname.replace(/\//g, '')
        && !url.search
        && !url.hash;
    } catch {
      return false;
    }
  });
}

function normalizeApps(value) {
  return normalizeStringList(value, 'allowedApps', (item) => APP_ID_PATTERN.test(item));
}

function normalizeInfoFields(value) {
  const fields = normalizeStringList(
    value,
    'allowedSystemInfo',
    (item) => SYSTEM_INFO_FIELDS.has(item),
    SYSTEM_INFO_FIELDS.size
  );
  return fields.length ? fields : ['platform', 'release', 'arch'];
}

function requireExplicitIntent(input) {
  if (input.explicitUserIntent !== true) {
    throw new Error('DEVICE_BRIDGE_REQUIRES_EXPLICIT_USER_INTENT');
  }
}

function normalizeBrowserArgs(args, allowedOrigins) {
  const input = requireObject(args, 'args');
  if (Object.keys(input).some((key) => key !== 'url')) invalid('browser.args');
  const text = typeof input.url === 'string' ? input.url.trim() : '';
  if (!text || text.length > MAX_URL_LENGTH) invalid('browser.url');
  let url;
  try {
    url = new URL(text);
  } catch {
    invalid('browser.url');
  }
  if (url.protocol !== 'https:' || url.username || url.password) invalid('browser.url');
  if (!allowedOrigins.has(url.origin)) return { ok: false, error: 'DEVICE_BRIDGE_TARGET_NOT_ALLOWED' };
  return { ok: true, args: { url: url.href } };
}

function normalizeAppArgs(args, allowedApps) {
  const input = requireObject(args, 'args');
  if (Object.keys(input).some((key) => key !== 'appId')) invalid('app.args');
  const appId = typeof input.appId === 'string' ? input.appId.trim() : '';
  if (!APP_ID_PATTERN.test(appId)) invalid('app.appId');
  if (!allowedApps.has(appId)) return { ok: false, error: 'DEVICE_BRIDGE_TARGET_NOT_ALLOWED' };
  return { ok: true, args: { appId } };
}

function normalizeSystemInfoArgs(args, allowedInfo) {
  const input = args == null ? {} : requireObject(args, 'args');
  if (Object.keys(input).some((key) => key !== 'fields')) invalid('systemInfo.args');
  const requested = input.fields == null
    ? [...allowedInfo]
    : normalizeStringList(input.fields, 'systemInfo.fields', (item) => SYSTEM_INFO_FIELDS.has(item), SYSTEM_INFO_FIELDS.size);
  if (!requested.length) invalid('systemInfo.fields');
  if (requested.some((field) => !allowedInfo.has(field))) {
    return { ok: false, error: 'DEVICE_BRIDGE_TARGET_NOT_ALLOWED' };
  }
  return { ok: true, args: { fields: requested } };
}

export function createDeviceBridgePolicy({
  allowedWebOrigins = [],
  allowedApps = [],
  allowedSystemInfo
} = {}) {
  const origins = new Set(normalizeOrigins(allowedWebOrigins));
  const apps = new Set(normalizeApps(allowedApps));
  const info = new Set(normalizeInfoFields(allowedSystemInfo));

  function authorize(raw) {
    let input;
    try {
      input = requireObject(raw, 'request');
      for (const key of Object.keys(input)) if (!REQUEST_FIELDS.has(key)) invalid('request.field');
      const operation = typeof input.operation === 'string' ? input.operation.trim() : '';
      if (!OPERATIONS.has(operation)) invalid('operation');
      requireExplicitIntent(input);

      let normalized;
      if (operation === OP_BROWSER_OPEN) normalized = normalizeBrowserArgs(input.args, origins);
      else if (operation === OP_APP_OPEN) normalized = normalizeAppArgs(input.args, apps);
      else normalized = normalizeSystemInfoArgs(input.args, info);
      if (!normalized.ok) return normalized;
      return { ok: true, request: { operation, args: normalized.args } };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }

  return Object.freeze({ authorize });
}

export const DEVICE_BRIDGE_OPERATIONS = Object.freeze([...OPERATIONS]);
export const DEVICE_BRIDGE_SYSTEM_INFO_FIELDS = Object.freeze([...SYSTEM_INFO_FIELDS]);
