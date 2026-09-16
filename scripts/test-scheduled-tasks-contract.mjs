import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const api = await readFile(new URL('../lib/schedule-http-api.mjs', import.meta.url), 'utf8');
const boundary = await readFile(new URL('../lib/schedule-command-boundary.mjs', import.meta.url), 'utf8');
const store = await readFile(new URL('../lib/task-schedule-store.mjs', import.meta.url), 'utf8');

assert.match(api, /\/api\/schedules/);
// The handler upper-cases the verb once and then dispatches on it.
assert.match(api, /method\.toUpperCase\(\)/);
assert.match(api, /verb === 'GET'/);
assert.match(api, /verb === 'POST'/);
assert.match(api, /verb === 'DELETE'/);
assert.match(api, /Allow: root \? 'GET, POST' : 'DELETE'/);
assert.match(api, /WWW-Authenticate/);
assert.match(boundary, /ownerId/);
assert.match(boundary, /INVALID_AGENT/);
assert.match(boundary, /containsPlaintextCredential/);
assert.match(boundary, /SCHEDULE_CAPACITY_REACHED/);
assert.match(boundary, /current\.ownerId !== ownerId/);
assert.match(store, /MAX_ATTEMPTS = 5/);
assert.match(store, /status: 'scheduled'/);
assert.match(store, /status = 'running'/);
assert.match(store, /status = 'completed'/);
assert.match(store, /status = 'failed'/);
assert.match(store, /status = 'cancelled'/);
assert.match(store, /toIso\(runAt/);

console.log('scheduled task API contract: ok');
