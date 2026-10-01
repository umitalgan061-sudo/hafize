import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assertCacheVersionAtLeast } from './shell-cache-contract.mjs';

const paths = [
  'public/index.html',
  'public/sw-policy.js',
  'README.md',
  'public/scheduled-task-preview.js',
  'public/scheduled-task-duplicate.js',
  'public/scheduled-task-templates.js',
  'public/scheduled-task-templates-backup.js',
  'public/scheduled-task-draft.js',
  'public/scheduled-task-planning.js',
  'public/scheduled-task-status-summary.js',
  'public/scheduled-task-preview-activity.js',
  'public/scheduled-task-insights.js',
  'public/scheduled-task-actions.js',
  'public/scheduled-task-detail.js',
  'public/scheduled-task-export.js'
];
const files = await Promise.all(paths.map((path) => readFile(new URL('../' + path, import.meta.url), 'utf8')));
const [index, sw, readme, ...modules] = files;

assert.ok(index.includes('scheduled-task-preview.js'));
assert.ok(sw.includes('scheduled-task-preview.js'));
assertCacheVersionAtLeast(45, 'scheduled task center');
assert.ok(readme.includes('Görevler'));
assert.ok(modules.some((source) => source.includes('requestSubmit')));
assert.ok(modules.some((source) => source.includes('localStorage')));
for (const source of modules) {
  assert.doesNotMatch(source, /NVIDIA_API_KEY/);
  assert.doesNotMatch(source, /Authorization:\s*Bearer/);
}
console.log('scheduled-task-center-release: ok');
