import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('public/prompt-library-collections.js', 'utf8');
const keyboard = fs.readFileSync('public/prompt-library-collections-keyboard.js', 'utf8');

assert.match(source, /aria-labelledby/);
assert.match(source, /aria-live.*polite/);
assert.match(source, /role', 'list/);
assert.match(source, /role', 'listitem/);
assert.match(source, /aria-label/);
assert.match(keyboard, /Ctrl\/Meta\+Shift\/O/);
assert.match(keyboard, /isEditable/);
assert.match(keyboard, /event\.preventDefault/);
console.log('prompt library collections accessibility: ok');
