import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync('public/composer-attachments.js','utf8');
assert.match(source,/items.length >= api.MAX_FILES/);
assert.match(source,/api\.totalChars\(items\) \+ content\.length > api\.MAX_COMBINED_CHARS/);
assert.match(source,/slice\(0, api\.MAX_FILES\)/);
console.log('composer attachment queue boundary: ok');