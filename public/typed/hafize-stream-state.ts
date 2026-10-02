export type HafizeStreamPhase =
  | 'idle'
  | 'connecting'
  | 'streaming'
  | 'completed'
  | 'aborted'
  | 'failed';

export interface HafizeStreamSnapshot {
  readonly phase: HafizeStreamPhase;
  readonly sequence: number;
  readonly startedAt: number | null;
  readonly endedAt: number | null;
  readonly durationMs: number | null;
  readonly bytesRead: number;
  readonly events: number;
  readonly traceId: string | null;
  readonly errorCode: string | null;
  readonly errorMessage: string | null;
}

export interface HafizeStreamController {
  readonly snapshot: () => HafizeStreamSnapshot;
  readonly begin: (traceId?: string | null) => number;
  readonly chunk: (bytes: number, eventCount?: number) => void;
  readonly complete: (stats?: Partial<HafizeStreamSnapshot>) => void;
  readonly fail: (error: unknown, stats?: Partial<HafizeStreamSnapshot>) => void;
  readonly abort: (reason?: unknown) => void;
  readonly reset: () => void;
  readonly subscribe: (listener: (snapshot: HafizeStreamSnapshot) => void) => () => void;
  readonly destroy: () => void;
}

function messageOf(error: unknown): string | null {
  if (error instanceof Error) return error.message.slice(0, 240);
  if (typeof error === 'string') return error.slice(0, 240);
  return error == null ? null : 'Akış beklenmedik biçimde sonlandı.';
}

function codeOf(error: unknown): string | null {
  if (error && typeof error === 'object' && 'code' in error && typeof (error as { code?: unknown }).code === 'string') {
    return String((error as { code: string }).code).slice(0, 100);
  }
  if (error instanceof DOMException) return error.name.slice(0, 100);
  return error ? 'STREAM_ERROR' : null;
}

const initialSnapshot = (): HafizeStreamSnapshot => Object.freeze({
  phase: 'idle',
  sequence: 0,
  startedAt: null,
  endedAt: null,
  durationMs: null,
  bytesRead: 0,
  events: 0,
  traceId: null,
  errorCode: null,
  errorMessage: null
});

export function createHafizeStreamController(): HafizeStreamController {
  let current = initialSnapshot();
  let destroyed = false;
  const listeners = new Set<(snapshot: HafizeStreamSnapshot) => void>();

  function publish(next: HafizeStreamSnapshot): void {
    if (destroyed) return;
    current = Object.freeze(next);
    for (const listener of listeners) {
      try { listener(current); } catch { /* listener isolation */ }
    }
  }

  function begin(traceId: string | null = null): number {
    const sequence = current.sequence + 1;
    publish({
      phase: 'connecting',
      sequence,
      startedAt: Date.now(),
      endedAt: null,
      durationMs: null,
      bytesRead: 0,
      events: 0,
      traceId: traceId?.slice(0, 120) || null,
      errorCode: null,
      errorMessage: null
    });
    return sequence;
  }

  function chunk(bytes: number, eventCount = 1): void {
    if (current.phase !== 'connecting' && current.phase !== 'streaming') return;
    publish({
      ...current,
      phase: 'streaming',
      bytesRead: current.bytesRead + Math.max(0, Math.floor(Number.isFinite(bytes) ? bytes : 0)),
      events: current.events + Math.max(0, Math.floor(Number.isFinite(eventCount) ? eventCount : 0))
    });
  }

  function finish(
    phase: 'completed' | 'aborted' | 'failed',
    stats: Partial<HafizeStreamSnapshot>,
    error: unknown = null
  ): void {
    if (current.phase === 'idle' || current.phase === 'completed' || current.phase === 'aborted' || current.phase === 'failed') return;
    const endedAt = Date.now();
    const errorCode = error ? codeOf(error) : (typeof stats.errorCode === 'string' ? stats.errorCode.slice(0, 100) : null);
    const errorMessage = error ? messageOf(error) : (typeof stats.errorMessage === 'string' ? stats.errorMessage.slice(0, 240) : null);
    publish({
      ...current,
      ...stats,
      phase,
      endedAt,
      durationMs: current.startedAt === null ? null : Math.max(0, endedAt - current.startedAt),
      bytesRead: Math.max(current.bytesRead, Number.isFinite(stats.bytesRead) ? Math.floor(stats.bytesRead as number) : current.bytesRead),
      events: Math.max(current.events, Number.isFinite(stats.events) ? Math.floor(stats.events as number) : current.events),
      traceId: typeof stats.traceId === 'string' ? stats.traceId.slice(0, 120) : current.traceId,
      errorCode,
      errorMessage
    });
  }

  return Object.freeze({
    snapshot: () => current,
    begin,
    chunk,
    complete: (stats = {}) => finish('completed', stats),
    fail: (error, stats = {}) => finish('failed', stats, error),
    abort: (reason) => finish('aborted', {}, reason ?? new DOMException('Aborted', 'AbortError')),
    reset: () => publish({ ...initialSnapshot(), sequence: current.sequence }),
    subscribe: (listener) => {
      if (destroyed) return () => undefined;
      listeners.add(listener);
      // The first delivery is isolated exactly like every later one, so a
      // throwing listener can never break subscription for the others.
      try { listener(current); } catch { /* listener isolation */ }
      return () => listeners.delete(listener);
    },
    destroy: () => {
      destroyed = true;
      listeners.clear();
    }
  });
}

export function phaseLabel(phase: HafizeStreamPhase): string {
  switch (phase) {
    case 'connecting': return 'Bağlanıyor';
    case 'streaming': return 'Yanıt geliyor';
    case 'completed': return 'Tamamlandı';
    case 'aborted': return 'İptal edildi';
    case 'failed': return 'Hata';
    default: return '';
  }
}

export function phaseTone(phase: HafizeStreamPhase): 'neutral' | 'active' | 'success' | 'warning' | 'error' {
  switch (phase) {
    case 'connecting':
    case 'streaming':
      return 'active';
    case 'completed':
      return 'success';
    case 'aborted':
      return 'warning';
    case 'failed':
      return 'error';
    default:
      return 'neutral';
  }
}

export function formatStreamDuration(durationMs: number | null): string {
  if (!Number.isFinite(durationMs) || durationMs === null) return '—';
  const value = Math.max(0, Math.floor(durationMs));
  if (value < 1000) return `${value} ms`;
  return `${(value / 1000).toFixed(value < 10_000 ? 1 : 0)} sn`;
}

export function formatStreamBytes(bytes: number): string {
  const value = Math.max(0, Math.floor(Number.isFinite(bytes) ? bytes : 0));
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(value < 10 * 1024 ? 1 : 0)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}
