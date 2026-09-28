import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const js = await readFile(new URL('../public/scheduled-task-planning.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../public/scheduled-task-planning.css', import.meta.url), 'utf8');

assert.match(js, /Filtreyi temizle/);
assert.match(js, /search\.value = ''/);
assert.match(js, /sort\.value = 'run-asc'/);
assert.match(js, /search\.focus\(\)/);
assert.match(css, /scheduled-task-list-clear/);
console.log('scheduled-task-planning-reset: ok');
