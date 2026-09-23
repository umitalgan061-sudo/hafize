import { describe, expect, it } from 'vitest';
import { createShutdownCoordinator } from './graceful-shutdown.ts';

describe('graceful shutdown coordinator', () => {
  it('stops accepting connections first, drains work, then awaits the server close', async () => {
    const order: string[] = [];
    let closeServerCalls = 0;
    let closeLeaseCalls = 0;
    let releaseServer = (): void => {};
    const serverDrained = new Promise<void>((resolve) => { releaseServer = resolve; });

    const coordinator = createShutdownCoordinator({
      stopWorker: () => order.push('worker'),
      waitForTick: async () => { order.push('tick'); },
      closeLease: async () => { closeLeaseCalls += 1; order.push('lease'); releaseServer(); },
      closeServer: async () => {
        closeServerCalls += 1;
        order.push('server:begin');
        await serverDrained;
        order.push('server:closed');
      }
    });

    const first = coordinator.shutdown();
    const second = coordinator.shutdown();
    expect(first).toBe(second);
    await Promise.all([first, second]);

    expect(order).toEqual(['worker', 'server:begin', 'tick', 'lease', 'server:closed']);
    expect(closeLeaseCalls).toBe(1);
    expect(closeServerCalls).toBe(1);
    expect(coordinator.started()).toBe(true);
  });

  it('reports cleanup failures without aborting the server close path', async () => {
    const order: string[] = [];
    const logged: string[] = [];
    const originalExitCode = process.exitCode;
    const coordinator = createShutdownCoordinator({
      waitForTick: async () => { throw new Error('tick'); },
      closeLease: async () => { order.push('lease'); throw new Error('lease'); },
      closeServer: async () => { order.push('server'); },
      logger: (message) => { logged.push(message); }
    });

    await coordinator.shutdown();

    expect(order).toEqual(['server', 'lease']);
    expect(logged).toEqual([
      'Hafize schedule tick shutdown failed',
      'Hafize schedule lease shutdown failed'
    ]);
    expect(process.exitCode).toBe(1);
    process.exitCode = originalExitCode;
  });
});
