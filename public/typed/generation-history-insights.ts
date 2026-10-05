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
  readonly p95ElapsedMs: number;
  readonly slowestElapsedMs: number;
  readonly fastestElapsedMs: number;
  readonly medianElapsedMs: number;
  readonly recentFailureRate: number;
  readonly recentAbortRate: number;
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

export function percentile(values: readonly number[], percentileValue: number): number {
  if (!values.length) return 0;
  const sorted = values.filter(Number.isFinite).map(Math.max.bind(Math)).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const position = (sorted.length - 1) * Math.min(1, Math.max(0, percentileValue));
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return Math.round(sorted[lower] ?? 0);
  const ratio = position - lower;
  return Math.round((sorted[lower] ?? 0) + ((sorted[upper] ?? 0) - (sorted[lower] ?? 0)) * ratio);
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
  const elapsedValues = values.map((entry) => safeNumber(entry.elapsedMs));
  const recent = values.slice(0, 8);
  const recentFailureRate = recent.length ? recent.filter((entry) => entry.phase === 'failed').length / recent.length : 0;
  const recentAbortRate = recent.length ? recent.filter((entry) => entry.phase === 'aborted').length / recent.length : 0;

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
    dominantErrorFamily,
    p95ElapsedMs: percentile(elapsedValues, 0.95),
    slowestElapsedMs: elapsedValues.length ? Math.max(...elapsedValues) : 0,
    fastestElapsedMs: elapsedValues.length ? Math.min(...elapsedValues) : 0,
    medianElapsedMs: percentile(elapsedValues, 0.5),
    recentFailureRate,
    recentAbortRate
  });
}

export function healthLabel(insights: GenerationHistoryInsights): string {
  if (!insights.total) return 'Veri yok';
  if (insights.recentFailureRate >= 0.5) return 'Sorunlu';
  if (insights.recentFailureRate >= 0.25 || insights.recentAbortRate >= 0.5) return 'İzlenmeli';
  return 'Sağlıklı';
}

export function formatPerformanceLine(insights: GenerationHistoryInsights): string {
  if (!insights.total) return 'Son üretim performansı için yeterli kayıt yok.';
  return `p95 ${insights.p95ElapsedMs} ms · medyan ${insights.medianElapsedMs} ms · ${Math.round(insights.bytesPerSecond)} B/sn · ${healthLabel(insights)}`;
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
