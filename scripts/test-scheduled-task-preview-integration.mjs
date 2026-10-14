import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const index = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const sw = await readFile(new URL('../public/sw-policy.ts', import.meta.url), 'utf8');
const typed = await readFile(new URL('../public/typed/scheduled-tasks.ts', import.meta.url), 'utf8');
const preview = await readFile(new URL('../public/typed/legacy/scheduled-task-preview.ts', import.meta.url), 'utf8');
const duplicate = await readFile(new URL('../public/typed/legacy/scheduled-task-duplicate.ts', import.meta.url), 'utf8');

for (const asset of ['scheduled-task-preview.js', 'scheduled-task-preview.css', 'scheduled-task-duplicate.js', 'scheduled-task-duplicate.css']) {
  assert.ok(index.includes(asset), 'index asset missing: ' + asset);
  assert.ok(sw.includes(asset), 'service worker asset missing: ' + asset);
}
assert.ok(typed.includes('dataset.agentId'));
assert.ok(typed.includes('dataset.maxAttempts'));
assert.ok(preview.includes('ScheduledTaskPreview'));
assert.ok(duplicate.includes('ScheduledTaskDuplicate'));
console.log('scheduled-task-preview-integration: ok');
