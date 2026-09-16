export type TaskPriority = 'critical' | 'normal' | 'idle';
export type TaskState = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
export interface PlatformTaskOptions { readonly id?: string; readonly priority?: TaskPriority; readonly timeoutMs?: number; readonly signal?: AbortSignal }
export interface PlatformTaskSnapshot { readonly id: string; readonly priority: TaskPriority; readonly state: TaskState; readonly queuedAt: number; readonly startedAt: number | null; readonly finishedAt: number | null; readonly error: string | null }
export interface PlatformTaskHandle { readonly id: string; readonly promise: Promise<void>; readonly cancel: () => void; readonly snapshot: () => PlatformTaskSnapshot }
interface InternalTask { readonly id: string; readonly priority: TaskPriority; readonly work: (signal: AbortSignal) => void | Promise<void>; readonly controller: AbortController; readonly queuedAt: number; readonly timeoutMs: number; startedAt: number | null; finishedAt: number | null; state: TaskState; error: string | null; resolve: () => void; reject: (reason: unknown) => void }
const MAX_QUEUE = 32; const DEFAULT_TIMEOUT = 10_000; const WEIGHT: Record<TaskPriority, number> = { critical: 0, normal: 1, idle: 2 }; let sequence = 0;
const makeId = (): string => `hafize-task-${Date.now()}-${sequence++}`;

export class PlatformTaskQueue {
  private readonly tasks = new Map<string, InternalTask>(); private running = 0; private stopped = false;
  constructor(private readonly concurrency = 2, private readonly maxQueue = MAX_QUEUE) {}
  private pick(): InternalTask | undefined { return [...this.tasks.values()].filter((task) => task.state === 'queued').sort((a, b) => WEIGHT[a.priority] - WEIGHT[b.priority] || a.queuedAt - b.queuedAt)[0]; }
  private finish(task: InternalTask, state: TaskState, error: unknown = null): void { task.state = state; task.finishedAt = Date.now(); task.error = error instanceof Error ? error.message.slice(0, 180) : error ? String(error).slice(0, 180) : null; }
  private async run(task: InternalTask): Promise<void> {
    if (task.state !== 'queued') return; this.running += 1; task.startedAt = Date.now(); task.state = 'running'; let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      if (task.controller.signal.aborted) throw task.controller.signal.reason ?? new DOMException('Aborted', 'AbortError');
      await new Promise<void>((resolve, reject) => {
        let settled = false;
        const settle = (fn: () => void): void => { if (settled) return; settled = true; if (timer) clearTimeout(timer); task.controller.signal.removeEventListener('abort', onAbort); fn(); };
        const onAbort = (): void => settle(() => reject(task.controller.signal.reason ?? new DOMException('Aborted', 'AbortError')));
        task.controller.signal.addEventListener('abort', onAbort, { once: true });
        timer = setTimeout(() => task.controller.abort(new DOMException('Task timeout', 'TimeoutError')), task.timeoutMs);
        Promise.resolve(task.work(task.controller.signal)).then(() => settle(resolve), (error) => settle(() => reject(error)));
      });
      this.finish(task, 'completed'); task.resolve();
    } catch (error) {
      const reason = task.controller.signal.reason; const cancelled = reason === 'user-cancelled' || reason === 'feature-stopped' || (reason instanceof DOMException && reason.name === 'AbortError');
      this.finish(task, cancelled ? 'cancelled' : 'failed', error); task.reject(error);
    } finally { this.running -= 1; this.pump(); }
  }
  private pump(): void { if (this.stopped) return; while (this.running < Math.max(1, this.concurrency)) { const task = this.pick(); if (!task) return; void this.run(task); } }
  enqueue(work: (signal: AbortSignal) => void | Promise<void>, options: PlatformTaskOptions = {}): PlatformTaskHandle {
    if (this.stopped || this.tasks.size >= this.maxQueue) throw new Error('PLATFORM_TASK_QUEUE_FULL');
    const id = options.id?.trim().slice(0, 80) || makeId(); if (this.tasks.has(id)) throw new Error('PLATFORM_TASK_DUPLICATE');
    const controller = new AbortController(); const task = { id, priority: options.priority ?? 'normal', work, controller, queuedAt: Date.now(), timeoutMs: Math.min(120_000, Math.max(250, options.timeoutMs ?? DEFAULT_TIMEOUT)), startedAt: null, finishedAt: null, state: 'queued' as TaskState, error: null, resolve: () => undefined, reject: (_reason: unknown) => undefined } as InternalTask;
    const promise = new Promise<void>((resolve, reject) => { task.resolve = resolve; task.reject = reject; });
    const abort = (): void => controller.abort(options.signal?.reason ?? new DOMException('Aborted', 'AbortError'));
    options.signal?.addEventListener('abort', abort, { once: true }); this.tasks.set(id, task); this.pump();
    return Object.freeze({ id, promise, cancel: () => controller.abort('user-cancelled'), snapshot: () => Object.freeze({ id: task.id, priority: task.priority, state: task.state, queuedAt: task.queuedAt, startedAt: task.startedAt, finishedAt: task.finishedAt, error: task.error }) });
  }
  prune(keepCompleted = 8): void { const finished = [...this.tasks.values()].filter((task) => task.state === 'completed' || task.state === 'failed' || task.state === 'cancelled').sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0)); for (const task of finished.slice(keepCompleted)) this.tasks.delete(task.id); }
  snapshots(): readonly PlatformTaskSnapshot[] { return Object.freeze([...this.tasks.values()].map((task) => Object.freeze({ id: task.id, priority: task.priority, state: task.state, queuedAt: task.queuedAt, startedAt: task.startedAt, finishedAt: task.finishedAt, error: task.error }))); }
  stop(): void { this.stopped = true; for (const task of this.tasks.values()) if (task.state === 'queued' || task.state === 'running') task.controller.abort('feature-stopped'); }
}
export const hafizePlatformTaskQueue = new PlatformTaskQueue();
