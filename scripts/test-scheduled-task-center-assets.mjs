import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const index = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const sw = await readFile(new URL('../public/sw-policy.js', import.meta.url), 'utf8');

const assets = [
  'scheduled-task-preview.css',
  'scheduled-task-preview.js',
  'scheduled-task-duplicate.css',
  'scheduled-task-duplicate.js',
  'scheduled-task-templates.css',
  'scheduled-task-templates.js',
  'scheduled-task-templates-backup.css',
  'scheduled-task-templates-backup.js',
  'scheduled-task-template-presets.css',
  'scheduled-task-template-presets.js',
  'scheduled-task-draft.css',
  'scheduled-task-draft.js',
  'scheduled-task-planning.css',
  'scheduled-task-planning.js',
  'scheduled-task-insights.css',
  'scheduled-task-insights.js',
  'scheduled-task-actions.css',
  'scheduled-task-actions.js',
  'scheduled-task-detail.css',
  'scheduled-task-detail.js',
  'scheduled-task-export.js',
  'scheduled-task-status-summary.css',
  'scheduled-task-status-summary.js',
  'scheduled-task-preview-activity.css',
  'scheduled-task-preview-activity.js'
];

for (const asset of assets) {
  assert.ok(index.includes(asset), 'index asset missing: ' + asset);
  assert.ok(sw.includes(asset), 'service worker asset missing: ' + asset);
}
assert.ok(sw.includes('CURRENT_CACHE'));
console.log('scheduled-task-center-assets: ok');
