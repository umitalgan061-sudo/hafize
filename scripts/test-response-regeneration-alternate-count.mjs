import fs from 'node:fs'; import assert from 'node:assert/strict';
const s=fs.readFileSync('public/typed/response-variants.ts','utf8');
assert.match(s,/MAX_RESPONSE_ALTERNATES = 3/); assert.match(s,/slice\(0, maxItems\)/);
console.log('alternate count contract ok');