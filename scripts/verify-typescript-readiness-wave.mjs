import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const sources = ['config-readiness', 'deployment-readiness', 'runtime-readiness', 'pwa-readiness', 'release-manifest'];
const tests = ['config-readiness', 'deployment-readiness', 'runtime-readiness', 'pwa-readiness', 'release-manifest', 'system-readiness'];

const read = (path) => readFile(resolve(ROOT, path), 'utf8');
const exists = async (path) => { try { await access(resolve(ROOT, path)); return true; } catch { return false; } };

for (const name of sources) {
  assert.equal(await exists('lib/' + name + '.ts'), true, 'missing typed source: ' + name);
  const bridge = (await read('lib/' + name + '.mjs')).trim();
  assert.equal(bridge, 'export * from \'./' + name + '.ts\';', 'non-typed implementation remains: ' + name);
}

for (const name of tests) {
  assert.equal(await exists('scripts/test-' + name + '.ts'), true, 'missing typed test: ' + name);
  const bridge = (await read('scripts/test-' + name + '.mjs')).trim();
  assert.equal(bridge, 'await import(\'./test-' + name + '.ts\');', 'test bridge mismatch: ' + name);
}

const tsconfig = JSON.parse(await read('tsconfig.json'));
assert.equal(tsconfig.include.includes('scripts/**/*.ts'), true, 'scripts TypeScript files are outside typecheck');
const server = await read('server.ts');
assert.match(server, /buildSystemReadiness/);
assert.match(server, /url\.pathname === '\/api\/health'/);
assert.match(server, /readiness/);
const vite = await read('vite.config.ts');
assert.match(vite, /system-readiness-panel/);
const index = await read('public/index.html');
assert.match(index, /typed-build\/system-readiness-panel\.js/);
const sw = await read('public/sw-policy.ts');
assert.match(sw, /typed-build\/system-readiness-panel\.js/);

function run(file) {
  return new Promise((resolveResult) => {
    const child = spawn(process.execPath, [file], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    child.on('error', (error) => resolveResult({ code: -1, output: output + error.message }));
    child.on('close', (code) => resolveResult({ code, output }));
  });
}

for (const name of tests) {
  const result = await run('scripts/test-' + name + '.mjs');
  assert.equal(result.code, 0, result.output);
}

console.log('TypeScript readiness migration gate: OK');
