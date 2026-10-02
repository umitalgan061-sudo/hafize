import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const index = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const sw = await readFile(new URL('../public/sw-policy.ts', import.meta.url), 'utf8');
const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');

for (const asset of [
  'scheduled-task-preview.js',
  'scheduled-task-preview.css',
  'scheduled-task-duplicate.js',
  'scheduled-task-duplicate.css',
  'scheduled-task-templates.js',
  'scheduled-task-templates.css',
  'scheduled-task-templates-backup.js',
  'scheduled-task-planning.js',
  'scheduled-task-draft.js',
  'scheduled-task-insights.js',
  'scheduled-task-actions.js',
  'scheduled-task-detail.js',
  'scheduled-task-export.js'
]) {
  assert.ok(index.includes(asset), 'index missing: ' + asset);
  assert.ok(sw.includes(asset), 'service worker missing: ' + asset);
}
assert.ok(readme.includes('Zamanlanmış Görev Önizlemesi'));
assert.ok(readme.includes('Tekrar Planlama'));
assert.ok(readme.includes('Görev Şablonları ve Hızlı Planlama'));
assert.ok(readme.includes('Görev Taslakları ve Başlangıç Seti'));
console.log('scheduled-task-center-regression: ok');
