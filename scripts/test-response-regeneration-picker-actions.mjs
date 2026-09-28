import fs from 'node:fs'; import assert from 'node:assert/strict';
const s=fs.readFileSync('public/typed/response-variants-ui.ts','utf8');
assert.match(s,/Bu yanıtı kullan/); assert.match(s,/Varyant/); assert.match(s,/closeDialog/);
console.log('variant picker action contract ok');