export interface RetryOptions {
  attempts?: number;
  minDelayMs?: number;
  maxDelayMs?: number;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  sleep?: (delayMs: number, signal?: AbortSignal) => Promise<void>;
  signal?: AbortSignal;
}

export interface TimeoutOptions {
  timeoutMs: number;
  signal?: AbortSignal;
  reason?: string;
}

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  cooldownMs?: number;
  halfOpenMaxCalls?: number;
  now?: () => number;
}

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitSnapshot {
  state: CircuitState;
  failures: number;
  successes: number;
  openedAt: number | null;
  nextAttemptAt: number | null;
  rejectedCalls: number;
}

export interface ConcurrencyGateOptions {
  limit?: number;
  queueLimit?: number;
}

export interface ConcurrencySnapshot {
  limit: number;
  active: number;
  queued: number;
  accepted: number;
  rejected: number;
  completed: number;
}

export interface RuntimeMetricSnapshot {
  name: string;
  count: number;
  failures: number;
  totalDurationMs: number;
  lastDurationMs: number | null;
  lastError: string | null;
}

const DEFAULT_ATTEMPTS = 2;
const DEFAULT_MIN_DELAY_MS = 150;
const DEFAULT_MAX_DELAY_MS = 2_000;
const DEFAULT_FAILURE_THRESHOLD = 3;
const DEFAULT_COOLDOWN_MS = 10_000;
const DEFAULT_HALF_OPEN_CALLS = 1;
const DEFAULT_GATE_LIMIT = 4;
const DEFAULT_QUEUE_LIMIT = 16;
const MAX_METRIC_NAMES = 64;

function positiveInteger(value: unknown, fallback: number, max: number): number {
  return Number.isInteger(value) && (value as number) > 0 ? Math.min(value as number, max) : fallback;
}

function boundedDelay(value: unknown, fallback: number): number {
  return Number.isFinite(value) && (value as number) >= 0 ? Math.min(Math.floor(value as number), 60_000) : fallback;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 180);
  return String(error ?? 'UNKNOWN_ERROR').slice(0, 180);
}

export function abortError(reason = 'ABORTED'): Error {
  const error = new Error(reason);
  error.name = 'AbortError';
  return error;
}

export function sleep(delayMs: number, signal?: AbortSignal): Promise<void> {
  const delay = boundedDelay(delayMs, 0);
  if (signal?.aborted) return Promise.reject(abortError());
  return new Promise((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onAbort = () => {
      if (timer !== undefined) clearTimeout(timer);
      reject(abortError());
    };
    timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, delay);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export async function withDeadline<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  { timeoutMs, signal, reason = 'RUNTIME_TIMEOUT' }: TimeoutOptions
): Promise<T> {
  const boundedTimeout = Math.max(1, Math.min(Math.floor(timeoutMs), 10 * 60_000));
  if (signal?.aborted) throw abortError();
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let settled = false;

  const onParentAbort = () => controller.abort();
  signal?.addEventListener('abort', onParentAbort, { once: true });

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(abortError(reason));
    }, boundedTimeout);
  });

  try {
    const result = await Promise.race([operation(controller.signal), timeout]);
    settled = true;
    return result;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    signal?.removeEventListener('abort', onParentAbort);
    if (!settled && !controller.signal.aborted) controller.abort();
  }
}

export async function retryWithBackoff<T>(
  operation: (attempt: number, signal?: AbortSignal) => Promise<T>,
  {
    attempts = DEFAULT_ATTEMPTS,
    minDelayMs = DEFAULT_MIN_DELAY_MS,
    maxDelayMs = DEFAULT_MAX_DELAY_MS,
    shouldRetry = () => true,
    sleep: sleepImpl = sleep,
    signal
  }: RetryOptions = {}
): Promise<T> {
  const maxAttempts = positiveInteger(attempts, DEFAULT_ATTEMPTS, 5);
  const minDelay = boundedDelay(minDelayMs, DEFAULT_MIN_DELAY_MS);
  const maxDelay = Math.max(minDelay, boundedDelay(maxDelayMs, DEFAULT_MAX_DELAY_MS));
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (signal?.aborted) throw abortError();
    try {
      return await operation(attempt, signal);
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts || !shouldRetry(error, attempt)) throw error;
      const delay = Math.min(maxDelay, minDelay * (2 ** (attempt - 1)));
      await sleepImpl(delay, signal);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(errorMessage(lastError));
}

