import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const js = await readFile(new URL('../public/typed/legacy/scheduled-task-templates.ts', import.meta.url), 'utf8');
const css = await readFile(new URL('../public/scheduled-task-templates.css', import.meta.url), 'utf8');

assert.match(js, /hafize\.scheduled-task-templates\.v1/);
assert.match(js, /MAX_TEMPLATES = 12/);
assert.match(js, /MAX_NAME = 60/);
assert.match(js, /MAX_TASK = 5000/);
assert.match(js, /MAX_ATTEMPTS = 5/);
assert.match(js, /function normalize/);
assert.match(js, /function load/);
assert.match(js, /function add/);
assert.match(js, /function remove/);
assert.match(js, /localStorage/);
assert.doesNotMatch(js, /root\.fetch/);
assert.doesNotMatch(js, /XMLHttpRequest/);
assert.match(js, /Görev şablonu cihaza kaydedildi/);
assert.match(js, /Uygula/);
assert.match(js, /Sil/);
assert.match(css, /scheduled-task-template-panel/);
assert.match(css, /mobile|650px/);
console.log('scheduled-task-templates: ok');
