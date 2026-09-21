import { describe, expect, it } from 'vitest';
import { createShutdownCoordinator } from './graceful-shutdown.ts';

describe('graceful shutdown coordinator', () => {
  it('is idempotent and preserves shutdown ordering', async () => {
    const order: string[] = [];
    let closeServerCalls = 0;
    let closeLeaseCalls = 0;
    const coordinator = createShutdownCoordinator({
      stopWorker: () => order.push('worker'),
      waitForTick: async () => { order.push('tick'); },
      closeLease: async () => { closeLeaseCalls += 1; order.push('lease'); },
      closeServer: async () => { closeServerCalls += 1; order.push('server'); }
    });
    const first = coordinator.shutdown();
    const second = coordinator.shutdown();
    expect(first).toBe(second);
    await Promise.all([first, second]);
    expect(order).toEqual(['worker', 'tick', 'lease', 'server']);
    expect(closeLeaseCalls).toBe(1);
    expect(closeServerCalls).toBe(1);
    expect(coordinator.started()).toBe(true);
  });

  it('reports cleanup failures without aborting the server close path', async () => {
    const order: string[] = [];
    const originalExitCode = process.exitCode;
    const coordinator = createShutdownCoordinator({
      waitForTick: async () => { throw new Error('tick'); },
      closeLease: async () => { order.push('lease'); throw new Error('lease'); },
      closeServer: async () => { order.push('server'); }
    });
    await coordinator.shutdown();
    expect(order).toEqual(['lease', 'server']);
    process.exitCode = originalExitCode;
  });
});
