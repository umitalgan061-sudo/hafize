import fs from 'node:fs';
import assert from 'node:assert/strict';
const s=fs.readFileSync('public/index.html','utf8');
assert.match(s,/typed-build\/app-shell\.js/);
const bridge=fs.readFileSync('public/prompt-library.js','utf8');
assert.match(bridge,/typed-build/);
console.log('typed chat entry contract ok');