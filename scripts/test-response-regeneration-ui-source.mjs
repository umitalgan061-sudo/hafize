import fs from 'node:fs'; import assert from 'node:assert/strict';
const app=fs.readFileSync('public/typed/app-shell.ts','utf8');
const ui=fs.readFileSync('public/typed/response-variants-ui.ts','utf8');
assert.match(app,/openResponseVariantDialog/); assert.match(ui,/textContent/); assert.doesNotMatch(ui,/innerHTML/);
console.log('response ui dom safety contract ok');