import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../public/prompt-library-keyboard.js', import.meta.url), 'utf8');
assert.match(source, /ctrlKey/);
assert.match(source, /metaKey/);
assert.match(source, /shiftKey/);
assert.match(source, /key === 'p'/);
assert.match(source, /key === 'n'/);
assert.match(source, /#promptLibrarySearch/);
assert.match(source, /\.focus\(\)/);
assert.match(source, /\.select\(\)/);
assert.match(source, /\.prompt-library-actions/);
assert.match(source, /passive: false/);
console.log('test-prompt-library-keyboard: ok');
