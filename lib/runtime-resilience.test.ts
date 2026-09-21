import { describe, expect, it, vi } from 'vitest';
import {
  createCircuitBreaker,
  createConcurrencyGate,
  createRuntimeMetrics,
  retryWithBackoff,
  sleep,
  withDeadline
} from './runtime-resilience.ts';

describe('runtime resilience', () => {
  it('waits for a bounded sleep and honours abort', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(sleep(1, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('retries only when the policy allows it', async () => {
    const calls: number[] = [];
    const sleeps: number[] = [];
    let remaining = 2;

    const result = await retryWithBackoff(
      async (attempt) => {
        calls.push(attempt);
        if (remaining > 0) {
          remaining -= 1;
          throw new Error('temporary');
        }
        return 'ok';
      },
      {
        attempts: 3,
        minDelayMs: 10,
        sleep: async (delay) => { sleeps.push(delay); },
        shouldRetry: () => true
      }
    );

    expect(result).toBe('ok');
    expect(calls).toEqual([1, 2, 3]);
    expect(sleeps).toEqual([10, 20]);
  });

  it('stops retrying when the predicate rejects the error', async () => {
    const operation = vi.fn(async () => {
      throw new Error('permanent');
    });

    await expect(retryWithBackoff(operation, {
      attempts: 5,
      sleep: async () => undefined,
      shouldRetry: () => false
    })).rejects.toThrow('permanent');

    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('aborts deadline work and reports a stable timeout code', async () => {
    await expect(withDeadline(
      async (signal) => new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new Error('aborted-by-deadline')), { once: true });
      }),
      { timeoutMs: 5, reason: 'NVIDIA_TIMEOUT' }
    )).rejects.toMatchObject({ name: 'AbortError', message: 'NVIDIA_TIMEOUT' });
  });

  it('opens after the configured number of failures and recovers', async () => {
    let now = 1_000;
    let shouldFail = true;
    let calls = 0;

    const breaker = createCircuitBreaker(async () => {
      calls += 1;
      if (shouldFail) throw new Error('upstream');
      return 'ok';
    }, {
      failureThreshold: 2,
      cooldownMs: 100,
      now: () => now
    });

    await expect(breaker.call()).rejects.toThrow('upstream');
    await expect(breaker.call()).rejects.toThrow('upstream');
    expect(breaker.snapshot().state).toBe('open');
    await expect(breaker.call()).rejects.toMatchObject({ message: 'CIRCUIT_OPEN' });

    now += 100;
    shouldFail = false;
    await expect(breaker.call()).resolves.toBe('ok');
    expect(breaker.snapshot().state).toBe('closed');
    expect(calls).toBe(3);
  });

  it('limits active work and preserves queue accounting', async () => {
    const gate = createConcurrencyGate({ limit: 1, queueLimit: 2 });
    const firstRelease = await gate.acquire();
    const second = gate.acquire();
    const third = gate.acquire();
    const fourth = gate.acquire();

    await expect(fourth).rejects.toMatchObject({ message: 'CONCURRENCY_QUEUE_FULL' });
    expect(gate.snapshot()).toMatchObject({ active: 1, queued: 2, accepted: 3, rejected: 1 });

    firstRelease();
    const secondRelease = await second;
    expect(gate.snapshot()).toMatchObject({ active: 1, queued: 1 });
    secondRelease();
    await third.then((release) => release());
    expect(gate.snapshot()).toMatchObject({ active: 0, queued: 0, completed: 3 });
  });

  it('records bounded operational metrics without leaking raw payloads', () => {
    const metrics = createRuntimeMetrics(2);
    metrics.record('nvidia.chat', 12.4);
    metrics.record('nvidia.chat', 5.7, new Error('upstream detail'));
    metrics.record('third.metric', 4);
    metrics.record('ignored.metric', 8);

    expect(metrics.snapshot()).toEqual([
      {
        name: 'nvidia.chat',
        count: 2,
        failures: 1,
        totalDurationMs: 18,
        lastDurationMs: 6,
        lastError: 'upstream detail'
      },
      {
        name: 'third.metric',
        count: 1,
        failures: 0,
        totalDurationMs: 4,
        lastDurationMs: 4,
        lastError: null
      }
    ]);
  });
});
