import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const js = await readFile(new URL('../public/typed/legacy/scheduled-task-actions.ts', import.meta.url), 'utf8');
const css = await readFile(new URL('../public/scheduled-task-actions.css', import.meta.url), 'utf8');

assert.match(js, /Görevi kopyala/);
assert.match(js, /Trace kopyala/);
assert.match(js, /navigator/);
assert.match(js, /clipboard/);
assert.doesNotMatch(js, /root\.fetch/);
assert.doesNotMatch(js, /Authorization/);
assert.match(css, /scheduled-task-quick-action/);
console.log('scheduled-task-actions: ok');
