export type GenerationPhase = 'idle' | 'active' | 'completed' | 'aborted' | 'failed';

export type GenerationStopReason = 'user' | 'navigation' | 'offline' | 'shutdown' | 'unknown';

export interface GenerationSnapshot {
  readonly phase: GenerationPhase;
  readonly runId: number;
  readonly startedAt: number | null;
  readonly endedAt: number | null;
  readonly elapsedMs: number;
  readonly stopReason: GenerationStopReason | null;
  readonly label: string;
  readonly errorCode: string | null;
}

export interface GenerationRun {
  readonly runId: number;
  readonly signal: AbortSignal;
  readonly startedAt: number;
}

export interface GenerationControlOptions {
  readonly documentRef?: Document;
  readonly keyboardTarget?: Window;
  readonly composer?: HTMLElement | null;
}

export interface GenerationController {
  readonly snapshot: () => GenerationSnapshot;
  readonly mount: (options?: GenerationControlOptions) => boolean;
  readonly begin: (label: string) => GenerationRun | null;
  readonly stop: (reason?: GenerationStopReason) => boolean;
  readonly complete: () => void;
  readonly fail: (error?: unknown) => void;
  readonly subscribe: (listener: (snapshot: GenerationSnapshot) => void) => () => void;
  readonly destroy: () => void;
}

const CONTROL_ID = 'hafizeGenerationControl';
const STOP_ID = 'hafizeGenerationStop';
const STATUS_ID = 'hafizeGenerationControlStatus';
const MAX_LABEL = 120;
const MAX_ERROR = 100;

function clampText(value: unknown, limit: number): string {
  return String(value ?? '').replace(/\u0000/g, '').slice(0, limit);
}

function errorCodeOf(error: unknown): string | null {
  if (error && typeof error === 'object' && 'code' in error) {
    const value = (error as { code?: unknown }).code;
    return typeof value === 'string' ? clampText(value, MAX_ERROR) : null;
  }
  if (error instanceof DOMException) return clampText(error.name, MAX_ERROR);
  return error ? 'GENERATION_ERROR' : null;
}

function initialSnapshot(): GenerationSnapshot {
  return Object.freeze({
    phase: 'idle',
    runId: 0,
    startedAt: null,
    endedAt: null,
    elapsedMs: 0,
    stopReason: null,
    label: '',
    errorCode: null
  });
}

function isEditingTarget(target: EventTarget | null): boolean {
  const node = target instanceof HTMLElement ? target : null;
  if (!node) return false;
  return Boolean(node.closest('textarea,input,select,[contenteditable="true"]'));
}

export function formatGenerationElapsed(elapsedMs: number): string {
  const value = Math.max(0, Math.floor(Number.isFinite(elapsedMs) ? elapsedMs : 0));
  if (value < 1000) return `${value} ms`;
  const seconds = value / 1000;
  return seconds < 60 ? `${seconds.toFixed(seconds < 10 ? 1 : 0)} sn` : `${Math.floor(seconds / 60)} dk ${Math.floor(seconds % 60)} sn`;
}

