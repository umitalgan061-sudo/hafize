import fs from 'node:fs'; import assert from 'node:assert/strict';
const s=fs.readFileSync('public/typed/response-regeneration-options.ts','utf8');
assert.match(s,/MAX_REGENERATION_INSTRUCTION = 600/); assert.match(s,/replace\(\/\\0\/g, ''\)/); assert.match(s,/slice\(0, MAX_REGENERATION_INSTRUCTION\)/);
console.log('instruction limit contract ok');