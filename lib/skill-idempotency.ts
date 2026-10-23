// TypeScript migration wave 2026-10.
// Idempotency key mechanism for skill invocations.
// Prevents duplicate execution on retries.
import { randomUUID, createHash } from 'node:crypto';

const IDEM_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CACHE = 10000;

function canonical(value, depth = 0) {
  if (depth > 12) throw new Error('IDE_CONFIG_TOO_DEEP');
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(v => canonical(v, depth + 1)).join(',') + ']';
  const keys = Object.keys(value).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + canonical(value[k], depth + 1)).join(',') + '}';
}

export function hashInvocation(skillId, args, agentId, sessionId) {
  const payload = { skillId, args, agentId, sessionId };
  return createHash('sha256').update(canonical(payload)).digest('hex');
}

export function createIdempotencyStore({ ttlMs = IDEM_TTL_MS, maxEntries = MAX_CACHE, now = () => Date.now() } = {}) {
  const store = new Map<string, { result: unknown; createdAt: number }>();

  function cleanup() {
    const nowMs = now();
    for (const [key, entry] of store.entries()) {
      if (nowMs - entry.createdAt > ttlMs) store.delete(key);
    }
  }

  function get(key) {
    cleanup();
    return store.get(key)?.result;
  }

  function set(key, result) {
    cleanup();
    if (store.size >= maxEntries) {
      const oldest = [...store.entries()].sort((a, b) => a[1].createdAt - b[1].createdAt)[0];
      if (oldest) store.delete(oldest[0]);
    }
    store.set(key, { result, createdAt: now() });
  }

  function has(key) {
    cleanup();
    return store.has(key);
  }

  return Object.freeze({ get, set, has, clear: () => store.clear() });
}

export function withIdempotency(handler, { store, generateKey = (skillId, args, agentId, sessionId) => hashInvocation(skillId, args, agentId, sessionId) } = {}) {
  if (typeof handler !== 'function') throw new Error('INVALID_IDEMPOTENCY_HANDLER');
  return async function idempotentInvoke({ skillId, args = {}, agentId, sessionId, idemKey, ...rest }) {
    const key = idemKey ? String(idemKey).trim() : generateKey(skillId, args, agentId, sessionId);
    if (!key) throw new Error('INVALID_IDEMPOTENCY_KEY');
    if (store?.has(key)) return store.get(key);
    const result = await handler({ skillId, args, agentId, sessionId, idemKey: key, ...rest });
    store?.set(key, result);
    return result;
  };
}

export const IDEMPOTENCY_DEFAULTS = Object.freeze({
  ttlMs: IDEM_TTL_MS,
  maxEntries: MAX_CACHE
});
