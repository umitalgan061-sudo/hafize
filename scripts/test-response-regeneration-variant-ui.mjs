import fs from 'node:fs'; import assert from 'node:assert/strict';
const s=fs.readFileSync('public/typed/response-variants-ui.ts','utf8');
assert.match(s,/Yanıt varyantları/); assert.match(s,/Bu yanıtı kullan/); assert.match(s,/role.*dialog/); assert.match(s,/aria-modal/);
console.log('variant picker ui contract ok');