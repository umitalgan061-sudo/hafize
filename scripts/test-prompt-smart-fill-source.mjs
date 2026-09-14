import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const file = fs.readFileSync(path.join(root, 'public/prompt-library-smart-fill.js'), 'utf8');

assert.match(file, /HafizePromptLibrarySmartFill/);
assert.match(file, /readPresets/);
assert.match(file, /writePresets/);
assert.match(file, /variableNames/);
assert.match(file, /aria-modal/);
assert.match(file, /aria-labelledby/);
assert.match(file, /Mesaja aktar/);
assert.match(file, /Önizlemeyi kopyala/);
assert.doesNotMatch(file, /fetch\(/);
assert.doesNotMatch(file, /XMLHttpRequest/);
assert.doesNotMatch(file, /WebSocket/);
assert.doesNotMatch(file, /navigator\.sendBeacon/);

console.log('prompt smart-fill source contracts: ok');
