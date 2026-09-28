import fs from 'node:fs';
import assert from 'node:assert/strict';
const s=fs.readFileSync('public/typed/response-variants.ts','utf8');
assert.match(s,/durationMs/);
assert.match(s,/600000/);
assert.match(s,/Math\.floor/);
console.log('response duration contract ok');