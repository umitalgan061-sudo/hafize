import assert from 'node:assert/strict';
import fs from 'node:fs';

const index = fs.readFileSync('public/index.html', 'utf8');
const sw = fs.readFileSync('public/sw-policy.js', 'utf8');

assert.match(index, /prompt-library-collections\.css/);
assert.match(index, /prompt-library-collections\.js/);
assert.match(index, /prompt-library-collections-keyboard\.js/);
assert.match(sw, /prompt-library-collections\.css/);
assert.match(sw, /prompt-library-collections\.js/);
assert.match(sw, /prompt-library-collections-keyboard\.js/);
assert.match(sw, /CURRENT_CACHE/);
console.log('prompt library collections PWA assets: ok');
