import { describe, expect, it } from 'vitest';
import { createUpstreamCircuitBreaker, UpstreamCircuitOpenError } from './upstream-circuit-breaker.ts';

describe('upstream circuit breaker', () => {
  it('opens only after the configured failure threshold', () => {
    let now = 1_000;
    const breaker = createUpstreamCircuitBreaker({ failureThreshold: 2, openMs: 1000, now: () => now });
    breaker.beforeRequest();
    breaker.recordFailure();
    expect(breaker.snapshot().state).toBe('closed');
    breaker.recordFailure();
    expect(breaker.snapshot().state).toBe('open');
    expect(() => breaker.beforeRequest()).toThrow(UpstreamCircuitOpenError);
    now += 1000;
    expect(() => breaker.beforeRequest()).not.toThrow();
    expect(breaker.snapshot().state).toBe('half-open');
  });

  it('closes after a successful half-open probe', () => {
    let now = 1_000;
    const breaker = createUpstreamCircuitBreaker({ failureThreshold: 1, openMs: 1000, now: () => now });
    breaker.recordFailure();
    now += 1000;
    breaker.beforeRequest();
    breaker.recordSuccess();
    expect(breaker.snapshot()).toMatchObject({ state: 'closed', failures: 0, retryAfterMs: 0 });
  });

  it('re-opens when the half-open probe fails', () => {
    let now = 1_000;
    const breaker = createUpstreamCircuitBreaker({ failureThreshold: 1, openMs: 1000, now: () => now });
    breaker.recordFailure();
    now += 1000;
    breaker.beforeRequest();
    breaker.recordFailure();
    expect(breaker.snapshot().state).toBe('open');
  });

  it('rejects invalid configuration', () => {
    expect(() => createUpstreamCircuitBreaker({ failureThreshold: 0 })).toThrow('INVALID_UPSTREAM_CIRCUIT_FAILURE_THRESHOLD');
    expect(() => createUpstreamCircuitBreaker({ openMs: 99 })).toThrow('INVALID_UPSTREAM_CIRCUIT_OPEN_MS');
  });
});
