import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('public/scheduled-tasks-actions.js', 'utf8');

assert.match(source, /MAX_SELECTED = 40/);
assert.match(source, /MAX_EXPORT = 1_000_000/);
assert.match(source, /data-task-action-select/);
assert.match(source, /data-task-action-select-visible/);
assert.match(source, /data-task-action-clear/);
assert.match(source, /data-task-action-cancel/);
assert.match(source, /data-task-action-export/);
assert.match(source, /Görünürleri dışa aktar/);
assert.match(source, /Planlananları seç/);
assert.match(source, /Seçilenleri iptal et/);
assert.match(source, /method: 'DELETE'/);
assert.match(source, /encodeURIComponent/);
assert.match(source, /root\.confirm/);
assert.match(source, /navigator\?\.clipboard/);
assert.match(source, /Blob/);
assert.match(source, /application\/json/);
assert.match(source, /scheduled-task-row-head strong/);
assert.match(source, /dataset\.scheduleId/);
assert.match(source, /dataset\.status/);
assert.match(source, /dashboardTimeMatch/);
console.log('scheduled-task organizer actions: ok');
