import type { PlatformSnapshot } from './platform-runtime.ts';
import { createPerformanceReport, type PerformanceReport } from './platform-performance.ts';

export interface DiagnosticsDocument {
  readonly version: 1;
  readonly exportedAt: string;
  readonly app: string;
  readonly network: string;
  readonly visible: boolean;
  readonly capabilities: Readonly<Record<string, boolean>>;
  readonly storage: PlatformSnapshot['storage'];
  readonly featureStates: PlatformSnapshot['featureStates'];
  readonly performance: PerformanceReport;
  readonly recentMetrics: readonly { readonly name: string; readonly value: number; readonly at: number }[];
  readonly errorCount: number;
}

export interface DiagnosticsRuntime { readonly snapshot: () => PlatformSnapshot }

const MAX_METRICS = 20;
const MAX_JSON_BYTES = 120_000;
const SAFE_APP_NAME = 'hafize-platform-diagnostics';

function sanitizeText(value: unknown, max = 180): string {
  return typeof value === 'string' ? value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').slice(0, max) : '';
}

export function buildDiagnostics(runtime: DiagnosticsRuntime): DiagnosticsDocument {
  const snapshot = runtime.snapshot();
  const recentMetrics = snapshot.metrics.slice(-MAX_METRICS).map((metric) => ({ name: sanitizeText(metric.name, 80), value: Number.isFinite(metric.value) ? metric.value : 0, at: metric.at }));
  return Object.freeze({
    version: 1,
    exportedAt: new Date().toISOString(),
    app: SAFE_APP_NAME,
    network: snapshot.network,
    visible: snapshot.visible,
    capabilities: Object.freeze({ ...snapshot.capabilities }),
    storage: Object.freeze({ ...snapshot.storage }),
    featureStates: Object.freeze({ ...snapshot.featureStates }),
    performance: createPerformanceReport(snapshot),
    recentMetrics: Object.freeze(recentMetrics),
    errorCount: snapshot.errors
  });
}

export function diagnosticsJson(runtime: DiagnosticsRuntime): string {
  const output = JSON.stringify(buildDiagnostics(runtime), null, 2);
  return output.length <= MAX_JSON_BYTES ? output : JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), app: SAFE_APP_NAME, truncated: true });
}

export function downloadDiagnostics(documentRef: Document, runtime: DiagnosticsRuntime): boolean {
  try {
    const blob = new Blob([diagnosticsJson(runtime)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = documentRef.createElement('a');
    link.href = url;
    link.download = 'hafize-platform-diagnostics.json';
    link.click();
    globalThis.setTimeout(() => URL.revokeObjectURL(url), 0);
    return true;
  } catch {
    return false;
  }
}

export function privacyChecklist(documentRef: Document, runtime: DiagnosticsRuntime): readonly string[] {
  const node = documentRef.createElement('ul');
  const snapshot = runtime.snapshot();
  const checks = [
    ['no-chat-content', 'Sohbet metni tanılama paketine dahil edilmez.'],
    ['no-credentials', 'Kimlik bilgileri ve secret değerleri dahil edilmez.'],
    ['bounded-metrics', `${Math.min(snapshot.metrics.length, MAX_METRICS)} son metrik saklanır.`],
    ['local-only', 'Paket yalnızca kullanıcı başlattığında cihazdan dışa aktarılır.']
  ];
  return Object.freeze(checks.map(([id, label]) => `${id}: ${label}`));
}
