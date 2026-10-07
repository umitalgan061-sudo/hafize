import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const source=await fs.readFile('public/typed/legacy/prompt-library-safety.ts','utf8');
assert.match(source,/while \(ids\.has\(nextId\)\)/);
assert.match(source,/nextId = randomId\(\)/);
assert.match(source,/collisions \+= 1/);
console.log('prompt-library-import-collision: ok');
