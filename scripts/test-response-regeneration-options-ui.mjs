import fs from 'node:fs'; import assert from 'node:assert/strict';
const s=fs.readFileSync('public/typed/response-regeneration-options-ui.ts','utf8');
assert.match(s,/role.*dialog/); assert.match(s,/aria-modal/); assert.match(s,/Escape/); assert.match(s,/Özel yönergeyle yeniden üret/);
console.log('regeneration options ui contract ok');