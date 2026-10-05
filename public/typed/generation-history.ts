export type GenerationHistoryPhase = 'completed' | 'aborted' | 'failed';

export type GenerationHistoryStopReason =
  | 'user'
  | 'navigation'
  | 'offline'
  | 'shutdown'
  | 'unknown'
  | null;

export interface GenerationHistoryEntry {
  readonly id: string;
  readonly runId: number;
  readonly phase: GenerationHistoryPhase;
  readonly startedAt: string;
  readonly endedAt: string;
  readonly elapsedMs: number;
  readonly bytesRead: number;
  readonly events: number;
  readonly label: string;
  readonly stopReason: GenerationHistoryStopReason;
  readonly errorCode: string | null;
}

export interface GenerationHistoryStorage {
  readonly getItem: (key: string) => string | null;
  readonly setItem: (key: string, value: string) => void;
  readonly removeItem?: (key: string) => void;
}

export const GENERATION_HISTORY_KEY = 'hafize.generation-control.history.v1';
export const GENERATION_HISTORY_LIMIT = 12;
export const GENERATION_HISTORY_MAX_JSON = 24_000;
export const GENERATION_HISTORY_MAX_LABEL = 120;
export const GENERATION_HISTORY_MAX_ERROR = 100;

function text(value: unknown, limit: number): string {
  return String(value ?? '').replace(/\u0000/g, '').slice(0, limit);
}

function positiveInteger(value: unknown, fallback = 0, max = Number.MAX_SAFE_INTEGER): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(0, Math.floor(Number(value))));
}

function timestamp(value: unknown, fallback: string): string {
  if (typeof value !== 'string' || !value) return fallback;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : fallback;
}

function phase(value: unknown): GenerationHistoryPhase | null {
  return value === 'completed' || value === 'aborted' || value === 'failed' ? value : null;
}

function stopReason(value: unknown): GenerationHistoryStopReason {
  return value === 'user' ||
    value === 'navigation' ||
    value === 'offline' ||
    value === 'shutdown' ||
    value === 'unknown'
    ? value
    : null;
}

export function normalizeGenerationHistoryEntry(
  input: unknown,
  fallbackId = 'unknown'
): GenerationHistoryEntry | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const source = input as Record<string, unknown>;
  const entryPhase = phase(source.phase);
  if (!entryPhase) return null;
  const ended = timestamp(source.endedAt, new Date().toISOString());
  const started = timestamp(source.startedAt, ended);
  const id = text(source.id, 120) || text(fallbackId, 120);
  if (!id) return null;
  return Object.freeze({
    id,
    runId: positiveInteger(source.runId, 0, 9_999_999_999),
    phase: entryPhase,
    startedAt: started,
    endedAt: ended,
    elapsedMs: positiveInteger(source.elapsedMs, 0, 86_400_000),
    bytesRead: positiveInteger(source.bytesRead, 0, 20_000_000),
    events: positiveInteger(source.events, 0, 100_000),
    label: text(source.label, GENERATION_HISTORY_MAX_LABEL),
    stopReason: stopReason(source.stopReason),
    errorCode: typeof source.errorCode === 'string'
      ? text(source.errorCode, GENERATION_HISTORY_MAX_ERROR)
      : null
  });
}

export function normalizeGenerationHistory(value: unknown): GenerationHistoryEntry[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const output: GenerationHistoryEntry[] = [];
  for (const [index, item] of value.slice(0, GENERATION_HISTORY_LIMIT * 3).entries()) {
    const normalized = normalizeGenerationHistoryEntry(item, `entry-${index}`);
    if (!normalized || seen.has(normalized.id)) continue;
    seen.add(normalized.id);
    output.push(normalized);
    if (output.length >= GENERATION_HISTORY_LIMIT) break;
  }
  return output;
}

