import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const index = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const sw = await readFile(new URL('../public/sw-policy.ts', import.meta.url), 'utf8');
for (const asset of ['scheduled-task-preview.css', 'typed-build/legacy-app.js', 'scheduled-task-duplicate.css', 'typed-build/legacy-app.js', 'scheduled-task-templates.css', 'typed-build/legacy-app.js', 'scheduled-task-planning.css', 'typed-build/legacy-app.js']) {
  assert.ok(index.includes(asset), 'index asset missing: ' + asset);
  assert.ok(sw.includes(asset), 'service worker asset missing: ' + asset);
}
assert.match(sw, /v43|v44/);
console.log('scheduled-task-preview-assets: ok');
