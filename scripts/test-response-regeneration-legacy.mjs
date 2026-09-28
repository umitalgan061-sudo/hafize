import fs from 'node:fs';
import assert from 'node:assert/strict';
const source=fs.readFileSync('public/typed/app-shell.ts','utf8');
assert.match(source,/source\.alternates/);
assert.match(source,/source\.feedback/);
assert.match(source,/source\.generation/);
assert.match(source,/\? \{/);
console.log('legacy optional field contract ok');