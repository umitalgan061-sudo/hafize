import {
  appendGenerationHistory,
  clearGenerationHistory,
  compactGenerationHistoryForCopy,
  generationHistoryFromSnapshot,
  historyLabel,
  historyOutcomeLabel,
  readGenerationHistory,
  summarizeGenerationHistory,
  writeGenerationHistory,
  type GenerationHistoryEntry
} from './generation-history.ts';

export type GenerationPhase = 'idle' | 'active' | 'completed' | 'aborted' | 'failed';

export type GenerationStopReason = 'user' | 'navigation' | 'offline' | 'shutdown' | 'unknown';

export interface GenerationSnapshot {
  readonly phase: GenerationPhase;
  readonly runId: number;
  readonly startedAt: number | null;
  readonly endedAt: number | null;
  readonly elapsedMs: number;
  readonly bytesRead: number;
  readonly events: number;
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
  readonly progress: (bytesRead: number, events?: number) => void;
  readonly stop: (reason?: GenerationStopReason) => boolean;
  readonly complete: (stats?: Partial<GenerationSnapshot>) => void;
  readonly fail: (error?: unknown, stats?: Partial<GenerationSnapshot>) => void;
  readonly readHistory: () => GenerationHistoryEntry[];
  readonly historySummary: () => ReturnType<typeof summarizeGenerationHistory>;
  readonly clearHistory: () => boolean;
  readonly copyHistory: () => Promise<boolean>;
  readonly renderHistory: () => void;
  readonly copyDiagnostics: () => Promise<boolean>;
  readonly subscribe: (listener: (snapshot: GenerationSnapshot) => void) => () => void;
  readonly destroy: () => void;
}

const CONTROL_ID = 'hafizeGenerationControl';
const STOP_ID = 'hafizeGenerationStop';
const COPY_ID = 'hafizeGenerationDiagnostics';
const STATUS_ID = 'hafizeGenerationControlStatus';
const TERMINAL_HIDE_MS = 5000;
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
    bytesRead: 0,
    events: 0,
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
  return seconds < 60
    ? `${seconds.toFixed(seconds < 10 ? 1 : 0)} sn`
    : `${Math.floor(seconds / 60)} dk ${Math.floor(seconds % 60)} sn`;
}

