import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const js = await readFile(new URL('../public/typed/legacy/scheduled-task-duplicate.ts', import.meta.url), 'utf8');
const css = await readFile(new URL('../public/scheduled-task-duplicate.css', import.meta.url), 'utf8');

assert.match(js, /aria-label/);
assert.match(js, /type = 'button'/);
assert.match(js, /dataset\.scheduledDuplicate/);
assert.match(js, /focus\(\)/);
assert.match(css, /focus-visible/);
assert.match(css, /forced-colors/);
console.log('scheduled-task-duplicate-a11y: ok');
