import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const names = [
  '/prompt-library.js',
  '/prompt-library-starters.js',
  '/prompt-library-enhancements.js',
  '/prompt-library-keyboard.js'
];
for (const name of names) assert.equal((html.match(new RegExp(name.replace('.', '\\.'), 'g')) || []).length, 1);
const coreIndex = html.indexOf('/prompt-library.js');
const starterIndex = html.indexOf('/prompt-library-starters.js');
const enhancementIndex = html.indexOf('/prompt-library-enhancements.js');
const keyboardIndex = html.indexOf('/prompt-library-keyboard.js');
assert.ok(coreIndex < starterIndex);
assert.ok(starterIndex < enhancementIndex);
assert.ok(enhancementIndex < keyboardIndex);
console.log('test-prompt-library-composition: ok');
