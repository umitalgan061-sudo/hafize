import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const sourcePath = fileURLToPath(new URL('../public/schedule-retry-policy.js', import.meta.url));
const source = await readFile(sourcePath, 'utf8');

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
  /outerHTML/,
  /Authorization/i,
  /Bearer\s+/i,
  /ownerId/,
  /traceId/,
  /api[_-]?key/i,
  /client[_-]?secret/i,
  /access[_-]?token/i,
  /refresh[_-]?token/i,
  /child_process/,
  /\bexec\s*\(/,
  /\bspawn\s*\(/,
  /shell\s*:\s*true/i
]) {
  assert.equal(forbidden.test(source), false, `forbidden schedule retry policy surface: ${forbidden}`);
}

assert.match(source, /method:\s*'PATCH'/);
assert.match(source, /credentials:\s*'same-origin'/);
assert.match(source, /cache:\s*'no-store'/);
assert.match(source, /JSON\.stringify\(\{ retryDelayMs: delay \}\)/);
assert.match(source, /confirmImpl\(/, 'mutation must require an explicit confirmation');
assert.match(source, /article\.dataset\?\.state === 'scheduled'/);
assert.match(source, /maxAttemptsFor\(article\) > 1/);
assert.match(source, /aria-live', 'polite'/);
assert.match(source, /event\?\.key !== 'Escape'/);
assert.match(source, /AUTO_MOUNT_TIMEOUT_MS = 10_000/);
assert.match(source, /observer\.disconnect/);
assert.match(source, /clearTimeout/);

const optionValues = [...source.matchAll(/Object\.freeze\(\{ value: ([0-9_]+), label:/g)]
  .map((match) => Number(match[1].replaceAll('_', '')));
assert.deepEqual(optionValues, [60_000, 300_000, 900_000, 3_600_000, 21_600_000, 86_400_000]);
assert.equal(new Set(optionValues).size, optionValues.length);
assert.equal(Math.min(...optionValues), 60_000);
assert.equal(Math.max(...optionValues), 86_400_000);

console.log('schedule retry policy boundary tests passed');
