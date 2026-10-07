import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assertShippedBrowserModule, assertShippedStylesheet } from './shell-cache-contract.mjs';

const index = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const sw = await readFile(new URL('../public/sw-policy.ts', import.meta.url), 'utf8');
const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');

assertShippedBrowserModule('scheduled-task-preview');
assertShippedStylesheet('scheduled-task-preview.css');
assertShippedBrowserModule('scheduled-task-duplicate');
assertShippedStylesheet('scheduled-task-duplicate.css');
assertShippedBrowserModule('scheduled-task-templates');
assertShippedStylesheet('scheduled-task-templates.css');
assertShippedBrowserModule('scheduled-task-templates-backup');
assertShippedBrowserModule('scheduled-task-planning');
assertShippedBrowserModule('scheduled-task-draft');
assertShippedBrowserModule('scheduled-task-insights');
assertShippedBrowserModule('scheduled-task-actions');
assertShippedBrowserModule('scheduled-task-detail');
assertShippedBrowserModule('scheduled-task-export');
assert.ok(readme.includes('Zamanlanmış Görev Önizlemesi'));
assert.ok(readme.includes('Tekrar Planlama'));
assert.ok(readme.includes('Görev Şablonları ve Hızlı Planlama'));
assert.ok(readme.includes('Görev Taslakları ve Başlangıç Seti'));
console.log('scheduled-task-center-regression: ok');
