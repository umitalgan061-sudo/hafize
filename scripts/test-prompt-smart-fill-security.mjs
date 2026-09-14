import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const text = fs.readFileSync(path.join(process.cwd(), 'public/prompt-library-smart-fill.js'), 'utf8');

assert.match(text, /root\.localStorage/);
assert.doesNotMatch(text, /fetch\s*\(/);
assert.doesNotMatch(text, /XMLHttpRequest/);
assert.doesNotMatch(text, /WebSocket/);
assert.doesNotMatch(text, /navigator\.sendBeacon/);
assert.doesNotMatch(text, /document\.cookie/);
assert.doesNotMatch(text, /innerHTML\s*=/);
assert.doesNotMatch(text, /outerHTML/);
assert.match(text, /textContent/);
assert.match(text, /String\(value \?\? ''\)/);
assert.match(text, /MAX_VALUE = 1000/);
assert.match(text, /MAX_PRESETS = 6/);
assert.match(text, /slice\(0, MAX_PRESETS\)/);
console.log('prompt smart-fill security contracts: ok');
