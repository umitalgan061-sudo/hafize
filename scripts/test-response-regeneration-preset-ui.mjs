import fs from 'node:fs'; import assert from 'node:assert/strict';
const s=fs.readFileSync('public/typed/response-regeneration-options-ui.ts','utf8');
for(const token of ['Daha kısa','Daha detaylı','Daha resmi','Madde madde']) assert.match(s,new RegExp(token));
console.log('preset ui contract ok');