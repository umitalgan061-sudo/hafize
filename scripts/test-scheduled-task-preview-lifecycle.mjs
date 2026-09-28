import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const js = await readFile(new URL('../public/scheduled-task-preview.js', import.meta.url), 'utf8');

assert.match(js, /MutationObserver/);
assert.match(js, /observer\.disconnect/);
assert.match(js, /beforeunload/);
assert.match(js, /cleanups\.splice\(0\)/);
assert.match(js, /closePreview\(\)/);
assert.match(js, /stopCountdown\(\)/);
assert.match(js, /mountedForm = null/);
assert.match(js, /destroyed = true/);
console.log('scheduled-task-preview-lifecycle: ok');