export function createGenerationController(): GenerationController {
  let current = initialSnapshot();
  let controller: AbortController | null = null;
  let mounted = false;
  let destroyed = false;
  let timer: number | undefined;
  let control: HTMLElement | null = null;
  let button: HTMLButtonElement | null = null;
  let status: HTMLElement | null = null;
  let keyboardTarget: Window | null = null;
  const listeners = new Set<(snapshot: GenerationSnapshot) => void>();
  const disposers: Array<() => void> = [];

  function elapsed(snapshot: GenerationSnapshot): number {
    if (snapshot.startedAt === null) return snapshot.elapsedMs;
    const end = snapshot.endedAt ?? Date.now();
    return Math.max(0, end - snapshot.startedAt);
  }

  function publish(next: Omit<GenerationSnapshot, 'elapsedMs'> & Partial<Pick<GenerationSnapshot, 'elapsedMs'>>): void {
    if (destroyed) return;
    current = Object.freeze({
      ...next,
      elapsedMs: next.elapsedMs ?? elapsed(next as GenerationSnapshot)
    });
    for (const listener of listeners) {
      try { listener(current); } catch { /* listener isolation */ }
    }
    paint();
  }

  function paint(): void {
    if (!control || !button || !status) return;
    const active = current.phase === 'active';
    control.hidden = !active;
    control.dataset.phase = current.phase;
    button.disabled = !active;
    status.textContent = active
      ? `${current.label || 'Yanıt üretiliyor'} · ${formatGenerationElapsed(elapsed(current))}`
      : '';
    button.setAttribute('aria-busy', String(active));
  }

  function tick(): void {
    if (current.phase !== 'active') return;
    paint();
  }

  function stop(reason: GenerationStopReason = 'user'): boolean {
    if (!controller || current.phase !== 'active') return false;
    const active = controller;
    controller = null;
    active.abort(new DOMException('Generation stopped', 'AbortError'));
    publish({
      phase: 'aborted',
      runId: current.runId,
      startedAt: current.startedAt,
      endedAt: Date.now(),
      stopReason: reason,
      label: current.label,
      errorCode: 'SSE_ABORTED'
    });
    return true;
  }

  function onShortcut(event: KeyboardEvent): void {
    if (!(event.ctrlKey || event.metaKey) || !event.shiftKey || event.key.toLowerCase() !== 'x') return;
    if (isEditingTarget(event.target)) return;
    if (current.phase !== 'active') return;
    event.preventDefault();
    stop('user');
  }

  function mount(options: GenerationControlOptions = {}): boolean {
    if (destroyed || mounted) return mounted;
    const documentRef = options.documentRef ?? document;
    const target = options.composer ?? documentRef.querySelector<HTMLElement>('#composer');
    if (!documentRef || !target || documentRef.getElementById(CONTROL_ID)) return false;

    control = documentRef.createElement('div');
    control.id = CONTROL_ID;
    control.className = 'generation-control';
    control.hidden = true;
    control.setAttribute('role', 'group');
    control.setAttribute('aria-label', 'Yanıt üretim kontrolü');

    status = documentRef.createElement('span');
    status.id = STATUS_ID;
    status.className = 'generation-control-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.setAttribute('aria-atomic', 'true');

    button = documentRef.createElement('button');
    button.id = STOP_ID;
    button.type = 'button';
    button.className = 'generation-control-stop';
    button.textContent = 'Üretimi durdur';
    button.setAttribute('aria-label', 'Devam eden Hafize yanıt üretimini durdur');
    button.addEventListener('click', () => stop('user'));

    control.append(status, button);
    const anchor = target.querySelector('.composer-row');
    if (anchor) target.insertBefore(control, anchor);
    else target.append(control);
    mounted = true;

    keyboardTarget = options.keyboardTarget ?? window;
    keyboardTarget.addEventListener('keydown', onShortcut);
    disposers.push(() => keyboardTarget?.removeEventListener('keydown', onShortcut));

    paint();
    return true;
  }

  function begin(label: string): GenerationRun | null {
    if (destroyed || current.phase === 'active') return null;
    const nextController = new AbortController();
    controller = nextController;
    const runId = current.runId + 1;
    const startedAt = Date.now();
    publish({
      phase: 'active',
      runId,
      startedAt,
      endedAt: null,
      stopReason: null,
      label: clampText(label || 'Yanıt üretiliyor', MAX_LABEL),
      errorCode: null
    });
    if (timer !== undefined) globalThis.clearInterval(timer);
    timer = globalThis.setInterval(tick, 250);
    return Object.freeze({ runId, signal: nextController.signal, startedAt });
  }

  function complete(): void {
    if (current.phase !== 'active') return;
    controller = null;
    publish({
      phase: 'completed',
      runId: current.runId,
      startedAt: current.startedAt,
      endedAt: Date.now(),
      stopReason: null,
      label: current.label,
      errorCode: null
    });
    if (timer !== undefined) globalThis.clearInterval(timer);
    timer = undefined;
  }

  function fail(error?: unknown): void {
    if (current.phase !== 'active') return;
    controller = null;
    publish({
      phase: 'failed',
      runId: current.runId,
      startedAt: current.startedAt,
      endedAt: Date.now(),
      stopReason: null,
      label: current.label,
      errorCode: errorCodeOf(error)
    });
    if (timer !== undefined) globalThis.clearInterval(timer);
    timer = undefined;
  }

  function destroy(): void {
    if (destroyed) return;
    destroyed = true;
    controller?.abort(new DOMException('Generation controller destroyed', 'AbortError'));
    controller = null;
    if (timer !== undefined) globalThis.clearInterval(timer);
    timer = undefined;
    for (const dispose of disposers.splice(0)) dispose();
    control?.remove();
    control = null;
    button = null;
    status = null;
    listeners.clear();
  }

  return Object.freeze({
    snapshot: () => current,
    mount,
    begin,
    stop,
    complete,
    fail,
    subscribe: (listener: (snapshot: GenerationSnapshot) => void) => {
      if (destroyed) return () => undefined;
      listeners.add(listener);
      try { listener(current); } catch { /* listener isolation */ }
      return () => listeners.delete(listener);
    },
    destroy
  });
}

export const HAFIZE_GENERATION_CONTROL_SHORTCUT = 'Ctrl/⌘ + Shift + X';
