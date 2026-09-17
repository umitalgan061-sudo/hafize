import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('public/prompt-library-collections-workspace.js', 'utf8');

assert.match(source, /function reorderCollection\(id, direction, workspace\)/);
assert.match(source, /direction === 'up'/);
assert.match(source, /direction === 'down'/);
assert.match(source, /index - 1/);
assert.match(source, /index \+ 1/);
assert.match(source, /nextIndex < 0/);
assert.match(source, /nextIndex >= collections\.length/);
assert.match(source, /\[collections\[index\], collections\[nextIndex\]\]/);
assert.match(source, /core\(\)\?\.saveCollections/);
assert.match(source, /reorderCollection\(collection\.id, 'up', workspace\)/);
assert.match(source, /reorderCollection\(collection\.id, 'down', workspace\)/);
assert.match(source, /sortCollections\(\s*readCollections\(\)/);

console.log('prompt collection workspace reorder: ok');
