import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assertLegacyModulesBundled } from './legacy-bundle-contract.mjs';

const paths = [
  'public/typed/legacy/scheduled-task-preview.ts',
  'public/scheduled-task-preview.css',
  'public/typed/legacy/scheduled-task-duplicate.ts',
  'public/scheduled-task-duplicate.css',
  'public/typed/scheduled-tasks.ts',
  'public/index.html',
  'public/sw-policy.ts',
  'README.md'
];
const values = await Promise.all(paths.map((path) => readFile(new URL('../' + path, import.meta.url), 'utf8')));
const [preview, previewCss, duplicate, duplicateCss, typed, index, sw, readme] = values;

assert.ok(preview.includes('requestSubmit'));
assert.ok(preview.includes('stopImmediatePropagation'));
assert.ok(preview.includes('payloadFor'));
assert.ok(preview.includes('countdownText'));
assert.ok(previewCss.includes('scheduled-task-preview-shell'));
assert.ok(duplicate.includes('ScheduledTaskDuplicate'));
assert.ok(duplicateCss.includes('scheduled-task-duplicate-button'));
assert.ok(typed.includes('dataset.agentId'));
assert.ok(readme.includes('## Zamanlanmış Görev Önizlemesi'));
assert.ok(readme.includes('## Tekrar Planlama'));
assertLegacyModulesBundled(['scheduled-task-duplicate', 'scheduled-task-preview']);
console.log('scheduled-task-preview-regression: ok');
