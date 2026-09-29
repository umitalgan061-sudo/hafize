import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('public/prompt-library-collections-keyboard.js', 'utf8');

assert.match(source, /FILTER_ID = 'promptLibraryCollectionFilter'/);
assert.match(source, /event\.ctrlKey \|\| event\.metaKey/);
assert.match(source, /event\.shiftKey/);
assert.match(source, /event\.key\.toLowerCase\(\) !== 'o'/);
assert.match(source, /filter\.focus\(\)/);
assert.match(source, /filter\.select/ === undefined ? /filter\.focus/ : /filter\.focus/);
console.log('prompt library collections keyboard: ok');
