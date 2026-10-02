import { describe, expect, it } from 'vitest';
import { createShutdownCoordinator } from './graceful-shutdown.ts';

describe('graceful shutdown coordinator', () => {
  it('is idempotent, stops accepting work first and awaits the server close last', async () => {
    const order: string[] = [];
    let closeServerCalls = 0;
    let closeLeaseCalls = 0;
    let releaseServer: () => void = () => {};
    const serverClosed = new Promise<void>((resolve) => { releaseServer = resolve; });
    const coordinator = createShutdownCoordinator({
      stopWorker: () => order.push('worker'),
      waitForTick: async () => { order.push('tick'); },
      closeLease: async () => { closeLeaseCalls += 1; order.push('lease'); },
      closeServer: async () => { closeServerCalls += 1; order.push('server'); await serverClosed; }
    });

    const first = coordinator.shutdown();
    const second = coordinator.shutdown();
    expect(first).toBe(second);

    let settled = false;
    void first.then(() => { settled = true; });
    await new Promise((resolve) => setTimeout(resolve, 0));

    // The listener close is started before the drain steps so no new work is
    // accepted while the in-flight schedule tick and lease are released.
    expect(order).toEqual(['worker', 'server', 'tick', 'lease']);
    // The coordinator still waits for the server to finish closing.
    expect(settled).toBe(false);

    releaseServer();
    await Promise.all([first, second]);
    expect(settled).toBe(true);
    expect(closeLeaseCalls).toBe(1);
    expect(closeServerCalls).toBe(1);
    expect(coordinator.started()).toBe(true);
  });

  it('reports cleanup failures without aborting the server close path', async () => {
    const order: string[] = [];
    const logged: string[] = [];
    const originalExitCode = process.exitCode;
    const coordinator = createShutdownCoordinator({
      waitForTick: async () => { order.push('tick'); throw new Error('tick'); },
      closeLease: async () => { order.push('lease'); throw new Error('lease'); },
      closeServer: async () => { order.push('server'); },
      logger: (message) => { logged.push(message); }
    });

    await coordinator.shutdown();

    expect(order).toEqual(['server', 'tick', 'lease']);
    expect(logged).toEqual([
      'Hafize schedule tick shutdown failed',
      'Hafize schedule lease shutdown failed'
    ]);
    expect(process.exitCode).toBe(1);
    process.exitCode = originalExitCode;
  });
});
