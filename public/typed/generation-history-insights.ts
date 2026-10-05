import type { GenerationHistoryEntry } from './generation-history.ts';

export type GenerationHistoryFilter = 'all' | 'completed' | 'aborted' | 'failed';

export type GenerationErrorFamily =
  | 'network'
  | 'timeout'
  | 'model'
  | 'application'
  | 'user'
  | 'unknown';

export interface GenerationHistoryInsights {
  readonly total: number;
  readonly completed: number;
  readonly aborted: number;
  readonly failed: number;
  readonly completionRate: number;
  readonly averageElapsedMs: number;
  readonly averageBytesRead: number;
  readonly averageEvents: number;
  readonly bytesPerSecond: number;
  readonly eventsPerSecond: number;
  readonly latest: GenerationHistoryEntry | null;
  readonly dominantErrorFamily: GenerationErrorFamily | null;
}

function safeNumber(value: unknown): number {
  return Number.isFinite(value) ? Math.max(0, Number(value)) : 0;
}

export function filterGenerationHistory(
  entries: readonly GenerationHistoryEntry[],
  filter: GenerationHistoryFilter
): GenerationHistoryEntry[] {
  if (filter === 'all') return [...entries];
  return entries.filter((entry) => entry.phase === filter);
}

export function classifyGenerationError(entry: GenerationHistoryEntry): GenerationErrorFamily | null {
  if (entry.phase !== 'failed' || !entry.errorCode) return null;
  const code = entry.errorCode.toUpperCase();
  if (code.includes('ABORT')) return 'user';
  if (code.includes('TIMEOUT')) return 'timeout';
  if (code.includes('NETWORK') || code.includes('FETCH') || code.includes('CONNECTION')) return 'network';
  if (code.includes('NVIDIA') || code.includes('MODEL')) return 'model';
  if (code.includes('API') || code.includes('HTTP') || code.includes('SSE_')) return 'application';
  return 'unknown';
}

export function summarizeGenerationInsights(
  entries: readonly GenerationHistoryEntry[]
): GenerationHistoryInsights {
  const values = [...entries];
  const total = values.length;
  const completed = values.filter((entry) => entry.phase === 'completed').length;
  const aborted = values.filter((entry) => entry.phase === 'aborted').length;
  const failed = values.filter((entry) => entry.phase === 'failed').length;
  const elapsed = values.reduce((sum, entry) => sum + safeNumber(entry.elapsedMs), 0);
  const bytes = values.reduce((sum, entry) => sum + safeNumber(entry.bytesRead), 0);
  const events = values.reduce((sum, entry) => sum + safeNumber(entry.events), 0);
  const seconds = elapsed > 0 ? elapsed / 1000 : 0;

  const errorCounts = new Map<GenerationErrorFamily, number>();
  for (const entry of values) {
    const family = classifyGenerationError(entry);
    if (!family) continue;
    errorCounts.set(family, (errorCounts.get(family) || 0) + 1);
  }
  let dominantErrorFamily: GenerationErrorFamily | null = null;
  let highest = 0;
  for (const [family, count] of errorCounts) {
    if (count > highest) {
      highest = count;
      dominantErrorFamily = family;
    }
  }

  return Object.freeze({
    total,
    completed,
    aborted,
    failed,
    completionRate: total ? completed / total : 0,
    averageElapsedMs: total ? Math.round(elapsed / total) : 0,
    averageBytesRead: total ? Math.round(bytes / total) : 0,
    averageEvents: total ? Math.round(events / total) : 0,
    bytesPerSecond: seconds ? Math.round(bytes / seconds) : 0,
    eventsPerSecond: seconds ? Math.round(events / seconds) : 0,
    latest: values[0] || null,
    dominantErrorFamily
  });
}

export function formatCompletionRate(value: number): string {
  const normalized = Math.min(1, Math.max(0, safeNumber(value)));
  return `${Math.round(normalized * 100)}%`;
}

export function formatRate(value: number, unit: string): string {
  return `${Math.max(0, Math.round(safeNumber(value)))} ${unit}`;
}

export function formatHistoryInsightLine(insights: GenerationHistoryInsights): string {
  if (!insights.total) return 'Henüz üretim geçmişi yok.';
  const latest = insights.latest?.phase === 'failed' && insights.dominantErrorFamily
    ? ` · baskın hata: ${insights.dominantErrorFamily}`
    : '';
  return `Başarı ${formatCompletionRate(insights.completionRate)} · ort. ${insights.averageElapsedMs} ms · ${formatRate(insights.bytesPerSecond, 'B/sn')}${latest}`;
}
