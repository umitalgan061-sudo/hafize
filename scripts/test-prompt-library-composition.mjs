import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const names = [
  '/prompt-library.js',
  '/typed-build/legacy-app.js',
  '/typed-build/legacy-app.js',
  '/typed-build/legacy-app.js'
];
for (const name of names) assert.equal((html.match(new RegExp(name.replace('.', '\\.'), 'g')) || []).length, 1);
const coreIndex = html.indexOf('/prompt-library.js');
const starterIndex = html.indexOf('/typed-build/legacy-app.js');
const enhancementIndex = html.indexOf('/typed-build/legacy-app.js');
const keyboardIndex = html.indexOf('/typed-build/legacy-app.js');
assert.ok(coreIndex < starterIndex);
assert.ok(starterIndex < enhancementIndex);
assert.ok(enhancementIndex < keyboardIndex);
console.log('test-prompt-library-composition: ok');
