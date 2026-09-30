import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const index = await readFile('public/index.html', 'utf8');
const source = await readFile('public/prompt-library-smart-fill.js', 'utf8');
const policy = await readFile('public/sw-policy.js', 'utf8');

assert.match(index, /id="promptLibraryCard"/);
assert.match(index, /prompt-library-smart-fill\.css/);
assert.match(index, /prompt-library-smart-fill\.js/);
assert.match(index, /prompt-library-smart-fill-hints\.js/);

assert.match(source, /role', 'dialog'/);
assert.match(source, /aria-modal/);
assert.match(source, /MAX_PRESETS = 8/);
assert.match(source, /MAX_VALUE = 1000/);
assert.match(source, /insertMode/);
assert.match(source, /writeLast/);
assert.match(source, /useCount/);
assert.match(source, /composer\.focus/);
assert.doesNotMatch(source, /submit\(\)/);

assert.match(policy, /v28/);
assert.match(policy, /prompt-library-smart-fill\.css/);
assert.match(policy, /prompt-library-smart-fill\.js/);
assert.match(policy, /prompt-library-smart-fill-hints\.js/);

console.log('smart-fill final integration gate: ok');
