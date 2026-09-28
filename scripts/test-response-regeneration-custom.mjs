import fs from 'node:fs'; import assert from 'node:assert/strict';
const s=fs.readFileSync('public/typed/response-regeneration-options.ts','utf8');
assert.match(s,/MAX_REGENERATION_INSTRUCTION = 600/); assert.match(s,/normalizeRegenerationInstruction/);
console.log('custom instruction contract ok');