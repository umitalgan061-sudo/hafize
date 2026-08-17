import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const sourcePath = fileURLToPath(new URL('../public/schedule-cancel.js', import.meta.url));
const boundaryPath = fileURLToPath(new URL('../lib/schedule-command-boundary.mjs', import.meta.url));
const apiPath = fileURLToPath(new URL('../lib/schedule-http-api.mjs', import.meta.url));
const docPath = fileURLToPath(new URL('../docs/SCHEDULE_CANCEL_UI_CONTRACT.md', import.meta.url));
const [source, boundary, api, doc] = await Promise.all([
  readFile(sourcePath, 'utf8'),
  readFile(boundaryPath, 'utf8'),
  readFile(apiPath, 'utf8'),
  readFile(docPath, 'utf8')
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
  /innerHTML/,
  /Authorization['"\s:]/,
  /Bearer\s+\$\{/,
  /ownerId\s*:/,
  /traceId\s*:/,
  /child_process/,
  /\bexec\s*\(/,
  /\bspawn\s*\(/,
  /shell\s*:\s*true/
]) {
  assert.equal(forbidden.test(source), false, `schedule cancel must not expose forbidden surface: ${forbidden}`);
}

assert.match(source, /confirmImpl\('Bu zamanlanmış görev iptal edilsin mi\?/);
assert.match(source, /if \(!confirmed\) return false/);
assert.match(source, /article\.dataset\?\.state !== 'scheduled'/);
assert.match(source, /method: 'DELETE'/);
assert.match(source, /credentials: 'same-origin'/);
assert.match(source, /cache: 'no-store'/);
assert.match(source, /busyIds\.has\(id\)/);
assert.match(source, /result\.status === 401/);
assert.match(source, /result\.status === 404/);
assert.match(source, /result\.status === 409/);

assert.match(boundary, /current\.ownerId !== ownerId/);
assert.match(boundary, /current\.status !== 'scheduled'/);
assert.match(boundary, /SCHEDULE_NOT_CANCELLABLE/);
assert.match(boundary, /store\.cancel\(owned\.id\)/);
assert.match(api, /verb === 'DELETE'/);
assert.match(api, /commands\.cancel\(\{ principal: auth\.principal, scheduleId \}\)/);
assert.match(api, /SCHEDULE_NOT_CANCELLABLE.*409/);

assert.match(doc, /iki ayrı kullanıcı eylemi/i);
assert.match(doc, /başka owner/i);
assert.match(doc, /DELETE body taşımaz/i);
assert.match(doc, /default-deny|approval/i);
assert.match(doc, /120 karakter/i);

console.log('schedule cancel boundary tests passed');
