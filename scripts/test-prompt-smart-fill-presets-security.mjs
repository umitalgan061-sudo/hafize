import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile('public/prompt-library-smart-fill.js', 'utf8');

assert.match(source, /MAX_PRESETS = 8/);
assert.match(source, /MAX_NAME = 60/);
assert.match(source, /writePresets/);
assert.match(source, /confirm/);
assert.match(source, /presetKey/);
assert.match(source, /slice\(0, MAX_PRESETS\)/);
assert.doesNotMatch(source, /eval\(/);
assert.doesNotMatch(source, /new Function/);

console.log('smart-fill preset security: ok');
