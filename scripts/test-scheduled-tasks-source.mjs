import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../public/typed/scheduled-tasks.ts', import.meta.url), 'utf8');
assert.match(source, /credentials:\s*'same-origin'/);
assert.match(source, /\/api\/schedules/);
assert.match(source, /method:\s*'POST'/);
assert.match(source, /method:\s*'DELETE'/);
assert.match(source, /MAX_TASK = 20_000/);
assert.match(source, /MAX_LIST = 128/);
assert.match(source, /MAX_ATTEMPTS = 5/);
assert.match(source, /AbortController/);
assert.match(source, /aria-modal/);
assert.match(source, /aria-live/);
assert.match(source, /textContent/);
assert.doesNotMatch(source, /innerHTML\s*=/);
assert.doesNotMatch(source, /eval\(/);
assert.doesNotMatch(source, /new Function\(/);
console.log('scheduled task client source: ok');
