import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  boundScheduleListOutput,
  scheduleIdOrder,
  timestampOf
} from '../lib/schedule-list-boundary.mjs';

assert.equal(scheduleIdOrder({ scheduleId: 'schedule_42' }), 42);
assert.equal(scheduleIdOrder({ scheduleId: 'bad' }), 0);
assert.equal(timestampOf({ updatedAt: '2026-08-18T10:00:00Z' }), Date.parse('2026-08-18T10:00:00Z'));
assert.equal(timestampOf({ updatedAt: 'bad', createdAt: '2026-08-18T09:00:00Z' }), Date.parse('2026-08-18T09:00:00Z'));
assert.equal(timestampOf({}), 0);

const errorOutput = Object.freeze({ ok: false, error: 'AUTH_REQUIRED' });
assert.equal(boundScheduleListOutput(errorOutput), errorOutput);

const source = await readFile(new URL('../lib/schedule-list-boundary.mjs', import.meta.url), 'utf8');
for (const forbidden of [
  'fetch(', 'XMLHttpRequest', 'WebSocket', 'child_process', 'exec(', 'spawn(',
  'process.env', 'Authorization', 'cookie', 'localStorage', 'sessionStorage'
]) {
  assert.equal(source.includes(forbidden), false, `forbidden surface: ${forbidden}`);
}

const httpSource = await readFile(new URL('../lib/schedule-http-api.mjs', import.meta.url), 'utf8');
assert(httpSource.includes('authenticateSchedulePrincipal'));
assert(httpSource.includes('boundScheduleListOutput'));
assert(httpSource.indexOf('authenticateSchedulePrincipal') < httpSource.lastIndexOf('commands.list'));

console.log('schedule list security boundary: ok');
