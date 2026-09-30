import fs from 'node:fs'; import assert from 'node:assert/strict';
// The labels are owned by `response-regeneration-options.ts`; the UI renders
// `preset.label` for each entry rather than repeating the strings.
const s=fs.readFileSync('public/typed/response-regeneration-options-ui.ts','utf8');
const presets=fs.readFileSync('public/typed/response-regeneration-options.ts','utf8');
for(const token of ['Daha kısa','Daha detaylı','Daha resmi','Madde madde']) assert.match(presets,new RegExp(token));
assert.match(s,/for \(const preset of REGENERATION_PRESETS\)/);
assert.match(s,/make\(documentRef, 'button', preset\.label, 'message-action'\)/);
assert.match(s,/preset\.label \+ ' yönergesiyle yeniden üret'/);
console.log('preset ui contract ok');