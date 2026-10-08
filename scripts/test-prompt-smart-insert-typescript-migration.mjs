import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { assertVersionedCacheDeclaration } from './shell-cache-contract.mjs';

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
  assert.ok(legacyApp.includes('./legacy/' + name + '.ts'), 'legacy app wiring missing: ' + name);
  const source = await read('public/typed/legacy/' + name + '.ts');
  assert.ok(source.includes('import type { HafizeLegacyRoot }'), 'typed legacy root import missing: ' + name);
  assert.match(source, /@ts-nocheck/);
  assert.doesNotMatch(source, /fetch\s*\(/);
  assert.doesNotMatch(source, /XMLHttpRequest/);
  assert.doesNotMatch(source, /WebSocket/);
}

assert(await exists('public/typed/legacy/prompt-library-smart-insert-contract.ts'), 'typed Smart Insert contract missing');
assert.match(legacyApp, /HAFIZE_LEGACY_BROWSER_MODULE_COUNT = 52/);
assert.ok(html.includes('typed-build/legacy-app.js'));
assert.doesNotMatch(html, /prompt-library-smart-insert-[a-z-]+\.js/);
assert.match(vite, /legacy-app/);
assert.ok(sw.includes('typed-build/legacy-app.js'));
assertVersionedCacheDeclaration(sw);

console.log('TypeScript Smart Insert migration gate: OK');
