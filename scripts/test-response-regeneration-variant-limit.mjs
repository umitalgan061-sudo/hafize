import fs from 'node:fs'; import assert from 'node:assert/strict';
const s=fs.readFileSync('public/typed/response-variants.ts','utf8');
assert.match(s,/MAX_RESPONSE_ALTERNATES = 20/); assert.match(s,/MAX_RESPONSE_LENGTH = 5000000/);
console.log('variant limits contract ok');