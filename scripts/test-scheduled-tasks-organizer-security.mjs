import assert from 'node:assert/strict';
import fs from 'node:fs';

const organizer = fs.readFileSync('public/scheduled-tasks-organizer.js', 'utf8');
const actions = fs.readFileSync('public/scheduled-tasks-actions.js', 'utf8');
const dashboard = fs.readFileSync('public/scheduled-tasks-dashboard.js', 'utf8');

for (const source of [organizer, actions, dashboard]) {
  assert.match(source, /textContent/);
  assert.doesNotMatch(source, /innerHTML\s*=/);
  assert.doesNotMatch(source, /document\.write/);
  assert.doesNotMatch(source, /localStorage\([^)]*token/i);
}
assert.match(organizer, /credentials: 'same-origin'/);
assert.match(actions, /credentials: 'same-origin'/);
assert.match(organizer, /encodeURIComponent/);
assert.match(organizer, /root\.confirm/);
assert.match(actions, /root\.confirm/);
assert.match(actions, /method: 'DELETE'/);
assert.match(actions, /navigator\?\.clipboard/);
assert.match(dashboard, /hafize\.scheduled-tasks\.views\.v1/);
assert.match(dashboard, /MAX_VIEWS = 6/);
assert.doesNotMatch(dashboard, /fetch\(['"]https?:/i);
console.log('scheduled-task organizer security: ok');
