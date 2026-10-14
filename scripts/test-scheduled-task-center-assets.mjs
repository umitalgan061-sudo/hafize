import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const index = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const sw = await readFile(new URL('../public/sw-policy.ts', import.meta.url), 'utf8');

const assets = [
  'scheduled-task-preview.css',
  'typed-build/legacy-app.js',
  'scheduled-task-duplicate.css',
  'typed-build/legacy-app.js',
  'scheduled-task-templates.css',
  'typed-build/legacy-app.js',
  'scheduled-task-templates-backup.css',
  'typed-build/legacy-app.js',
  'scheduled-task-template-presets.css',
  'typed-build/legacy-app.js',
  'scheduled-task-draft.css',
  'typed-build/legacy-app.js',
  'scheduled-task-planning.css',
  'typed-build/legacy-app.js',
  'scheduled-task-insights.css',
  'typed-build/legacy-app.js',
  'scheduled-task-actions.css',
  'typed-build/legacy-app.js',
  'scheduled-task-detail.css',
  'typed-build/legacy-app.js',
  'typed-build/legacy-app.js',
  'scheduled-task-status-summary.css',
  'typed-build/legacy-app.js',
  'scheduled-task-preview-activity.css',
  'typed-build/legacy-app.js'
];

for (const asset of assets) {
  assert.ok(index.includes(asset), 'index asset missing: ' + asset);
  assert.ok(sw.includes(asset), 'service worker asset missing: ' + asset);
}
assert.ok(sw.includes('CURRENT_CACHE'));
console.log('scheduled-task-center-assets: ok');
