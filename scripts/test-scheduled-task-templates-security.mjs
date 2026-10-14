import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const js = await readFile(new URL('../public/typed/legacy/scheduled-task-templates.ts', import.meta.url), 'utf8');

assert.doesNotMatch(js, /fetch\(/);
assert.doesNotMatch(js, /XMLHttpRequest/);
assert.doesNotMatch(js, /WebSocket/);
assert.doesNotMatch(js, /sendBeacon/);
assert.doesNotMatch(js, /Authorization/);
assert.doesNotMatch(js, /Bearer/);
assert.match(js, /localStorage/);
assert.match(js, /confirm/);
console.log('scheduled-task-templates-security: ok');
