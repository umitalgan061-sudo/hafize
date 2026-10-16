import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assertShippedBrowserModule } from './shell-cache-contract.mjs';

const paths = [
  'public/index.html',
  'public/sw-policy.ts',
  'public/typed/legacy/scheduled-task-preview.ts',
  'public/typed/legacy/scheduled-task-duplicate.ts',
  'public/typed/legacy/scheduled-task-templates.ts',
  'public/typed/legacy/scheduled-task-templates-backup.ts',
  'public/typed/legacy/scheduled-task-template-presets.ts',
  'public/typed/legacy/scheduled-task-draft.ts',
  'public/typed/legacy/scheduled-task-planning.ts',
  'public/typed/legacy/scheduled-task-status-summary.ts',
  'public/typed/legacy/scheduled-task-preview-activity.ts',
  'public/typed/legacy/scheduled-task-insights.ts',
  'public/typed/legacy/scheduled-task-actions.ts',
  'public/typed/legacy/scheduled-task-detail.ts',
  'public/typed/legacy/scheduled-task-export.ts'
];

const values = await Promise.all(paths.map((path) => readFile(new URL('../' + path, import.meta.url), 'utf8')));
const source = values.join('\n');

for (const token of ['scheduled-task-preview', 'scheduled-task-duplicate', 'scheduled-task-templates', 'scheduled-task-draft', 'scheduled-task-planning', 'scheduled-task-insights', 'scheduled-task-detail', 'scheduled-task-export']) {
  assert.ok(source.includes(token), 'missing schedule center token: ' + token);
}
assert.match(source, /requestSubmit/);
assert.match(source, /MutationObserver/);
assert.match(source, /localStorage/);
assert.doesNotMatch(source, /NVIDIA_API_KEY/);
assert.doesNotMatch(source, /Bearer /);
assert.doesNotMatch(source, /password/i);

const index = values[0];
const sw = values[1];
assertShippedBrowserModule('scheduled-task-preview');
assertShippedBrowserModule('scheduled-task-detail');
assertShippedBrowserModule('scheduled-task-preview');
assertShippedBrowserModule('scheduled-task-detail');

console.log('scheduled-task-center-smoke: ok');
