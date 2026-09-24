import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const boundary = await readFile(new URL('../lib/schedule-command-boundary.mts', import.meta.url), 'utf8');
const client = await readFile(new URL('../public/scheduled-tasks.js', import.meta.url), 'utf8');

assert.match(boundary, /AUTH_REQUIRED/);
assert.match(boundary, /principalSubject/);
assert.match(boundary, /ownerId/);
assert.match(boundary, /task\.length > 20_000/);
assert.match(boundary, /containsPlaintextCredential/);
assert.match(boundary, /Object\.keys\(input\)/);
assert.match(boundary, /CREATE_FIELDS/);
assert.match(boundary, /current\.status !== 'scheduled'/);
assert.match(client, /credentials:\s*'same-origin'/);
assert.match(client, /encodeURIComponent\(id\)/);
assert.match(client, /confirm\?\./);
assert.doesNotMatch(client, /localStorage/);
assert.doesNotMatch(client, /sessionStorage/);
assert.doesNotMatch(client, /NVIDIA_API_KEY/);
assert.doesNotMatch(client, /HAFIZE_SCHEDULE_AUTH_TOKEN/);

console.log('scheduled task security boundary: ok');
