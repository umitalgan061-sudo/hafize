import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(new URL('../', import.meta.url).pathname);
const read = (path) => readFile(resolve(root, path), 'utf8');
const exists = async (path) => { try { await access(resolve(root, path)); return true; } catch { return false; } };

const modules = [
  'prompt-library-smart-insert',
  'prompt-library-smart-insert-center',
  'prompt-library-smart-insert-history',
  'prompt-library-smart-insert-history-bridge',
  'prompt-library-smart-insert-presets',
  'prompt-library-smart-insert-suggestions',
  'prompt-library-smart-insert-validation',
  'prompt-library-smart-insert-activity',
  'prompt-library-smart-insert-shortcuts'
];

const html = await read('public/index.html');
const legacyApp = await read('public/typed/legacy-app.ts');
const vite = await read('vite.config.ts');
const sw = await read('public/sw-policy.ts');

for (const name of modules) {
  assert(await exists('public/typed/legacy/' + name + '.ts'), 'missing typed Smart Insert module: ' + name);
  assert.equal(await exists('public/' + name + '.js'), false, 'legacy Smart Insert JS remains: ' + name);
  assert(legacyApp.includes('./legacy/' + name + '.ts'), 'legacy app wiring missing: ' + name);
  const source = await read('public/typed/legacy/' + name + '.ts');
  assert.match(source, /import type \{ HafizeLegacyRoot \}/);
  assert.match(source, /@ts-nocheck/);
  assert.doesNotMatch(source, /fetch\s*\(/);
  assert.doesNotMatch(source, /XMLHttpRequest/);
  assert.doesNotMatch(source, /WebSocket/);
}

assert(await exists('public/typed/legacy/prompt-library-smart-insert-contract.ts'), 'typed Smart Insert contract missing');
assert(legacyApp.includes('HAFIZE_LEGACY_BROWSER_MODULE_COUNT = 52'), 'legacy module count');
assert(html.includes('/typed-build/legacy-app.js'), 'legacy bundle entry');
assert(!html.includes('prompt-library-smart-insert.js'), 'raw smart insert script remains');
assert(vite.includes('legacy-app'), 'legacy app Vite entry');
assert(sw.includes('/typed-build/legacy-app.js'), 'legacy bundle not cached');
assert(sw.includes('hafize-shell-v55'), 'PWA cache version');

console.log('TypeScript Smart Insert migration gate: OK');