export function readGenerationHistory(storage: GenerationHistoryStorage | null | undefined): GenerationHistoryEntry[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(GENERATION_HISTORY_KEY);
    if (!raw || raw.length > GENERATION_HISTORY_MAX_JSON) return [];
    return normalizeGenerationHistory(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function writeGenerationHistory(
  storage: GenerationHistoryStorage | null | undefined,
  entries: readonly GenerationHistoryEntry[]
): boolean {
  if (!storage) return false;
  const normalized = normalizeGenerationHistory(entries);
  try {
    const raw = JSON.stringify(normalized);
    if (raw.length > GENERATION_HISTORY_MAX_JSON) return false;
    storage.setItem(GENERATION_HISTORY_KEY, raw);
    return true;
  } catch {
    return false;
  }
}

export function appendGenerationHistory(
  storage: GenerationHistoryStorage | null | undefined,
  entry: GenerationHistoryEntry
): GenerationHistoryEntry[] {
  const current = readGenerationHistory(storage);
  const normalized = normalizeGenerationHistoryEntry(entry);
  if (!normalized) return current;
  return normalizeGenerationHistory([
    normalized,
    ...current.filter((candidate) => candidate.id !== normalized.id)
  ]);
}

export function clearGenerationHistory(storage: GenerationHistoryStorage | null | undefined): boolean {
  if (!storage) return false;
  try {
    storage.removeItem?.(GENERATION_HISTORY_KEY);
    if (storage.getItem(GENERATION_HISTORY_KEY)) {
      storage.setItem(GENERATION_HISTORY_KEY, '[]');
    }
    return true;
  } catch {
    return false;
  }
}

export function summarizeGenerationHistory(entries: readonly GenerationHistoryEntry[]) {
  const normalized = normalizeGenerationHistory(entries);
  return Object.freeze({
    total: normalized.length,
    completed: normalized.filter((entry) => entry.phase === 'completed').length,
    aborted: normalized.filter((entry) => entry.phase === 'aborted').length,
    failed: normalized.filter((entry) => entry.phase === 'failed').length,
    totalBytes: normalized.reduce((sum, entry) => sum + entry.bytesRead, 0),
    totalEvents: normalized.reduce((sum, entry) => sum + entry.events, 0),
    totalElapsedMs: normalized.reduce((sum, entry) => sum + entry.elapsedMs, 0)
  });
}

export function historyLabel(entry: GenerationHistoryEntry): string {
  return entry.label || 'Yanıt üretimi';
}

export function historyOutcomeLabel(entry: GenerationHistoryEntry): string {
  switch (entry.phase) {
    case 'completed':
      return 'Tamamlandı';
    case 'aborted':
      return 'Durduruldu';
    case 'failed':
      return 'Hata';
  }
}

export function generationHistoryFromSnapshot(snapshot: {
  readonly phase: GenerationHistoryPhase;
  readonly runId: number;
  readonly startedAt: number | null;
  readonly endedAt: number | null;
  readonly elapsedMs: number;
  readonly bytesRead: number;
  readonly events: number;
  readonly stopReason: GenerationHistoryStopReason;
  readonly label: string;
  readonly errorCode: string | null;
}): GenerationHistoryEntry | null {
  if (snapshot.startedAt === null || snapshot.endedAt === null) return null;
  const now = new Date().toISOString();
  return normalizeGenerationHistoryEntry({
    id: `run-${snapshot.runId}-${snapshot.endedAt}`,
    runId: snapshot.runId,
    phase: snapshot.phase,
    startedAt: new Date(snapshot.startedAt).toISOString(),
    endedAt: new Date(snapshot.endedAt).toISOString(),
    elapsedMs: snapshot.elapsedMs,
    bytesRead: snapshot.bytesRead,
    events: snapshot.events,
    stopReason: snapshot.stopReason,
    label: snapshot.label,
    errorCode: snapshot.errorCode
  }, `run-${snapshot.runId}-${now}`);
}

export function compactGenerationHistoryForCopy(entries: readonly GenerationHistoryEntry[]): string {
  const normalized = normalizeGenerationHistory(entries);
  const summary = summarizeGenerationHistory(normalized);
  const lines = [
    'Hafize üretim geçmişi',
    `Kayıt: ${summary.total}`,
    `Tamamlanan: ${summary.completed}`,
    `Durdurulan: ${summary.aborted}`,
    `Hatalı: ${summary.failed}`,
    `Toplam süre: ${summary.totalElapsedMs} ms`,
    `Toplam veri: ${summary.totalBytes} B`,
    `Toplam SSE olayı: ${summary.totalEvents}`
  ];
  for (const entry of normalized.slice(0, 5)) {
    lines.push(
      `#${entry.runId} ${historyOutcomeLabel(entry)} · ${historyLabel(entry)} · ${entry.elapsedMs} ms · ${entry.events} olay${entry.errorCode ? ` · ${entry.errorCode}` : ''}`
    );
  }
  return lines.join('\n').slice(0, 2_000);
}
