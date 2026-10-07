import { readFile, access } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const read = (path) => readFile(join(root, path), 'utf8');
const exists = async (path) => { try { await access(join(root, path)); return true; } catch { return false; } };
const assert = (value, message) => { if (!value) throw new Error('NEXTGEN_RELEASE_FAILED:' + message); };

const files = {
  package: JSON.parse(await read('package.json')),
  server: await read('server.ts'),
  http: await read('lib/http-runtime.ts'),
  metrics: await read('lib/runtime-metrics.ts'),
  metricsTest: await read('lib/runtime-metrics.test.ts'),
  vite: await read('vite.config.ts'),
  index: await read('public/index.html'),
  app: await read('public/typed/app-shell.ts'),
  legacyApp: await read('public/typed/legacy-app.ts'),
  sw: await read('public/sw.ts'),
  swPolicy: await read('public/sw-policy.ts')
};

assert(files.package.engines?.node === '>=24.21.0', 'node-engine');
assert(files.package.devDependencies?.typescript === '7.0.2', 'typescript-toolchain');
assert(files.package.devDependencies?.vite === '8.3.0', 'vite-toolchain');
assert(files.package.devDependencies?.vitest === '5.0.1', 'vitest-toolchain');
assert(files.package.scripts?.build === 'vite build', 'vite-build-script');
assert(files.package.scripts?.typecheck === 'npm run typecheck:runtime', 'runtime-typecheck-script');
assert(files.package.scripts?.['typecheck:syntax'] === 'tsc --noEmit --noCheck', 'syntax-typecheck-script');
assert(files.package.scripts?.['test:modern:gate'] === 'vitest run lib/runtime-metrics.test.ts lib/upstream-circuit-breaker.test.ts lib/rate-limit.test.ts', 'modern-vitest-gate');
assert(files.package.scripts?.['test:modernization'] === 'node scripts/test-runtime-modernization.ts', 'modernization-contract-script');
assert(files.package.scripts?.['check:modern']?.includes('test-nextgen-release.mjs'), 'nextgen-release-gate');

assert(files.server.includes("url.pathname === '/api/health/live'"), 'liveness-endpoint');
assert(files.server.includes("url.pathname === '/api/health/ready'"), 'readiness-endpoint');
assert(files.server.includes("url.pathname === '/api/metrics'"), 'metrics-endpoint');
assert(files.server.includes('X-Hafize-Request-Id'), 'request-id');
assert(files.server.includes('timingSafeEqual'), 'timing-safe-metrics-token');
assert(files.server.includes('If-None-Match'.toLowerCase()), 'etag');
assert(files.server.includes('max-age=31536000, immutable'), 'immutable-cache');
assert(files.server.includes('createUpstreamCircuitBreaker'), 'upstream-circuit-breaker');
assert(files.server.includes('createRateLimiter'), 'request-rate-limiter');
assert(files.server.includes('attachDisconnectAbort'), 'disconnect-cancellation');
assert(files.http.includes('Content-Security-Policy'), 'csp');
assert(files.http.includes('Cross-Origin-Opener-Policy'), 'coop');
assert(files.http.includes('Cross-Origin-Resource-Policy'), 'corp');
assert(files.metrics.includes('MAX_ROUTES = 96'), 'bounded-routes');
assert(files.metrics.includes('histogram'), 'latency-histograms');
assert(files.metricsTest.includes('records aborts and upstream failures'), 'metrics-regression-test');

assert(files.vite.includes("'legacy-app': resolve(ROOT, 'public/typed/legacy-app.ts')"), 'legacy-app-vite-entry');
assert(files.vite.includes("'sw': resolve(ROOT, 'public/sw.ts')"), 'sw-vite-entry');
assert(files.index.includes('/typed-build/legacy-app.js'), 'legacy-app-html-entry');
assert(files.app.includes("navigator.serviceWorker.register(serviceWorkerUrl, { type: 'module' })"), 'module-service-worker-registration');
assert(files.sw.includes("from './sw-policy.ts'"), 'typed-sw-policy-import');
// The shell cache version is bumped on every shell change, so a literal version
// turns an unrelated change into a failure here. The invariant is what matters.
assert(/CURRENT_CACHE = `\$\{CACHE_PREFIX\}v\d+`/.test(files.swPolicy), 'cache-version');
assert(!await exists('public/sw.js'), 'legacy-sw-removed');
assert(!await exists('public/sw-policy.js'), 'legacy-sw-policy-removed');

assert(files.legacyApp.includes('HAFIZE_LEGACY_BROWSER_MODULE_COUNT = 52'), 'legacy-module-count');
for (const name of ["chat-history-export","chat-drafts","conversation-workspace-keyboard","message-workspace-policy","prompt-library-starters","prompt-library-enhancements","prompt-library-keyboard","prompt-library-usage","prompt-library-collections","prompt-library-collections-enhancements","prompt-library-revisions","prompt-library-revisions-enhancements","prompt-library-safety","prompt-library-import-preview","prompt-library-diagnostics","prompt-library-smart-views","prompt-library-smart-views-history","prompt-library-smart-views-builder","prompt-library-smart-views-safety","connector-hub","composer-history","composer-history-panel","composer-history-backup","composer-history-help","composer-history-settings","scheduled-tasks-enhancements","scheduled-tasks-keyboard","scheduled-task-preview","scheduled-task-duplicate","scheduled-task-templates","scheduled-task-planning","scheduled-task-templates-backup","scheduled-task-status-summary","scheduled-task-preview-activity","scheduled-task-template-presets","scheduled-task-draft","scheduled-task-insights","scheduled-task-actions","scheduled-task-detail","scheduled-task-export","screen-share","settings-workspace","prompt-library-smart-insert","prompt-library-smart-insert-center","prompt-library-smart-insert-history","prompt-library-smart-insert-history-bridge","prompt-library-smart-insert-presets","prompt-library-smart-insert-suggestions","prompt-library-smart-insert-validation","prompt-library-smart-insert-activity","prompt-library-smart-insert-shortcuts","prompt-library-bulk-organizer"]) {
  assert(files.legacyApp.includes("./legacy/" + name + ".ts"), 'legacy-bundle-missing:' + name);
  assert(!await exists('public/' + name + '.js'), 'legacy-browser-js-remains:' + name);
  assert(await exists('public/typed/legacy/' + name + '.ts'), 'legacy-ts-wrapper-missing:' + name);
  assert(files.index.indexOf('<script src="/' + name + '.js" defer></script>') === -1, 'legacy-html-entry-remains:' + name);
}

const securityMarkers = ['NVIDIA_API_KEY=', 'CLIENT_SECRET=', 'PRIVATE_KEY=', '-----BEGIN PRIVATE KEY-----'];
for (const marker of securityMarkers) assert(!files.legacyApp.includes(marker), 'secret-marker-in-legacy-bundle:' + marker);
console.log('Next-gen release contract: PASS');
