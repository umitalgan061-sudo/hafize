import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const index = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const sw = await readFile(new URL('../public/sw-policy.ts', import.meta.url), 'utf8');
const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');

for (const asset of [
  'typed-build/legacy-app.js',
  'scheduled-task-preview.css',
  'typed-build/legacy-app.js',
  'scheduled-task-duplicate.css',
  'typed-build/legacy-app.js',
  'scheduled-task-templates.css',
  'typed-build/legacy-app.js',
  'typed-build/legacy-app.js',
  'typed-build/legacy-app.js',
  'typed-build/legacy-app.js',
  'typed-build/legacy-app.js',
  'typed-build/legacy-app.js',
  'typed-build/legacy-app.js'
]) {
  assert.ok(index.includes(asset), 'index missing: ' + asset);
  assert.ok(sw.includes(asset), 'service worker missing: ' + asset);
}
assert.ok(readme.includes('Zamanlanmış Görev Önizlemesi'));
assert.ok(readme.includes('Tekrar Planlama'));
assert.ok(readme.includes('Görev Şablonları ve Hızlı Planlama'));
assert.ok(readme.includes('Görev Taslakları ve Başlangıç Seti'));
console.log('scheduled-task-center-regression: ok');
