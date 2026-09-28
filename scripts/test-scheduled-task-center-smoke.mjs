import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const paths = [
  'public/index.html',
  'public/sw-policy.js',
  'public/scheduled-task-preview.js',
  'public/scheduled-task-duplicate.js',
  'public/scheduled-task-templates.js',
  'public/scheduled-task-templates-backup.js',
  'public/scheduled-task-template-presets.js',
  'public/scheduled-task-draft.js',
  'public/scheduled-task-planning.js',
  'public/scheduled-task-status-summary.js',
  'public/scheduled-task-preview-activity.js',
  'public/scheduled-task-insights.js',
  'public/scheduled-task-actions.js',
  'public/scheduled-task-detail.js',
  'public/scheduled-task-export.js'
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
assert.ok(index.includes('scheduled-task-preview.js'));
assert.ok(index.includes('scheduled-task-detail.js'));
assert.ok(sw.includes('scheduled-task-preview.js'));
assert.ok(sw.includes('scheduled-task-detail.js'));

console.log('scheduled-task-center-smoke: ok');
