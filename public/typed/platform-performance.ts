import type { PlatformSnapshot, RuntimeMetric } from './platform-runtime.ts';

export type PerformanceBudgetStatus = 'pass' | 'warn' | 'fail';
export interface PerformanceBudget { readonly metric: RuntimeMetric['name']; readonly warn: number; readonly fail: number; readonly label: string }
export interface PerformanceBudgetResult { readonly metric: RuntimeMetric['name']; readonly label: string; readonly value: number | null; readonly status: PerformanceBudgetStatus; readonly warn: number; readonly fail: number }
export interface PerformanceReport { readonly status: PerformanceBudgetStatus; readonly results: readonly PerformanceBudgetResult[]; readonly sampled: number }

export const PERFORMANCE_BUDGETS: readonly PerformanceBudget[] = Object.freeze([
  { metric: 'navigation', warn: 1800, fail: 3500, label: 'Sayfa açılışı' },
  { metric: 'largest-contentful-paint', warn: 2500, fail: 4000, label: 'LCP' },
  { metric: 'longtask', warn: 120, fail: 300, label: 'Uzun görev' },
  { metric: 'event', warn: 100, fail: 250, label: 'Etkileşim' },
  { metric: 'resource', warn: 1500, fail: 4000, label: 'Kaynak yükleme' },
  { metric: 'layout-shift', warn: 0.1, fail: 0.25, label: 'Layout shift' }
]);

const lastFor = (metrics: readonly RuntimeMetric[], name: RuntimeMetric['name']): number | null => {
  const value = [...metrics].reverse().find((metric) => metric.name === name)?.value;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};

export function evaluateBudget(budget: PerformanceBudget, value: number | null): PerformanceBudgetResult {
  const status: PerformanceBudgetStatus = value === null ? 'pass' : value >= budget.fail ? 'fail' : value >= budget.warn ? 'warn' : 'pass';
  return Object.freeze({ metric: budget.metric, label: budget.label, value, status, warn: budget.warn, fail: budget.fail });
}

export function createPerformanceReport(snapshot: PlatformSnapshot): PerformanceReport {
  const results = PERFORMANCE_BUDGETS.map((budget) => evaluateBudget(budget, lastFor(snapshot.metrics, budget.metric)));
  const status: PerformanceBudgetStatus = results.some((result) => result.status === 'fail') ? 'fail' : results.some((result) => result.status === 'warn') ? 'warn' : 'pass';
  return Object.freeze({ status, results: Object.freeze(results), sampled: snapshot.metrics.length });
}

export function summarizePerformance(report: PerformanceReport): string {
  const bad = report.results.filter((result) => result.status !== 'pass');
  if (!bad.length) return 'Performans bütçeleri içinde.';
  return bad.map((result) => `${result.label}: ${result.value === null ? 'ölçüm yok' : result.value.toFixed(result.metric === 'layout-shift' ? 4 : 1)}`).join(' · ');
}
