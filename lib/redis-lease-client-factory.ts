const MAX_REDIS_URL_LENGTH = 4096;

function invalidConfig() {
  return new Error('INVALID_REDIS_LEASE_CLIENT_CONFIG');
}

function cleanUrl(value) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw || raw.length > MAX_REDIS_URL_LENGTH || /[\u0000\r\n]/.test(raw)) throw invalidConfig();
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw invalidConfig();
  }
  if (parsed.protocol !== 'redis:' && parsed.protocol !== 'rediss:') throw invalidConfig();
  if (!parsed.hostname || parsed.hash) throw invalidConfig();
  return raw;
}

export function readRedisLeaseClientConfig(env = process.env) {
  if (!env || Array.isArray(env) || typeof env !== 'object') throw invalidConfig();
  const raw = typeof env.HAFIZE_SCHEDULE_REDIS_URL === 'string'
    ? env.HAFIZE_SCHEDULE_REDIS_URL.trim()
    : '';
  if (!raw) return null;
  const url = cleanUrl(raw);
  const config = {};
  Object.defineProperty(config, 'url', {
    enumerable: false,
    configurable: false,
    writable: false,
    value: url
  });
  return Object.freeze(config);
}

async function closeQuietly(client) {
  try {
    if (typeof client?.quit === 'function' && client.isOpen) await client.quit();
    else if (typeof client?.disconnect === 'function' && client.isOpen) client.disconnect();
  } catch {
    // Startup cleanup must not replace the sanitized root error.
  }
}

export async function createRedisLeaseClient({ env = process.env, createClient } = {}) {
  const config = readRedisLeaseClientConfig(env);
  if (config == null) return Object.freeze({ configured: false, client: null });
  if (typeof createClient !== 'function') throw new Error('REDIS_LEASE_CLIENT_UNAVAILABLE');

  let client;
  try {
    client = createClient({ url: config.url });
    if (!client || typeof client.connect !== 'function' || typeof client.eval !== 'function') {
      throw new Error('invalid client');
    }
    await client.connect();
    if (client.isReady !== true) throw new Error('not ready');
  } catch {
    await closeQuietly(client);
    throw new Error('REDIS_LEASE_CLIENT_STARTUP_FAILED');
  }

  return Object.freeze({ configured: true, client });
}
