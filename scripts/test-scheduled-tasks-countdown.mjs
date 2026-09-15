import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../public/scheduled-tasks-countdown.js', import.meta.url), 'utf8');
assert.match(source, /scheduled-task-countdown/);
assert.match(source, /Date\.parse\(timestamp \|\| ''\)/);
assert.match(source, /delta <= 0/);
assert.match(source, /days > 0/);
assert.match(source, /hours > 0/);
assert.match(source, /Math\.max\(1, minutes\)/);
assert.match(source, /dataset\.status !== 'scheduled'/);
assert.match(source, /dataset\.runAt/);
assert.match(source, /REFRESH_MS = 1_000/);
assert.match(source, /beforeunload/);
assert.doesNotMatch(source, /fetch\(/);
assert.doesNotMatch(source, /XMLHttpRequest/);
console.log('scheduled task countdown: ok');
