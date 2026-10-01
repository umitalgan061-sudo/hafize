import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assertCacheVersionAtLeast } from './shell-cache-contract.mjs';

const index = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const sw = await readFile(new URL('../public/sw-policy.js', import.meta.url), 'utf8');
for (const asset of ['scheduled-task-preview.css', 'scheduled-task-preview.js', 'scheduled-task-duplicate.css', 'scheduled-task-duplicate.js', 'scheduled-task-templates.css', 'scheduled-task-templates.js', 'scheduled-task-planning.css', 'scheduled-task-planning.js']) {
  assert.ok(index.includes(asset), 'index asset missing: ' + asset);
  assert.ok(sw.includes(asset), 'service worker asset missing: ' + asset);
}
assertCacheVersionAtLeast(43, 'scheduled task preview');
console.log('scheduled-task-preview-assets: ok');
