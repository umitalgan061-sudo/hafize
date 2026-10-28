// Idempotency key mechanism for skill invocations: a retry with the same key returns the
// first result instead of running again.
import { createHash } from 'node:crypto';

const IDEM_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CACHE = 10000;

function canonical(value: unknown, depth = 0): string {
  if (depth > 12) throw new Error('IDEMPOTENCY_VALUE_TOO_DEEP');
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return '[' + value.map((item) => canonical(item, depth + 1)).join(',') + ']';
  const object = value as Record<string, unknown>;
  return '{' + Object.keys(object).sort().map((key) => JSON.stringify(key) + ':' + canonical(object[key], depth + 1)).join(',') + '}';
}

export function hashInvocation(skillId: unknown, args: unknown, agentId: unknown, sessionId: unknown): string {
  return createHash('sha256').update(canonical({ skillId, args, agentId, sessionId })).digest('hex');
}

export interface IdempotencyStore {
  get(key: string): unknown;
  set(key: string, result: unknown): void;
  has(key: string): boolean;
  clear(): void;
}

export function createIdempotencyStore({ ttlMs = IDEM_TTL_MS, maxEntries = MAX_CACHE, now = () => Date.now() } = {}): IdempotencyStore {
  const store = new Map<string, { result: unknown; createdAt: number }>();

  function cleanup(): void {
    const nowMs = now();
    for (const [key, entry] of store.entries()) {
      if (nowMs - entry.createdAt > ttlMs) store.delete(key);
    }
  }

  return Object.freeze({
    get(key: string) {
      cleanup();
      return store.get(key)?.result;
    },
    set(key: string, result: unknown) {
      cleanup();
      if (store.size >= maxEntries) {
        // Map keeps insertion order, so the first key is the oldest entry.
        const oldest = store.keys().next().value;
        if (oldest !== undefined) store.delete(oldest);
      }
      store.set(key, { result, createdAt: now() });
    },
    has(key: string) {
      cleanup();
      return store.has(key);
    },
    clear: () => store.clear()
  });
}

type IdempotentArgs = { skillId: string; args?: unknown; agentId?: string; sessionId?: string; idemKey?: string; [extra: string]: unknown };

export function withIdempotency<T>(
  handler: (args: IdempotentArgs) => Promise<T>,
  { store, generateKey = hashInvocation }: { store?: IdempotencyStore; generateKey?: (skillId: unknown, args: unknown, agentId: unknown, sessionId: unknown) => string } = {}
) {
  if (typeof handler !== 'function') throw new Error('INVALID_IDEMPOTENCY_HANDLER');
  return async function idempotentInvoke({ skillId, args = {}, agentId, sessionId, idemKey, ...rest }: IdempotentArgs): Promise<T> {
    const key = idemKey ? String(idemKey).trim() : generateKey(skillId, args, agentId, sessionId);
    if (!key) throw new Error('INVALID_IDEMPOTENCY_KEY');
    if (store?.has(key)) return store.get(key) as T;
    const result = await handler({ skillId, args, agentId, sessionId, idemKey: key, ...rest });
    store?.set(key, result);
    return result;
  };
}

export const IDEMPOTENCY_DEFAULTS = Object.freeze({
  ttlMs: IDEM_TTL_MS,
  maxEntries: MAX_CACHE
});
