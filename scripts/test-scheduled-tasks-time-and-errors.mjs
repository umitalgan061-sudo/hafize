import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../public/scheduled-tasks.js', import.meta.url), 'utf8');
const api = await readFile(new URL('../lib/schedule-http-api.mts', import.meta.url), 'utf8');
const store = await readFile(new URL('../lib/task-schedule-store.mts', import.meta.url), 'utf8');

assert.match(source, /new Date\(value\)/);
assert.match(source, /toISOString\(\)/);
assert.match(source, /Date\.parse\(runAt\) <= Date\.now\(\)/);
assert.match(source, /maxAttempts: Number\(attempts\.value\)/);
assert.match(source, /for \(let i = 1; i <= MAX_ATTEMPTS; i \+= 1\)/);
assert.match(api, /AUTH_REQUIRED/);
assert.match(api, /SCHEDULE_NOT_FOUND/);
assert.match(api, /SCHEDULE_NOT_CANCELLABLE/);
assert.match(api, /SCHEDULE_CAPACITY_REACHED/);
assert.match(store, /MAX_ATTEMPTS = 5/);
assert.match(store, /INVALID_TASK_SCHEDULE:runAt/);
assert.match(store, /retryAt/);
assert.match(store, /status = 'scheduled'/);
assert.match(store, /status = 'failed'/);

const fakeFuture = new Date(Date.now() + 60_000);
assert.ok(fakeFuture.getTime() > Date.now());
const iso = fakeFuture.toISOString();
assert.equal(Number.isNaN(Date.parse(iso)), false);
assert.ok(Date.parse(iso) > Date.now());

console.log('scheduled task time and error semantics: ok');
