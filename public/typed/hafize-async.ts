export type AsyncPhase =
  | 'idle'
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'cancelled';

export interface AsyncSnapshot<T = unknown> {
  readonly phase: AsyncPhase;
  readonly operationId: number;
  readonly startedAt: number | null;
  readonly finishedAt: number | null;
  readonly durationMs: number | null;
  readonly value: T | null;
  readonly error: Error | null;
}

export interface AsyncRunOptions {
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal;
  readonly onStateChange?: (snapshot: AsyncSnapshot) => void;
}

export interface AsyncController<T> {
  readonly snapshot: () => AsyncSnapshot<T>;
  readonly run: <R extends T>(task: (signal: AbortSignal) => Promise<R>, options?: AsyncRunOptions) => Promise<R>;
  readonly cancel: (reason?: unknown) => void;
  readonly reset: () => void;
  readonly destroy: () => void;
}

const DEFAULT_TIMEOUT_MS = 60_000;
const MAX_TIMEOUT_MS = 300_000;

function errorFrom(value: unknown, fallback = 'Asenkron işlem başarısız.'): Error {
  if (value instanceof Error) return value;
  return new Error(typeof value === 'string' ? value.slice(0, 240) : fallback);
}

export class HafizeAsyncCancelledError extends Error {
  constructor(message = 'Asenkron işlem iptal edildi.') {
    super(message);
    this.name = 'HafizeAsyncCancelledError';
  }
}

export class HafizeAsyncTimeoutError extends Error {
  readonly timeoutMs: number;

  constructor(timeoutMs: number) {
    super(`Asenkron işlem ${timeoutMs} ms zaman aşımına uğradı.`);
    this.name = 'HafizeAsyncTimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

export function createAsyncController<T = unknown>(
  initialValue: T | null = null
): AsyncController<T> {
  let sequence = 0;
  let destroyed = false;
  let currentController: AbortController | null = null;
  let timeoutHandle: number | undefined;
  const subscribers = new Set<(snapshot: AsyncSnapshot<T>) => void>();
  let current: AsyncSnapshot<T> = Object.freeze({
    phase: 'idle',
    operationId: 0,
    startedAt: null,
    finishedAt: null,
    durationMs: null,
    value: initialValue,
    error: null
  });

  function clearTimeoutHandle(): void {
    if (timeoutHandle !== undefined) {
      globalThis.clearTimeout(timeoutHandle);
      timeoutHandle = undefined;
    }
  }

  function publish(next: AsyncSnapshot<T>): void {
    if (destroyed) return;
    current = Object.freeze(next);
    for (const listener of subscribers) {
      try { listener(current); } catch { /* listener isolation */ }
    }
  }

  function settle(
    operationId: number,
    phase: Exclude<AsyncPhase, 'idle' | 'queued' | 'running'>,
    value: T | null,
    error: Error | null
  ): void {
    if (destroyed || current.operationId !== operationId) return;
    clearTimeoutHandle();
    currentController = null;
    const finishedAt = Date.now();
    const startedAt = current.startedAt;
    publish({
      ...current,
      phase,
      finishedAt,
      durationMs: startedAt === null ? null : Math.max(0, finishedAt - startedAt),
      value,
      error
    });
  }

  async function run<R extends T>(
    task: (signal: AbortSignal) => Promise<R>,
    options: AsyncRunOptions = {}
  ): Promise<R> {
    if (destroyed) throw new Error('ASYNC_CONTROLLER_DESTROYED');

    cancel(new HafizeAsyncCancelledError('Önceki asenkron işlem sonlandırıldı.'));
    const operationId = ++sequence;
    const controller = new AbortController();
    currentController = controller;
    const timeoutMs = Math.min(
      MAX_TIMEOUT_MS,
      Math.max(1_000, Math.floor(options.timeoutMs ?? DEFAULT_TIMEOUT_MS))
    );
    const startedAt = Date.now();

    if (options.signal?.aborted) {
      controller.abort(options.signal.reason);
    } else {
      options.signal?.addEventListener('abort', () => controller.abort(options.signal?.reason), { once: true });
    }

    const notify = (): void => {
      try { options.onStateChange?.(current); } catch { /* listener isolation */ }
    };
    publish({
      phase: 'queued',
      operationId,
      startedAt,
      finishedAt: null,
      durationMs: null,
      value: null,
      error: null
    });
    notify();
    publish({ ...current, phase: 'running' });
    notify();

    timeoutHandle = globalThis.setTimeout(() => {
      if (current.operationId !== operationId) return;
      controller.abort(new HafizeAsyncTimeoutError(timeoutMs));
    }, timeoutMs);

    try {
      const value = await task(controller.signal);
      if (controller.signal.aborted) {
        const reason = controller.signal.reason;
        const error = reason instanceof HafizeAsyncTimeoutError
          ? reason
          : new HafizeAsyncCancelledError();
        settle(operationId, 'cancelled', null, error);
        throw error;
      }
      settle(operationId, 'succeeded', value, null);
      return value;
    } catch (error) {
      const normalized = errorFrom(error);
      if (controller.signal.aborted) {
        const reason = controller.signal.reason;
        const cancelled = reason instanceof HafizeAsyncTimeoutError
          ? reason
          : normalized instanceof HafizeAsyncCancelledError
            ? normalized
            : new HafizeAsyncCancelledError();
        settle(operationId, 'cancelled', null, cancelled);
        throw cancelled;
      }
      settle(operationId, 'failed', null, normalized);
      throw normalized;
    }
  }

  function cancel(reason?: unknown): void {
    clearTimeoutHandle();
    const controller = currentController;
    currentController = null;
    if (!controller || controller.signal.aborted || destroyed) return;
    const error = reason instanceof Error ? reason : new HafizeAsyncCancelledError();
    controller.abort(error);
    if (current.phase === 'queued' || current.phase === 'running') {
      const now = Date.now();
      publish({
        ...current,
        phase: 'cancelled',
        finishedAt: now,
        durationMs: current.startedAt === null ? null : Math.max(0, now - current.startedAt),
        error
      });
    }
  }

  function reset(): void {
    clearTimeoutHandle();
    currentController?.abort(new HafizeAsyncCancelledError());
    currentController = null;
    publish({
      phase: 'idle',
      operationId: sequence,
      startedAt: null,
      finishedAt: null,
      durationMs: null,
      value: initialValue,
      error: null
    });
  }

  return Object.freeze({
    snapshot: () => current,
    run,
    cancel,
    reset,
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      clearTimeoutHandle();
      currentController?.abort(new HafizeAsyncCancelledError());
      currentController = null;
      subscribers.clear();
    }
  });
}

export class HafizeAsyncScope {
  private readonly controllers = new Set<AsyncController<unknown>>();
  private disposed = false;

  create<T = unknown>(initialValue: T | null = null): AsyncController<T> {
    if (this.disposed) throw new Error('ASYNC_SCOPE_DISPOSED');
    const controller = createAsyncController(initialValue);
    this.controllers.add(controller as AsyncController<unknown>);
    return controller;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const controller of this.controllers) controller.destroy();
    this.controllers.clear();
  }
}
