import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(new URL('../', import.meta.url).pathname);
const read = (path) => readFile(resolve(root, path), 'utf8');
const sw = await read('public/sw-policy.ts');
const html = await read('public/index.html');
const vite = await read('vite.config.ts');
const app = await read('public/typed/legacy-app.ts');
assert.match(sw, /hafize-shell-v55/);
assert(sw.includes('/typed-build/legacy-app.js'));
assert(html.includes('/typed-build/legacy-app.js'));
assert(vite.includes('legacy-app'));
for (const name of ['prompt-library-smart-insert','prompt-library-smart-insert-center','prompt-library-smart-insert-history','prompt-library-smart-insert-presets','prompt-library-smart-insert-suggestions','prompt-library-smart-insert-validation','prompt-library-smart-insert-activity','prompt-library-smart-insert-shortcuts']) {
  assert(app.includes('./legacy/' + name + '.ts'), 'missing app import: ' + name);
  assert(!html.includes('/' + name + '.js'), 'raw HTML script remains: ' + name);
}
assert(!sw.includes('/public/prompt-library-smart-insert-'));
console.log('Smart Insert PWA release contract: OK');
