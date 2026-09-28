import fs from 'node:fs'; import assert from 'node:assert/strict';
const s=fs.readFileSync('public/typed/app-shell.ts','utf8');
assert.match(s,/response-variants-ui\.ts/); assert.match(s,/response-regeneration-options-ui\.ts/); assert.match(s,/response-regeneration-options\.ts/);
console.log('typed import contract ok');