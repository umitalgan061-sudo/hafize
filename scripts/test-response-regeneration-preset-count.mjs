import fs from 'node:fs'; import assert from 'node:assert/strict';
const s=fs.readFileSync('public/typed/response-regeneration-options.ts','utf8');
assert.match(s,/REGENERATION_PRESETS/); assert.match(s,/concise/); assert.match(s,/detailed/); assert.match(s,/formal/); assert.match(s,/bullets/);
console.log('preset set contract ok');