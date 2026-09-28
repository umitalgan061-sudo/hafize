import fs from 'node:fs'; import assert from 'node:assert/strict';
const s=fs.readFileSync('public/typed/response-variants.ts','utf8');
assert.match(s,/MAX_RESPONSE_ALTERNATES = 3/); assert.match(s,/MAX_RESPONSE_LENGTH = 12000/);
console.log('variant limits contract ok');