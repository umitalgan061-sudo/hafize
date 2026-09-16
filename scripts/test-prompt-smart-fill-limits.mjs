import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const text = fs.readFileSync(path.join(process.cwd(), 'public/prompt-library-smart-fill.js'), 'utf8');
assert.match(text, /MAX_VALUE = 1000/);
assert.match(text, /MAX_VARIABLES = 12/);
assert.match(text, /MAX_PRESETS = 6/);
assert.match(text, /MAX_NAME = 60/);
assert.match(text, /MAX_PREVIEW = 8000/);
assert.match(text, /clamp\([^)]*MAX_VALUE\)/, 'values are clamped to MAX_VALUE');
assert.match(text, /slice\(0, MAX_VARIABLES\)/);
assert.match(text, /slice\(0, MAX_PRESETS\)/);
assert.match(text, /clamp\([^)]*MAX_NAME\)/, 'preset names are clamped to MAX_NAME');
assert.match(text, /slice\(0, MAX_PREVIEW\)/);
assert.match(text, /input\.maxLength = MAX_VALUE/);
console.log('prompt smart-fill limits: ok');
