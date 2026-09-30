import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assertBoundDeclared } from './source-contract.mjs';

const detail = await readFile(new URL('../public/scheduled-task-detail.js', import.meta.url), 'utf8');
const exportJs = await readFile(new URL('../public/scheduled-task-export.js', import.meta.url), 'utf8');
const index = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const sw = await readFile(new URL('../public/sw-policy.js', import.meta.url), 'utf8');

assert.match(detail, /data-scheduled-detail/);
assert.match(detail, /scheduledTaskDetailDialog/);
assert.match(exportJs, /Görünenleri dışa aktar/);
assertBoundDeclared(exportJs, 'MAX_EXPORT', 250000);
for (const asset of ['scheduled-task-detail.js', 'scheduled-task-detail.css', 'scheduled-task-export.js']) {
  assert.ok(index.includes(asset), 'index missing: ' + asset);
  assert.ok(sw.includes(asset), 'sw missing: ' + asset);
}
console.log('scheduled-task-detail-export-integration: ok');
