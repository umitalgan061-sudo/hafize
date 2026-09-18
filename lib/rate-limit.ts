import type { RateLimitDecision } from './runtime-contracts.ts';
interface RateLimitOptions {
  readonly windowMs?: number;
  readonly max?: number;
  readonly maxConcurrent?: number;
  readonly maxEntries?: number;
}
interface RateLimitEntry { count: number; concurrent: number; resetAt: number; }

export function createRateLimiter({
  windowMs = 60_000,
  max = 60,
  maxConcurrent = 0,
  maxEntries = 10_000
}: RateLimitOptions = {}): Readonly<{
  check: (key: unknown, now?: number) => RateLimitDecision;
  size: () => number;
}> {
  if (!Number.isInteger(windowMs) || windowMs < 1_000) throw new Error('INVALID_RATE_LIMIT_WINDOW');
  if (!Number.isInteger(max) || max < 1) throw new Error('INVALID_RATE_LIMIT_MAX');
  if (!Number.isInteger(maxConcurrent) || maxConcurrent < 0) throw new Error('INVALID_RATE_LIMIT_CONCURRENT');
  const entries = new Map<string, RateLimitEntry>();
  function prune(now: number): void {
    if (entries.size <= maxEntries) return;
    for (const [key, entry] of entries) if (entry.resetAt <= now && entry.concurrent === 0) entries.delete(key);
    while (entries.size > maxEntries) {
      const first = entries.keys().next();
      if (first.done) break;
      entries.delete(first.value);
    }
  }
  function check(key: unknown, now = Date.now()): RateLimitDecision {
    const normalizedKey = typeof key === 'string' && key ? key.slice(0, 200) : 'anonymous';
    let entry = entries.get(normalizedKey);
    if (!entry) {
      entry = { count: 0, concurrent: 0, resetAt: now + windowMs };
      entries.set(normalizedKey, entry);
    } else if (entry.resetAt <= now) {
      entry.count = 0;
      entry.resetAt = now + windowMs;
    }
    if (entry.count >= max) return Object.freeze({ ok: false, retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)) });
    if (maxConcurrent > 0 && entry.concurrent >= maxConcurrent) {
      entry.count += 1;
      return Object.freeze({ ok: false, retryAfterSeconds: 1, concurrent: true });
    }
    entry.count += 1;
    entry.concurrent += 1;
    prune(now);
    let released = false;
    return Object.freeze({
      ok: true,
      release(): void {
        if (released) return;
        released = true;
        entry!.concurrent = Math.max(0, entry!.concurrent - 1);
        if (entry!.count === 0 && entry!.concurrent === 0 && entry!.resetAt <= Date.now()) entries.delete(normalizedKey);
      }
    });
  }
  return Object.freeze({ check, size: () => entries.size });
}