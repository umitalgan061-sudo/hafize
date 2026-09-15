import assert from 'node:assert/strict';
import fs from 'node:fs';
const source = fs.readFileSync('public/composer-history.js', 'utf8');
assert.match(source, /event\.isComposing/);
assert.match(source, /composing/);
assert.match(source, /compositionstart/);
assert.match(source, /compositionend/);
assert.match(source, /if \(event\.isComposing \|\| composing/);
console.log('composer history IME boundary: ok');
