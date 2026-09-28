import fs from 'node:fs'; import assert from 'node:assert/strict';
const s=fs.readFileSync('public/typed/response-regeneration-options.ts','utf8');
assert.match(s,/role: 'user', content: cleanInstruction/); assert.match(s,/buildRegenerationMessages/);
console.log('transient instruction contract ok');