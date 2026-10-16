import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assertShippedBrowserModule, assertShippedStylesheet } from './shell-cache-contract.mjs';

const detail = await readFile(new URL('../public/typed/legacy/scheduled-task-detail.ts', import.meta.url), 'utf8');
const exportJs = await readFile(new URL('../public/typed/legacy/scheduled-task-export.ts', import.meta.url), 'utf8');
const index = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const sw = await readFile(new URL('../public/sw-policy.ts', import.meta.url), 'utf8');

assert.match(detail, /data-scheduled-detail/);
assert.match(detail, /scheduledTaskDetailDialog/);
assert.match(exportJs, /Görünenleri dışa aktar/);
assert.match(exportJs, /MAX_EXPORT = 250000/);
assertShippedBrowserModule('scheduled-task-detail');
assertShippedStylesheet('scheduled-task-detail.css');
assertShippedBrowserModule('scheduled-task-export');
console.log('scheduled-task-detail-export-integration: ok');
