import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sw = require('../public/sw-policy.js');
const schedule = require('../public/schedule-list.js');

assert.match(sw.CURRENT_CACHE, /^hafize-shell-v\d+$/);
assert.equal(sw.SHELL_ASSETS.includes('/schedule-list.js'), true);
assert.equal(sw.SHELL_ASSETS.includes('/schedule-list.css'), true);
assert.equal(sw.SHELL_ASSETS.includes('/sw-policy.js'), true);

const origin = 'https://hafize.example';
assert.equal(sw.classifyRequest({
  method: 'GET',
  url: `${origin}${schedule.createListPath()}`,
  mode: 'cors',
  headers: { accept: 'application/json' }
}, origin), 'network-only');
assert.equal(sw.classifyRequest({
  method: 'GET',
  url: `${origin}/schedule-list.js`,
  mode: 'cors',
  headers: { accept: 'text/javascript' }
}, origin), 'shell');
assert.equal(sw.classifyRequest({
  method: 'POST',
  url: `${origin}/api/schedules`,
  mode: 'cors',
  headers: { accept: 'application/json' }
}, origin), 'ignore');
assert.equal(sw.classifyRequest({
  method: 'GET',
  url: 'https://other.example/api/schedules?view=summary',
  mode: 'cors',
  headers: { accept: 'application/json' }
}, origin), 'ignore');

const listUrl = new URL(schedule.createListPath(), origin);
assert.equal(listUrl.searchParams.get('view'), 'summary');
assert.equal(listUrl.searchParams.get('limit'), '100');

console.log('schedule list summary PWA tests passed');
