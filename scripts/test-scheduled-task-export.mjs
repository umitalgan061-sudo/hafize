import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const js = await readFile(new URL('../public/typed/legacy/scheduled-task-export.ts', import.meta.url), 'utf8');

assert.match(js, /MAX_EXPORT = 250000/);
assert.match(js, /hafize-scheduled-tasks-visible/);
assert.match(js, /Görünenleri dışa aktar/);
assert.match(js, /readVisible/);
assert.match(js, /scheduleId/);
assert.match(js, /maxAttempts/);
assert.doesNotMatch(js, /fetch\(/);
assert.doesNotMatch(js, /Authorization/);
console.log('scheduled-task-export: ok');
