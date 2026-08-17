import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const reschedule = require('../public/schedule-reschedule.js');

const sourcePath = fileURLToPath(new URL('../public/schedule-reschedule.js', import.meta.url));
const commandPath = fileURLToPath(new URL('../lib/schedule-command-boundary.mjs', import.meta.url));
const httpPath = fileURLToPath(new URL('../lib/schedule-http-api.mjs', import.meta.url));
const [source, commandSource, httpSource] = await Promise.all([
  readFile(sourcePath, 'utf8'),
  readFile(commandPath, 'utf8'),
  readFile(httpPath, 'utf8')
]);

for (const forbidden of [
  /\blocalStorage\b/,
  /\bsessionStorage\b/,
  /\bindexedDB\b/,
  /document\.cookie/,
  /navigator\.clipboard/,
  /\bWebSocket\b/,
  /\bEventSource\b/,
  /sendBeacon/,
  /\bAuthorization\b/,
  /\bBearer\b/,
  /ownerId/,
  /traceId/,
  /signing.?key/i,
  /password.?hash/i,
  /innerHTML/,
  /outerHTML/,
  /shell\s*=/,
  /child_process/,
  /\bexec\s*\(/,
  /\bspawn\s*\(/
]) {
  assert.equal(forbidden.test(source), false, `forbidden reschedule surface: ${forbidden}`);
}

assert.match(source, /method:\s*'PATCH'/);
assert.match(source, /credentials:\s*'same-origin'/);
assert.match(source, /cache:\s*'no-store'/);
assert.match(source, /JSON\.stringify\(\{ runAt \}\)/);
assert.match(source, /confirmImpl\('Bu görevin çalışma zamanı değiştirilsin mi\?'/);
assert.match(source, /article\.dataset\?\.state !== 'scheduled'/);
assert.match(source, /SCHEDULE_ID_PATTERN = \/\^\[A-Za-z0-9\._:-\]\+\$\//);
assert.match(source, /time <= nowMs/);
assert.match(source, /result\.status === 401/);
assert.match(source, /result\.status === 404/);
assert.match(source, /result\.status === 409/);
assert.match(source, /result\.status === 400/);
assert.match(source, /CustomEvent\(RESCHEDULED_EVENT/);

assert.match(httpSource, /verb === 'PATCH'/);
assert.match(httpSource, /commands\.reschedule\(\{ principal: auth\.principal, scheduleId, input \}\)/);
assert.match(httpSource, /SCHEDULE_NOT_RESCHEDULABLE/);
assert.match(commandSource, /const RESCHEDULE_FIELDS = new Set\(\['runAt', 'retryDelayMs'\]\)/);
assert.match(commandSource, /ownedScheduled\(ownerId, scheduleId, 'SCHEDULE_NOT_RESCHEDULABLE'\)/);
assert.match(commandSource, /current\.ownerId !== ownerId/);
assert.match(commandSource, /current\.status !== 'scheduled'/);
assert.match(commandSource, /store\.reschedule/);

assert.equal(reschedule.normalizeScheduleId('safe.id:1'), 'safe.id:1');
assert.equal(reschedule.normalizeScheduleId('unsafe?query'), null);
assert.equal(reschedule.normalizeScheduleId('%2F'), null);

let networkCalls = 0;
const client = reschedule.createClient({
  fetchImpl: async () => {
    networkCalls += 1;
    return { ok: true, status: 200, async json() { return { ok: true }; } };
  }
});
await client.reschedule('../../etc/passwd', '2032-01-01T00:00:00.000Z');
assert.equal(networkCalls, 0, 'invalid schedule id must fail before network');

console.log('schedule reschedule boundary tests passed');
