import { memoryUsage } from 'node:process';

const MAX_ROUTES = 96;
const BUCKETS = Object.freeze([25, 50, 100, 250, 500, 1000, 2500, 5000]);

interface RouteMetric {
  total: number;
  failures: number;
  active: number;
  durationMs: number;
  maxDurationMs: number;
  buckets: number[];
}

export interface RequestMetricHandle {
  readonly finish: (statusCode: number) => void;
  readonly abort: () => void;
}

export interface RuntimeMetricSnapshot {
  readonly generatedAt: string;
  readonly uptimeSeconds: number;
  readonly requests: Readonly<{
    total: number;
    completed: number;
    aborted: number;
    failures: number;
    active: number;
    byStatus: Readonly<Record<string, number>>;
    byMethod: Readonly<Record<string, number>>;
  }>;
  readonly upstream: Readonly<{
    nvidiaTotal: number;
    nvidiaFailures: number;
    nvidiaActive: number;
  }>;
  readonly routes: readonly Readonly<{
    route: string;
    total: number;
    failures: number;
    active: number;
    averageDurationMs: number;
    maxDurationMs: number;
    histogram: Readonly<Record<string, number>>;
  }>[];
  readonly memory: Readonly<{
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
    arrayBuffers: number;
  }>;
}

function normalizeMethod(value: unknown): string {
  const method = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return method && /^[A-Z]{1,12}$/.test(method) ? method : 'UNKNOWN';
}

function normalizeRoute(value: unknown): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  const pathname = raw.split(/[?#]/, 1)[0] || '/';
  const parts = pathname.split('/').filter(Boolean).map((segment) => {
    if (/^\d+$/.test(segment)) return ':id';
    if (/^[0-9a-f]{8,}$/i.test(segment)) return ':id';
    if (/^[0-9a-f-]{16,}$/i.test(segment) && segment.includes('-')) return ':id';
    return segment.length > 80 ? ':segment' : segment;
  });
  return '/' + parts.join('/');
}

function emptyRoute(): RouteMetric {
  return { total: 0, failures: 0, active: 0, durationMs: 0, maxDurationMs: 0, buckets: BUCKETS.map(() => 0) };
}

function bucketIndex(durationMs: number): number {
  const index = BUCKETS.findIndex((bound) => durationMs <= bound);
  return index >= 0 ? index : BUCKETS.length;
}

export function createRuntimeMetrics(options: { readonly now?: () => number } = {}) {
  const now = options.now ?? (() => Date.now());
  const startedAt = now();
  const routes = new Map<string, RouteMetric>();
  const byStatus: Record<string, number> = {};
  const byMethod: Record<string, number> = {};

  let total = 0;
  let completed = 0;
  let aborted = 0;
  let failures = 0;
  let active = 0;
  let nvidiaTotal = 0;
  let nvidiaFailures = 0;
  let nvidiaActive = 0;

  const startRequest = (method: unknown, route: unknown): RequestMetricHandle => {
    const normalizedMethod = normalizeMethod(method);
    const normalizedRoute = normalizeRoute(route);
    const started = now();

    total += 1;
    active += 1;
    byMethod[normalizedMethod] = (byMethod[normalizedMethod] ?? 0) + 1;

    let metric = routes.get(normalizedRoute);
    if (!metric) {
      if (routes.size >= MAX_ROUTES) {
        const oldest = routes.keys().next().value;
        if (oldest) routes.delete(oldest);
      }
      metric = emptyRoute();
      routes.set(normalizedRoute, metric);
    }
    metric.total += 1;
    metric.active += 1;

    let settled = false;
    const settle = (durationMs: number, statusCode: number | null, wasAbort: boolean): void => {
      if (settled) return;
      settled = true;
      active = Math.max(0, active - 1);
      metric!.active = Math.max(0, metric!.active - 1);
      if (wasAbort) {
        aborted += 1;
        return;
      }
      completed += 1;
      const normalizedStatus = typeof statusCode === 'number' && Number.isInteger(statusCode) ? statusCode : null;
      const status = normalizedStatus !== null && normalizedStatus > 0 ? String(normalizedStatus) : 'unknown';
      byStatus[status] = (byStatus[status] ?? 0) + 1;
      const failed = normalizedStatus !== null && normalizedStatus >= 500;
      if (failed) {
        failures += 1;
        metric!.failures += 1;
      }
      metric!.durationMs += Math.max(0, durationMs);
      metric!.maxDurationMs = Math.max(metric!.maxDurationMs, durationMs);
      metric!.buckets[bucketIndex(durationMs)] += 1;
    };

    return Object.freeze({
      finish: (statusCode: number) => settle(Math.max(0, now() - started), statusCode, false),
      abort: () => settle(Math.max(0, now() - started), null, true)
    });
  };

  const startNvidia = (): ((failed?: boolean) => void) => {
    nvidiaTotal += 1;
    nvidiaActive += 1;
    let finished = false;
    return (failed = false): void => {
      if (finished) return;
      finished = true;
      nvidiaActive = Math.max(0, nvidiaActive - 1);
      if (failed) nvidiaFailures += 1;
    };
  };

  const snapshot = (): RuntimeMetricSnapshot => {
    const routeSnapshots = [...routes.entries()]
      .sort((a, b) => b[1].total - a[1].total)
      .map(([route, metric]) => Object.freeze({
        route,
        total: metric.total,
        failures: metric.failures,
        active: metric.active,
        averageDurationMs: metric.total ? Number((metric.durationMs / Math.max(metric.total - metric.active, 1)).toFixed(1)) : 0,
        maxDurationMs: Number(metric.maxDurationMs.toFixed(1)),
        histogram: Object.freeze({
          '<=25ms': metric.buckets[0],
          '<=50ms': metric.buckets[1],
          '<=100ms': metric.buckets[2],
          '<=250ms': metric.buckets[3],
          '<=500ms': metric.buckets[4],
          '<=1s': metric.buckets[5],
          '<=2.5s': metric.buckets[6],
          '<=5s': metric.buckets[7],
          '>5s': metric.buckets[8]
        })
      }));

    const memory = memoryUsage();
    return Object.freeze({
      generatedAt: new Date(now()).toISOString(),
      uptimeSeconds: Number(((now() - startedAt) / 1000).toFixed(3)),
      requests: Object.freeze({
        total,
        completed,
        aborted,
        failures,
        active,
        byStatus: Object.freeze({ ...byStatus }),
        byMethod: Object.freeze({ ...byMethod })
      }),
      upstream: Object.freeze({ nvidiaTotal, nvidiaFailures, nvidiaActive }),
      routes: Object.freeze(routeSnapshots),
      memory: Object.freeze({
        rss: memory.rss,
        heapTotal: memory.heapTotal,
        heapUsed: memory.heapUsed,
        external: memory.external,
        arrayBuffers: memory.arrayBuffers
      })
    });
  };

  return Object.freeze({ startRequest, startNvidia, snapshot });
}

export const RUNTIME_METRICS_LIMITS = Object.freeze({
  maxRoutes: MAX_ROUTES,
  histogramBoundsMs: BUCKETS
});
