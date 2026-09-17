import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(file, 'utf8');
const organizer = read('public/scheduled-tasks-organizer.js');
const actions = read('public/scheduled-tasks-actions.js');
const dashboard = read('public/scheduled-tasks-dashboard.js');
const index = read('public/index.html');
const sw = read('public/sw-policy.js');
const css = read('public/scheduled-tasks-dashboard.css');
const readme = read('README.md');

assert.match(index, /scheduled-tasks-organizer\.css/);
assert.match(index, /scheduled-tasks-actions\.css/);
assert.match(index, /scheduled-tasks-dashboard\.css/);
assert.match(index, /scheduled-tasks-organizer\.js/);
assert.match(index, /scheduled-tasks-actions\.js/);
assert.match(index, /scheduled-tasks-dashboard\.js/);

for (const asset of ['scheduled-tasks-organizer.css','scheduled-tasks-actions.css','scheduled-tasks-dashboard.css','scheduled-tasks-organizer.js','scheduled-tasks-actions.js','scheduled-tasks-dashboard.js']) {
  assert.match(sw, new RegExp(`/${asset.replace('.', '\\.')}`));
}
assert.match(sw, /CURRENT_CACHE = `\$\{CACHE_PREFIX\}v38`/);
assert.match(sw, /startsWith\('\/api\/'\)/);

assert.match(organizer, /hafize\.scheduled-tasks\.view\.v1/);
assert.match(organizer, /function readView/);
assert.match(organizer, /function saveView/);
assert.match(organizer, /function duplicate/);
assert.match(organizer, /root\.confirm/);
assert.match(actions, /MAX_SELECTED = 40/);
assert.match(actions, /MAX_EXPORT = 1_000_000/);
assert.match(actions, /Görünürleri dışa aktar/);
assert.match(actions, /method: 'DELETE'/);
assert.match(dashboard, /MAX_VIEWS = 6/);
assert.match(dashboard, /hafize\.scheduled-tasks\.views\.v1/);
assert.match(dashboard, /function timeMatches/);
assert.match(dashboard, /scheduled-task-detail/);
assert.match(css, /data-dashboard-time-match="false"/);

for (const source of [organizer, actions, dashboard]) {
  assert.doesNotMatch(source, /innerHTML\s*=/);
  assert.doesNotMatch(source, /document\.write/);
  assert.doesNotMatch(source, /fetch\(['"]https?:/i);
  assert.match(source, /textContent/);
}

assert.match(readme, /Görev düzenleyicisi/);
assert.match(readme, /scheduled-tasks-organizer\.mjs/);
console.log('scheduled-task organizer regression gate: ok');
