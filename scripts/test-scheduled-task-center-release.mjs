import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assertShippedBrowserModule, assertCacheVersionAtLeast } from './shell-cache-contract.mjs';

const paths = [
  'public/index.html',
  'public/sw-policy.ts',
  'README.md',
  'public/typed/legacy/scheduled-task-preview.ts',
  'public/typed/legacy/scheduled-task-duplicate.ts',
  'public/typed/legacy/scheduled-task-templates.ts',
  'public/typed/legacy/scheduled-task-templates-backup.ts',
  'public/typed/legacy/scheduled-task-draft.ts',
  'public/typed/legacy/scheduled-task-planning.ts',
  'public/typed/legacy/scheduled-task-status-summary.ts',
  'public/typed/legacy/scheduled-task-preview-activity.ts',
  'public/typed/legacy/scheduled-task-insights.ts',
  'public/typed/legacy/scheduled-task-actions.ts',
  'public/typed/legacy/scheduled-task-detail.ts',
  'public/typed/legacy/scheduled-task-export.ts'
];
const files = await Promise.all(paths.map((path) => readFile(new URL('../' + path, import.meta.url), 'utf8')));
const [index, sw, readme, ...modules] = files;

assertShippedBrowserModule('scheduled-task-preview');
assertShippedBrowserModule('scheduled-task-preview');
assertCacheVersionAtLeast(45);
assert.ok(readme.includes('Görevler'));
assert.ok(modules.some((source) => source.includes('requestSubmit')));
assert.ok(modules.some((source) => source.includes('localStorage')));
for (const source of modules) {
  assert.doesNotMatch(source, /NVIDIA_API_KEY/);
  assert.doesNotMatch(source, /Authorization:\s*Bearer/);
}
console.log('scheduled-task-center-release: ok');
