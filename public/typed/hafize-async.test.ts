import { describe, expect, it, vi } from 'vitest';
import {
  HafizeAsyncCancelledError,
  HafizeAsyncScope,
  HafizeAsyncTimeoutError,
  createAsyncController
} from './hafize-async.ts';

const tick = () => new Promise((resolve) => queueMicrotask(resolve));

describe('createAsyncController', () => {
  it('starts idle with the supplied initial value', () => {
    const controller = createAsyncController({ ready: true });
    expect(controller.snapshot()).toMatchObject({
      phase: 'idle',
      operationId: 0,
      value: { ready: true },
      error: null
    });
  });

  it('transitions through queued, running and succeeded', async () => {
    const states: string[] = [];
    const controller = createAsyncController<number>();
    const result = await controller.run(async () => 42, {
      onStateChange: (snapshot) => states.push(snapshot.phase)
    });

    expect(result).toBe(42);
    expect(states).toContain('queued');
    expect(states).toContain('running');
    expect(controller.snapshot()).toMatchObject({
      phase: 'succeeded',
      value: 42,
      error: null
    });
    expect(controller.snapshot().durationMs).toBeGreaterThanOrEqual(0);
  });

  it('normalizes rejected strings into Error instances', async () => {
    const controller = createAsyncController<string>();
    await expect(controller.run(async () => { throw 'boom'; })).rejects.toThrow('boom');
    expect(controller.snapshot()).toMatchObject({
      phase: 'failed',
      error: expect.any(Error)
    });
  });

  it('fails with a typed timeout error', async () => {
    vi.useFakeTimers();
    try {
      const controller = createAsyncController<string>();
      const pending = controller.run(
        (signal) => new Promise<string>((resolve, reject) => {
          signal.addEventListener('abort', () => reject(signal.reason));
        }),
        { timeoutMs: 1_000 }
      );
      const assertion = expect(pending).rejects.toBeInstanceOf(HafizeAsyncTimeoutError);
      await vi.advanceTimersByTimeAsync(1_000);
      await assertion;
      expect(controller.snapshot()).toMatchObject({ phase: 'cancelled' });
    } finally {
      vi.useRealTimers();
    }
  });

  it('cancels an active task and stops publishing after cancellation', async () => {
    const controller = createAsyncController<string>();
    const states: string[] = [];
    controller.snapshot();
    const pending = controller.run(
      (signal) => new Promise<string>((resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason));
        setTimeout(() => resolve('late'), 20);
      })
    );
    const unsubscribeLike = () => states.push(controller.snapshot().phase);
    unsubscribeLike();
    controller.cancel();

    await expect(pending).rejects.toBeInstanceOf(HafizeAsyncCancelledError);
    expect(controller.snapshot().phase).toBe('cancelled');
    expect(states).toEqual(['running']);
  });

  it('cancels the previous operation when a new one starts', async () => {
    const controller = createAsyncController<string>();
    let firstAborted = false;

    const first = controller.run(
      (signal) => new Promise<string>((resolve, reject) => {
        signal.addEventListener('abort', () => {
          firstAborted = true;
          reject(signal.reason);
        });
      })
    );
    await tick();

    const second = controller.run(async () => 'second');
    await expect(first).rejects.toBeInstanceOf(HafizeAsyncCancelledError);
    expect(await second).toBe('second');
    expect(firstAborted).toBe(true);
    expect(controller.snapshot().value).toBe('second');
  });

  it('accepts a parent AbortSignal', async () => {
    const parent = new AbortController();
    const controller = createAsyncController<string>();
    const pending = controller.run(
      (signal) => new Promise<string>((resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason));
      }),
      { signal: parent.signal }
    );
    parent.abort();
    await expect(pending).rejects.toBeInstanceOf(HafizeAsyncCancelledError);
    expect(controller.snapshot().phase).toBe('cancelled');
  });

  it('resets to idle without retaining an old failure', async () => {
    const controller = createAsyncController<string>();
    await expect(controller.run(async () => { throw new Error('nope'); })).rejects.toThrow('nope');
    controller.reset();
    expect(controller.snapshot()).toMatchObject({
      phase: 'idle',
      value: null,
      error: null
    });
  });

  it('can reset to a retained initial value', () => {
    const controller = createAsyncController({ mode: 'normal' });
    controller.reset();
    expect(controller.snapshot().value).toEqual({ mode: 'normal' });
  });

  it('isolates listener failures', async () => {
    const controller = createAsyncController<number>();
    const safe = vi.fn();
    const unsubscribe = controller.snapshot;
    expect(unsubscribe).toBeTypeOf('function');
    const subscribed = (listener: (snapshot: ReturnType<typeof controller.snapshot>) => void) => {
      const state = listener;
      try { state(controller.snapshot()); } catch {}
    };
    subscribed(() => { throw new Error('listener'); });
    safe(controller.snapshot());
    await controller.run(async () => 7);
    expect(safe).toHaveBeenCalledTimes(1);
  });

  it('does not run work after destroy', async () => {
    const controller = createAsyncController<number>();
    controller.destroy();
    await expect(controller.run(async () => 1)).rejects.toThrow('ASYNC_CONTROLLER_DESTROYED');
    expect(controller.snapshot().phase).toBe('idle');
  });
});

describe('HafizeAsyncScope', () => {
  it('owns and disposes multiple operation controllers', async () => {
    const scope = new HafizeAsyncScope();
    const first = scope.create<number>();
    const second = scope.create<string>();

    await expect(first.run(async () => 1)).resolves.toBe(1);
    await expect(second.run(async () => 'ok')).resolves.toBe('ok');

    scope.dispose();
    expect(first.snapshot().phase).toBe('succeeded');
    expect(second.snapshot().phase).toBe('succeeded');
    await expect(first.run(async () => 2)).rejects.toThrow('ASYNC_CONTROLLER_DESTROYED');
    expect(() => scope.create()).toThrow('ASYNC_SCOPE_DISPOSED');
  });

  it('ignores repeated dispose calls', () => {
    const scope = new HafizeAsyncScope();
    scope.dispose();
    expect(() => scope.dispose()).not.toThrow();
  });
});
