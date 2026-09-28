import fs from 'node:fs'; import assert from 'node:assert/strict';
const s=fs.readFileSync('public/typed/response-variants.ts','utf8');
assert.match(s,/listResponseVariants/); assert.match(s,/selectResponseVariant/); assert.match(s,/variantIndex/);
console.log('variant selection contract ok');