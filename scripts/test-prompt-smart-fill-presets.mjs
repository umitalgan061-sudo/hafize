import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const text = fs.readFileSync(path.join(process.cwd(), 'public/prompt-library-smart-fill.js'), 'utf8');
assert.match(text, /STORAGE_KEY = 'hafize\.prompt-library\.smart-fill\.v1'/);
assert.match(text, /keyForPrompt/);
assert.match(text, /readPresets/);
assert.match(text, /writePresets/);
assert.match(text, /JSON\.parse/);
assert.match(text, /JSON\.stringify/);
assert.match(text, /Object\.fromEntries/);
assert.match(text, /MAX_PRESETS/);
assert.match(text, /name: clamp\(preset\.name, MAX_NAME\)/);
assert.match(text, /values: Object\.fromEntries/);
assert.doesNotMatch(text, /sessionStorage/);
assert.doesNotMatch(text, /indexedDB/);
console.log('prompt smart-fill presets: ok');
