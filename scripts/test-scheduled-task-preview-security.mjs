import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const js = await readFile(new URL('../public/scheduled-task-preview.js', import.meta.url), 'utf8');

assert.doesNotMatch(js, /root\.fetch/);
assert.doesNotMatch(js, /XMLHttpRequest/);
assert.doesNotMatch(js, /WebSocket/);
assert.doesNotMatch(js, /sendBeacon/);
assert.doesNotMatch(js, /localStorage/);
assert.doesNotMatch(js, /sessionStorage/);
assert.match(js, /requestSubmit/);
assert.match(js, /data-preview-submit-bypass/);
assert.match(js, /stopImmediatePropagation/);
console.log('scheduled-task-preview-security: ok');
