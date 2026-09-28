import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const js = await readFile(new URL('../public/scheduled-task-detail.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../public/scheduled-task-detail.css', import.meta.url), 'utf8');

for (const token of ['Görev ayrıntıları', 'aria-modal', 'aria-labelledby', 'scheduledTaskDetailDialog', 'data-scheduled-detail', 'previousFocus']) {
  assert.ok(js.includes(token), 'missing detail token: ' + token);
}
assert.doesNotMatch(js, /root\.fetch/);
assert.doesNotMatch(js, /Authorization/);
assert.match(css, /scheduled-task-detail-overlay/);
assert.match(css, /focus-visible/);
console.log('scheduled-task-detail: ok');
