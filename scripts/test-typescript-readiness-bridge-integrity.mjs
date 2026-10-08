import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertLegacyBridge, bridgeStatements } from './legacy-bridge-contract.mjs';

const ROOT = resolve(fileURLToPath(new URL(import.meta.url)), '..', '..');
const runtimeNames = [
  'config-readiness', 'deployment-readiness', 'runtime-readiness', 'pwa-readiness',
  'release-manifest', 'schedule-lease-runtime-config', 'encrypted-schedule-config',
  'schedule-execution-lease'
];
const read = (path) => readFile(resolve(ROOT, path), 'utf8');
const exists = async (path) => { try { await access(resolve(ROOT, path)); return true; } catch { return false; } };

for (const name of runtimeNames) {
  assert.equal(await exists('lib/' + name + '.ts'), true, 'missing TS source: ' + name);
  assertLegacyBridge('lib/' + name + '.mjs', name);
}

const testNames = [
  'config-readiness', 'deployment-readiness', 'runtime-readiness',
  'pwa-readiness', 'release-manifest', 'schedule-lease-runtime-config',
  'encrypted-schedule-config', 'schedule-execution-lease'
];
for (const name of testNames) {
  assert.equal(await exists('scripts/test-' + name + '.ts'), true, 'missing TS test: ' + name);
  const bridge = bridgeStatements(await read('scripts/test-' + name + '.mjs'));
  assert.deepEqual(bridge, [`await import('./test-${name}.ts');`], 'test bridge mismatch: ' + name);
}

const tsconfig = JSON.parse(await read('tsconfig.json'));
assert.equal(tsconfig.compilerOptions?.strict, true);
assert.equal(tsconfig.include?.includes('scripts/**/*.ts'), true);

const packageData = JSON.parse(await read('package.json'));
assert.match(String(packageData.scripts?.['check:modern'] || ''), /verify-typescript-readiness-wave\.mjs/);

const schedule = await read('lib/schedule-lease-runtime-config.ts');
assert.match(schedule, /schedule-execution-lease\.ts/);
assert.doesNotMatch(schedule, /schedule-execution-lease\.mjs/);

const health = await read('server.ts');
assert.match(health, /buildSystemReadiness/);
assert.doesNotMatch(health, /config-readiness\.mjs/);
assert.doesNotMatch(health, /runtime-readiness\.mjs/);
assert.doesNotMatch(health, /deployment-readiness\.mjs/);
assert.doesNotMatch(health, /release-manifest\.mjs/);

const panel = await read('public/system-readiness-panel.ts');
assert.match(panel, /navigator\.clipboard\.writeText/);
assert.match(panel, /slice\(0, 4000\)/);
assert.doesNotMatch(panel, /localStorage|sessionStorage/);
assert.doesNotMatch(panel, /Authorization\s*:/);
assert.doesNotMatch(panel, /HAFIZE_AUTH_TOKEN/);

console.log('TypeScript readiness bridge integrity gate passed');