export function createCircuitBreaker<T extends (...args: any[]) => Promise<any>>(
  operation: T,
  {
    failureThreshold = DEFAULT_FAILURE_THRESHOLD,
    cooldownMs = DEFAULT_COOLDOWN_MS,
    halfOpenMaxCalls = DEFAULT_HALF_OPEN_CALLS,
    now = Date.now
  }: CircuitBreakerOptions = {}
): {
  call: (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>>>;
  snapshot: () => CircuitSnapshot;
  reset: () => void;
} {
  const threshold = positiveInteger(failureThreshold, DEFAULT_FAILURE_THRESHOLD, 20);
  const cooldown = boundedDelay(cooldownMs, DEFAULT_COOLDOWN_MS);
  const halfOpenCalls = positiveInteger(halfOpenMaxCalls, DEFAULT_HALF_OPEN_CALLS, 4);
  let state: CircuitState = 'closed';
  let failures = 0;
  let successes = 0;
  let openedAt: number | null = null;
  let rejectedCalls = 0;
  let halfOpenActive = 0;

  function transitionOpen() {
    state = 'open';
    openedAt = now();
  }

  function transitionClosed() {
    state = 'closed';
    failures = 0;
    openedAt = null;
    halfOpenActive = 0;
  }

  function maybeHalfOpen() {
    if (state !== 'open' || openedAt === null) return;
    if (now() - openedAt >= cooldown) {
      state = 'half-open';
      halfOpenActive = 0;
    }
  }

  async function call(...args: Parameters<T>): Promise<Awaited<ReturnType<T>>> {
    maybeHalfOpen();
    if (state === 'open') {
      rejectedCalls += 1;
      throw abortError('CIRCUIT_OPEN');
    }
    if (state === 'half-open') {
      if (halfOpenActive >= halfOpenCalls) {
        rejectedCalls += 1;
        throw abortError('CIRCUIT_HALF_OPEN_BUSY');
      }
      halfOpenActive += 1;
    }

    try {
      const result = await operation(...args);
      successes += 1;
      if (state === 'half-open') transitionClosed();
      else failures = 0;
      return result as Awaited<ReturnType<T>>;
    } catch (error) {
      failures += 1;
      if (state === 'half-open' || failures >= threshold) transitionOpen();
      throw error;
    } finally {
      if (state === 'half-open') halfOpenActive = Math.max(0, halfOpenActive - 1);
    }
  }

  return Object.freeze({
    call,
    snapshot: () => Object.freeze({ state, failures, successes, openedAt, nextAttemptAt: openedAt === null ? null : openedAt + cooldown, rejectedCalls }),
    reset: transitionClosed
  });
}

export function createConcurrencyGate({ limit = DEFAULT_GATE_LIMIT, queueLimit = DEFAULT_QUEUE_LIMIT }: ConcurrencyGateOptions = {}) {
  const maxActive = positiveInteger(limit, DEFAULT_GATE_LIMIT, 32);
  const maxQueue = positiveInteger(queueLimit, DEFAULT_QUEUE_LIMIT, 256);
  let active = 0;
  let queued = 0;
  let accepted = 0;
  let rejected = 0;
  let completed = 0;
  const queue: Array<() => void> = [];

  function pump() {
    while (active < maxActive && queue.length) {
      const next = queue.shift();
      queued = Math.max(0, queue.length);
      next?.();
    }
  }

  function acquire(signal?: AbortSignal): Promise<() => void> {
    if (signal?.aborted) return Promise.reject(abortError());
    if (active < maxActive) {
      active += 1;
      accepted += 1;
      return Promise.resolve(() => {
        active = Math.max(0, active - 1);
        completed += 1;
        pump();
      });
    }
    if (queue.length >= maxQueue) {
      rejected += 1;
      return Promise.reject(abortError('CONCURRENCY_QUEUE_FULL'));
    }
    accepted += 1;
    return new Promise((resolve, reject) => {
      let removed = false;
      const onAbort = () => {
        if (removed) return;
        removed = true;
        const index = queue.indexOf(start);
        if (index >= 0) queue.splice(index, 1);
        queued = queue.length;
        rejected += 1;
        reject(abortError());
      };
      const start = () => {
        if (removed) return;
        removed = true;
        signal?.removeEventListener('abort', onAbort);
        active += 1;
        queued = queue.length;
        resolve(() => {
          active = Math.max(0, active - 1);
          completed += 1;
          pump();
        });
      };
      queue.push(start);
      queued = queue.length;
      signal?.addEventListener('abort', onAbort, { once: true });
    });
  }

  return Object.freeze({
    acquire,
    snapshot: (): ConcurrencySnapshot => Object.freeze({ limit: maxActive, active, queued: queue.length, accepted, rejected, completed }),
    drain: () => { while (queue.length) queue.shift()?.(); queued = 0; }
  });
}

export function createRuntimeMetrics(maxNames = MAX_METRIC_NAMES) {
  const limit = positiveInteger(maxNames, MAX_METRIC_NAMES, 256);
  const metrics = new Map<string, RuntimeMetricSnapshot>();

  function record(name: unknown, durationMs: number, error?: unknown) {
    const key = String(name ?? '').trim().slice(0, 100);
    if (!key) return;
    if (!metrics.has(key) && metrics.size >= limit) return;
    const previous = metrics.get(key) ?? {
      name: key,
      count: 0,
      failures: 0,
      totalDurationMs: 0,
      lastDurationMs: null,
      lastError: null
    };
    metrics.set(key, Object.freeze({
      ...previous,
      count: previous.count + 1,
      failures: previous.failures + (error === undefined ? 0 : 1),
      totalDurationMs: previous.totalDurationMs + Math.max(0, Math.round(durationMs)),
      lastDurationMs: Math.max(0, Math.round(durationMs)),
      lastError: error === undefined ? previous.lastError : errorMessage(error)
    }));
  }

  return Object.freeze({
    record,
    snapshot: () => Object.freeze([...metrics.values()].map((metric) => Object.freeze({ ...metric }))),
    clear: () => metrics.clear()
  });
}

export const RUNTIME_RESILIENCE_LIMITS = Object.freeze({
  defaultAttempts: DEFAULT_ATTEMPTS,
  defaultFailureThreshold: DEFAULT_FAILURE_THRESHOLD,
  defaultGateLimit: DEFAULT_GATE_LIMIT,
  maxMetricNames: MAX_METRIC_NAMES
});
