import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../public/prompt-library.js', import.meta.url), 'utf8');
assert.match(source, /function install\(/);
assert.match(source, /already-mounted/);
assert.match(source, /destroyed = true/);
assert.match(source, /for \(const off of listeners\.splice/);
assert.match(source, /card\.remove\(\)/);
assert.match(source, /beforeunload/);
assert.match(source, /storage/);
console.log('test-prompt-library-lifecycle: ok');
