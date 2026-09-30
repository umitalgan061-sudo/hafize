import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../public/typed/prompt-library.ts', import.meta.url), 'utf8');
assert.match(source, /if \(documentRef\.getElementById\('promptLibraryCard'\)\)/);
assert.match(source, /return \{ mounted: false, reason: 'already-mounted' \}/);
assert.match(source, /beforeunload/);
assert.match(source, /storage/);
assert.match(source, /destroy: \(\) =>/);
assert.match(source, /for \(const off of listeners\.splice/);
assert.match(source, /card\.remove\(\)/);
console.log('test-prompt-library-lifecycle: ok');