export function formatGenerationBytes(bytes: number): string {
  const value = Math.max(0, Math.floor(Number.isFinite(bytes) ? bytes : 0));
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(value < 10 * 1024 ? 1 : 0)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDiagnostics(snapshot: GenerationSnapshot): string {
  const phase = snapshot.phase === 'completed'
    ? 'tamamlandı'
    : snapshot.phase === 'aborted'
      ? 'durduruldu'
      : snapshot.phase === 'failed'
        ? 'hata'
        : snapshot.phase;
  const lines = [
    'Hafize üretim tanısı',
    `Durum: ${phase}`,
    `Çalışma: ${snapshot.runId}`,
    `Süre: ${formatGenerationElapsed(snapshot.elapsedMs)}`,
    `SSE olayları: ${snapshot.events}`,
    `Okunan veri: ${formatGenerationBytes(snapshot.bytesRead)}`,
    `Etiket: ${clampText(snapshot.label, MAX_LABEL) || 'Yok'}`
  ];
  if (snapshot.stopReason) lines.push(`Durdurma nedeni: ${snapshot.stopReason}`);
  if (snapshot.errorCode) lines.push(`Hata kodu: ${snapshot.errorCode}`);
  return lines.join('\n').slice(0, 1500);
}

export function createGenerationController(): GenerationController {
  let current = initialSnapshot();
  let controller: AbortController | null = null;
  let mounted = false;
  let destroyed = false;
  let timer: number | undefined;
  let terminalTimer: number | undefined;
  let control: HTMLElement | null = null;
  let button: HTMLButtonElement | null = null;
  let diagnostics: HTMLButtonElement | null = null;
  let historyButton: HTMLButtonElement | null = null;
  let historyList: HTMLElement | null = null;
  let status: HTMLElement | null = null;
  let keyboardTarget: Window | null = null;
  let historyStorage: Storage | null = null;
  const listeners = new Set<(snapshot: GenerationSnapshot) => void>();
  const disposers: Array<() => void> = [];

  function computedElapsed(): number {
    if (current.startedAt === null) return current.elapsedMs;
    const end = current.endedAt ?? Date.now();
    return Math.max(0, end - current.startedAt);
  }

  function persistTerminalSnapshot(): void {
    const entry = generationHistoryFromSnapshot(current);
    if (!entry || !historyStorage) return;
    const next = appendGenerationHistory(historyStorage, entry);
    writeGenerationHistory(historyStorage, next);
  }

  function clearTerminalTimer(): void {
    if (terminalTimer !== undefined) globalThis.clearTimeout(terminalTimer);
    terminalTimer = undefined;
  }

  function publish(next: Omit<GenerationSnapshot, 'elapsedMs'> & Partial<Pick<GenerationSnapshot, 'elapsedMs'>>): void {
    if (destroyed) return;
    current = Object.freeze({
      ...next,
      elapsedMs: next.elapsedMs ?? computedElapsed()
    });
    for (const listener of listeners) {
      try { listener(current); } catch { /* listener isolation */ }
    }
    paint();
  }

  function renderHistory(): void {
    if (!historyList) return;
    historyList.replaceChildren();
    const entries = readHistory().slice(0, 5);
    if (!entries.length) {
      const empty = document.createElement('span');
      empty.className = 'generation-history-empty';
      empty.textContent = 'Henüz tamamlanmış üretim kaydı yok.';
      historyList.append(empty);
      return;
    }
    for (const entry of entries) {
      const row = document.createElement('div');
      row.className = 'generation-history-row';
      const label = document.createElement('span');
      label.className = 'generation-history-label';
      label.textContent = historyLabel(entry);
      const meta = document.createElement('span');
      meta.className = 'generation-history-meta';
      meta.textContent = `${historyOutcomeLabel(entry)} · ${formatGenerationElapsed(entry.elapsedMs)} · ${entry.events} olay · ${formatGenerationBytes(entry.bytesRead)}`;
      row.append(label, meta);
      historyList.append(row);
    }
  }

  function paint(): void {
    if (!control || !button || !diagnostics || !status) return;
    const active = current.phase === 'active';
    const terminal = current.phase === 'completed' || current.phase === 'aborted' || current.phase === 'failed';
    control.hidden = current.phase === 'idle';
    control.dataset.phase = current.phase;
    button.hidden = !active;
    button.disabled = !active;
    diagnostics.hidden = !terminal;
    diagnostics.disabled = !terminal;
    historyButton && (historyButton.hidden = !terminal);
    if (historyButton && terminal) renderHistory();
    status.textContent = current.phase === 'idle'
      ? ''
      : `${current.label || 'Yanıt üretimi'} · ${formatGenerationElapsed(computedElapsed())} · ${current.events} olay · ${formatGenerationBytes(current.bytesRead)}`;
  }

  function scheduleTick(): void {
    if (timer !== undefined) globalThis.clearInterval(timer);
    timer = globalThis.setInterval(() => {
      if (current.phase === 'active') {
        current = Object.freeze({ ...current, elapsedMs: computedElapsed() });
        paint();
      }
    }, 250);
  }

  function scheduleTerminalHide(): void {
    clearTerminalTimer();
    terminalTimer = globalThis.setTimeout(() => {
      if (current.phase !== 'active') {
        current = Object.freeze({ ...initialSnapshot(), runId: current.runId });
        paint();
      }
    }, TERMINAL_HIDE_MS);
  }

  function stop(reason: GenerationStopReason = 'user'): boolean {
    if (!controller || current.phase !== 'active') return false;
    const activeController = controller;
    controller = null;
    activeController.abort(new DOMException('Generation stopped', 'AbortError'));
    publish({
      phase: 'aborted',
      runId: current.runId,
      startedAt: current.startedAt,
      endedAt: Date.now(),
      bytesRead: current.bytesRead,
      events: current.events,
      stopReason: reason,
      label: current.label,
      errorCode: 'SSE_ABORTED'
    });
    persistTerminalSnapshot();
    scheduleTerminalHide();
    return true;
  }

  function onShortcut(event: KeyboardEvent): void {
    if (!(event.ctrlKey || event.metaKey) || !event.shiftKey || event.key.toLowerCase() !== 'x') return;
    if (isEditingTarget(event.target)) return;
    if (current.phase !== 'active') return;
    event.preventDefault();
    stop('user');
  }

  async function copyDiagnostics(): Promise<boolean> {
    const terminal = current.phase === 'completed' || current.phase === 'aborted' || current.phase === 'failed';
    if (!terminal) return false;
    const value = formatDiagnostics(current);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        status && (status.textContent = 'Tanı özeti panoya kopyalandı.');
        return true;
      }
    } catch { /* fall through to unavailable */ }
    return false;
  }

  function mount(options: GenerationControlOptions = {}): boolean {
    if (destroyed || mounted) return mounted;
    const documentRef = options.documentRef ?? document;
    const target = options.composer ?? documentRef.querySelector<HTMLElement>('#composer');
    historyStorage = (() => {
      try { return window.localStorage; } catch { return null; }
    })();
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

    diagnostics = documentRef.createElement('button');
    diagnostics.id = COPY_ID;
    diagnostics.type = 'button';
    diagnostics.className = 'generation-control-diagnostics';
    diagnostics.textContent = 'Tanıyı kopyala';
    diagnostics.setAttribute('aria-label', 'Üretim tanı özetini panoya kopyala');
    diagnostics.hidden = true;
    diagnostics.addEventListener('click', () => {
      void copyDiagnostics();
    });

    historyButton = documentRef.createElement('button');
    historyButton.id = 'hafizeGenerationHistory';
    historyButton.type = 'button';
    historyButton.className = 'generation-control-history';
    historyButton.textContent = 'Geçmişi aç';
    historyButton.setAttribute('aria-expanded', 'false');
    historyButton.setAttribute('aria-controls', 'hafizeGenerationHistoryList');
    historyButton.addEventListener('click', () => {
      if (!historyList) return;
      const nextHidden = !historyList.hidden;
      historyList.hidden = nextHidden;
      historyButton?.setAttribute('aria-expanded', String(!nextHidden));
      if (!nextHidden) renderHistory();
    });

    historyList = documentRef.createElement('div');
    historyList.id = 'hafizeGenerationHistoryList';
    historyList.className = 'generation-history-list';
    historyList.hidden = true;
    historyList.setAttribute('role', 'list');
    historyList.setAttribute('aria-label', 'Son üretimler');

    const clearHistoryButton = documentRef.createElement('button');
    clearHistoryButton.type = 'button';
    clearHistoryButton.className = 'generation-control-history-clear';
    clearHistoryButton.textContent = 'Geçmişi temizle';
    clearHistoryButton.setAttribute('aria-label', 'Yerel üretim geçmişini temizle');
    clearHistoryButton.addEventListener('click', () => {
      if (!globalThis.confirm('Üretim geçmişi silinsin mi?')) return;
      if (!clearHistory()) return;
      renderHistory();
    });

    const historyActions = documentRef.createElement('div');
    historyActions.className = 'generation-history-actions';
    historyActions.append(historyButton, clearHistoryButton);

    control.append(status, button, diagnostics, historyActions, historyList);
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
    clearTerminalTimer();
    const nextController = new AbortController();
    controller = nextController;
    const runId = current.runId + 1;
    const startedAt = Date.now();
    publish({
      phase: 'active',
      runId,
      startedAt,
      endedAt: null,
      bytesRead: 0,
      events: 0,
      stopReason: null,
      label: clampText(label || 'Yanıt üretiliyor', MAX_LABEL),
      errorCode: null
    });
    scheduleTick();
    return Object.freeze({ runId, signal: nextController.signal, startedAt });
  }

  function progress(bytesRead: number, events = 1): void {
    if (current.phase !== 'active') return;
    publish({
      ...current,
      phase: 'active',
      elapsedMs: computedElapsed(),
      bytesRead: Math.max(current.bytesRead, Math.max(0, Math.floor(Number.isFinite(bytesRead) ? bytesRead : 0))),
      events: current.events + Math.max(0, Math.floor(Number.isFinite(events) ? events : 0))
    });
  }

  function complete(stats: Partial<GenerationSnapshot> = {}): void {
    if (current.phase !== 'active') return;
    controller = null;
    if (timer !== undefined) globalThis.clearInterval(timer);
    timer = undefined;
    publish({
      phase: 'completed',
      runId: current.runId,
      startedAt: current.startedAt,
      endedAt: Date.now(),
      bytesRead: Math.max(current.bytesRead, stats.bytesRead ?? current.bytesRead),
      events: Math.max(current.events, stats.events ?? current.events),
      stopReason: null,
      label: current.label,
      errorCode: stats.errorCode ?? null,
      ...stats
    });
    persistTerminalSnapshot();
    scheduleTerminalHide();
  }

  function fail(error?: unknown, stats: Partial<GenerationSnapshot> = {}): void {
    if (current.phase !== 'active') return;
    controller = null;
    if (timer !== undefined) globalThis.clearInterval(timer);
    timer = undefined;
    publish({
      phase: 'failed',
      runId: current.runId,
      startedAt: current.startedAt,
      endedAt: Date.now(),
      bytesRead: Math.max(current.bytesRead, stats.bytesRead ?? current.bytesRead),
      events: Math.max(current.events, stats.events ?? current.events),
      stopReason: null,
      label: current.label,
      errorCode: errorCodeOf(error),
      ...stats
    });
    persistTerminalSnapshot();
    scheduleTerminalHide();
  }

  function readHistory(): GenerationHistoryEntry[] {
    return readGenerationHistory(historyStorage);
  }

  function historySummary() {
    return summarizeGenerationHistory(readHistory());
  }

  function clearHistory(): boolean {
    return clearGenerationHistory(historyStorage);
  }

  async function copyHistory(): Promise<boolean> {
    const entries = readHistory();
    if (!entries.length) return false;
    const value = compactGenerationHistoryForCopy(entries);
    try {
      if (globalThis.navigator?.clipboard?.writeText) {
        await globalThis.navigator.clipboard.writeText(value);
        return true;
      }
    } catch {
      return false;
    }
    return false;
  }

  function destroy(): void {
    if (destroyed) return;
    destroyed = true;
    clearTerminalTimer();
    controller?.abort(new DOMException('Generation controller destroyed', 'AbortError'));
    controller = null;
    if (timer !== undefined) globalThis.clearInterval(timer);
    timer = undefined;
    for (const dispose of disposers.splice(0)) dispose();
    control?.remove();
    control = null;
    button = null;
    diagnostics = null;
    status = null;
    listeners.clear();
  }

  return Object.freeze({
    snapshot: () => current,
    mount,
    begin,
    progress,
    stop,
    complete,
    fail,
    readHistory,
    historySummary,
    clearHistory,
    copyHistory,
    renderHistory,
    copyDiagnostics,
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
