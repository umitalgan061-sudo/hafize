import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (path: string) => readFile(new URL(path, root), 'utf8');
const assert = (value: unknown, message: string): asserts value => {
  if (!value) throw new Error('RUNTIME_MODERNIZATION_FAILED:' + message);
};
const exists = async (path: string): Promise<boolean> => {
  try { await read(path); return true; } catch { return false; }
};

const [server, http, metrics, pkg] = await Promise.all([
  read('server.ts'),
  read('lib/http-runtime.ts'),
  read('lib/runtime-metrics.ts'),
  read('package.json')
]);
const packageData = JSON.parse(pkg) as { scripts?: Record<string, string> };
assert(server.includes("import { createRuntimeMetrics } from './lib/runtime-metrics.ts';"), 'metrics-import');
assert(server.includes("const METRICS_TOKEN = (process.env.HAFIZE_METRICS_TOKEN || '').trim();"), 'metrics-config');
assert(server.includes("url.pathname === '/api/health/live'"), 'liveness-route');
assert(server.includes("url.pathname === '/api/health/ready'"), 'readiness-route');
assert(server.includes("url.pathname === '/api/metrics'"), 'metrics-route');
assert(server.includes('timingSafeEqual'), 'timing-safe-metrics-token');
assert((await read('public/typed/legacy-app.ts')).includes('HAFIZE_LEGACY_BROWSER_MODULE_COUNT = 42'), 'legacy-browser-bundle');
assert((await read('public/sw.ts')).includes("'./sw-policy.ts'"), 'typescript-service-worker');
assert(!(await exists('public/sw.js')), 'legacy-service-worker-removed');
assert(!(await exists('public/sw-policy.js')), 'legacy-service-worker-policy-removed');
assert((await read('public/index.html')).includes('/typed-build/legacy-app.js'), 'legacy-bundle-entry');
assert((await read('vite.config.ts')).includes("'legacy-app': resolve(ROOT, 'public/typed/legacy-app.ts')"), 'legacy-bundle-vite-entry');
assert((await read('vite.config.ts')).includes("'sw': resolve(ROOT, 'public/sw.ts')"), 'service-worker-vite-entry');
assert(server.includes('X-Hafize-Request-Id'), 'request-id-header');
assert(server.toLowerCase().includes('if-none-match'), 'etag-request-path');
assert(server.includes('max-age=31536000, immutable'), 'immutable-cache');
assert(http.includes('Content-Security-Policy'), 'csp-header');
assert(http.includes('Cross-Origin-Opener-Policy'), 'coop-header');
assert(metrics.includes('MAX_ROUTES = 96'), 'bounded-route-cardinality');
assert(metrics.includes('histogram'), 'latency-histogram');
assert(packageData.scripts?.test-modernization === 'node scripts/test-runtime-modernization.ts', 'package-script');

console.log('Runtime modernization contract: OK');
