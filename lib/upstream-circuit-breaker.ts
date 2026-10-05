export interface UpstreamCircuitBreakerOptions {
  readonly failureThreshold?: number;
  readonly openMs?: number;
  readonly now?: () => number;
}

export interface UpstreamCircuitBreakerSnapshot {
  readonly state: 'closed' | 'open' | 'half-open';
  readonly failures: number;
  readonly openedAt: number | null;
  readonly retryAfterMs: number;
}

export class UpstreamCircuitOpenError extends Error {
  readonly code = 'UPSTREAM_CIRCUIT_OPEN';
  readonly status = 503;
  readonly retryAfterMs: number;

  constructor(retryAfterMs: number) {
    super('UPSTREAM_CIRCUIT_OPEN');
    this.name = 'UpstreamCircuitOpenError';
    this.retryAfterMs = Math.max(0, Math.ceil(retryAfterMs));
  }
}

export function createUpstreamCircuitBreaker({
  failureThreshold = 5,
  openMs = 15_000,
  now = () => Date.now()
}: UpstreamCircuitBreakerOptions = {}): Readonly<{
  beforeRequest: () => void;
  recordSuccess: () => void;
  recordFailure: () => void;
  snapshot: () => UpstreamCircuitBreakerSnapshot;
}> {
  if (!Number.isInteger(failureThreshold) || failureThreshold < 1 || failureThreshold > 100) {
    throw new Error('INVALID_UPSTREAM_CIRCUIT_FAILURE_THRESHOLD');
  }
  if (!Number.isInteger(openMs) || openMs < 100 || openMs > 600_000) {
    throw new Error('INVALID_UPSTREAM_CIRCUIT_OPEN_MS');
  }
  if (typeof now !== 'function') throw new Error('INVALID_UPSTREAM_CIRCUIT_CLOCK');

  let state: UpstreamCircuitBreakerSnapshot['state'] = 'closed';
  let failures = 0;
  let openedAt: number | null = null;
  let halfOpenProbeInFlight = false;

  const currentTime = (): number => {
    const value = Number(now());
    if (!Number.isFinite(value)) throw new Error('INVALID_UPSTREAM_CIRCUIT_CLOCK');
    return value;
  };

  function open(at: number): void {
    state = 'open';
    openedAt = at;
  }

  function beforeRequest(): void {
    const time = currentTime();
    if (state === 'open') {
      const retryAfterMs = Math.max(0, openMs - (time - (openedAt ?? time)));
      if (retryAfterMs > 0) throw new UpstreamCircuitOpenError(retryAfterMs);
      state = 'half-open';
    }
    if (state === 'half-open') {
      if (halfOpenProbeInFlight) throw new UpstreamCircuitOpenError(openMs);
      halfOpenProbeInFlight = true;
    }
  }

  function recordSuccess(): void {
    failures = 0;
    state = 'closed';
    openedAt = null;
    halfOpenProbeInFlight = false;
  }

  function recordFailure(): void {
    const time = currentTime();
    if (state === 'half-open' || failures + 1 >= failureThreshold) {
      failures = failureThreshold;
      halfOpenProbeInFlight = false;
      open(time);
      return;
    }
    failures += 1;
  }

  function snapshot(): UpstreamCircuitBreakerSnapshot {
    const time = currentTime();
    const retryAfterMs = state === 'open'
      ? Math.max(0, openMs - (time - (openedAt ?? time)))
      : 0;
    return Object.freeze({ state, failures, openedAt, retryAfterMs });
  }

  return Object.freeze({ beforeRequest, recordSuccess, recordFailure, snapshot });
}
