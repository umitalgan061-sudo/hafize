import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const js = await readFile(new URL('../public/scheduled-task-preview-activity.js', import.meta.url), 'utf8');

assert.match(js, /hafize:scheduled-preview-activity/);
assert.match(js, /MAX_EVENTS = 8/);
assert.match(js, /events = \[\{ label/);
assert.match(js, /beforeunload/);
assert.match(js, /events = \[\]/);
assert.doesNotMatch(js, /localStorage/);
assert.doesNotMatch(js, /sessionStorage/);
console.log('scheduled-task-preview-activity: ok');
