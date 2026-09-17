import assert from 'node:assert/strict';
import fs from 'node:fs';

const organizer = fs.readFileSync('public/scheduled-tasks-organizer.js', 'utf8');
const actions = fs.readFileSync('public/scheduled-tasks-actions.js', 'utf8');
const dashboard = fs.readFileSync('public/scheduled-tasks-dashboard.js', 'utf8');

assert.match(organizer, /function boot\(\)/);
assert.match(organizer, /MutationObserver/);
assert.match(organizer, /beforeunload/);
assert.match(organizer, /disconnect/);
assert.match(actions, /function boot\(\)/);
assert.match(actions, /actionsBound/);
assert.match(actions, /beforeunload/);
assert.match(actions, /observer\.disconnect/);
assert.match(dashboard, /function boot\(\)/);
assert.match(dashboard, /dashboardBound/);
assert.match(dashboard, /beforeunload/);
assert.match(dashboard, /observer\.disconnect/);
assert.match(organizer, /panel\.dataset\.organizerBound/);
assert.match(actions, /panel\.dataset\.actionsBound/);
assert.match(dashboard, /panel\.dataset\.dashboardBound/);
console.log('scheduled-task organizer lifecycle: ok');
