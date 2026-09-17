import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('public/prompt-library-collections-workspace.js', 'utf8');

assert.match(source, /function mount\(documentRef = doc\(\), rootRef = root\)/);
assert.match(source, /function cleanup\(\)/);
assert.match(source, /destroy: cleanup/);
assert.match(source, /destroyed = true/);
assert.match(source, /observer\?\.disconnect\(\)/);
assert.match(source, /for \(const off of disposers\.splice\(0\)\) off\(\)/);
assert.match(source, /editor\.panel\.remove\(\)/);
assert.match(source, /panel\.remove\(\)/);
assert.match(source, /dataset\.workspaceVersion = '2'/);
assert.match(source, /if \(destroyed\) return/);
assert.match(source, /beforeunload/);
assert.match(source, /Object\.freeze\(\{\s*mounted: true/);

console.log('prompt collection workspace lifecycle: ok');
