import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const source=await fs.readFile('public/prompt-library-safety.js','utf8');
assert.match(source,/while \(ids\.has\(nextId\)\)/);
assert.match(source,/nextId = randomId\(\)/);
assert.match(source,/collisions\s*(?:\+\+|\+=\s*1)/, 'id collisions are counted');
console.log('prompt-library-import-collision: ok');
