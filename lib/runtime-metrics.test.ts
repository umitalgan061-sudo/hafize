import { describe, expect, it } from 'vitest';
import { createRuntimeMetrics } from './runtime-metrics.ts';

describe('runtime metrics', () => {
  it('normalizes routes and aggregates request outcomes', () => {
    let time = 1_000;
    const metrics = createRuntimeMetrics({ now: () => time });

    const slow = metrics.startRequest('get', '/api/schedules/123');
    time += 300;
    slow.finish(200);

    const failed = metrics.startRequest('POST', '/api/schedules/abcdef1234567890');
    time += 600;
    failed.finish(503);

    const snapshot = metrics.snapshot();
    expect(snapshot.requests.total).toBe(2);
    expect(snapshot.requests.completed).toBe(2);
    expect(snapshot.requests.failures).toBe(1);
    expect(snapshot.requests.byMethod).toEqual({ GET: 1, POST: 1 });
    expect(snapshot.requests.byStatus).toEqual({ '200': 1, '503': 1 });
    expect(snapshot.routes.map((item) => item.route)).toContain('/api/schedules/:id');
  });

  it('records aborts and upstream failures without exposing payload data', () => {
    let time = 2_000;
    const metrics = createRuntimeMetrics({ now: () => time });

    const aborted = metrics.startRequest('GET', '/api/chat');
    time += 50;
    aborted.abort();

    const finishNvidia = metrics.startNvidia();
    time += 75;
    finishNvidia(true);

    const snapshot = metrics.snapshot();
    expect(snapshot.requests.aborted).toBe(1);
    expect(snapshot.requests.failures).toBe(0);
    expect(snapshot.upstream).toEqual({
      nvidiaTotal: 1,
      nvidiaFailures: 1,
      nvidiaActive: 0
    });
  });
});
