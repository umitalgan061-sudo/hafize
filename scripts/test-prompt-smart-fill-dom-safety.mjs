import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const smart = fs.readFileSync(path.join(process.cwd(),'public/prompt-library-smart-fill.mts'),'utf8');
const hints = fs.readFileSync(path.join(process.cwd(),'public/prompt-library-smart-fill-hints.mts'),'utf8');
const palette = fs.readFileSync(path.join(process.cwd(),'public/prompt-library-command-palette.mts'),'utf8');
for (const source of [smart,hints,palette]) {
  assert.doesNotMatch(source,/innerHTML\s*=/);
  assert.doesNotMatch(source,/outerHTML/);
}
assert.match(smart,/textContent =/);
assert.match(smart,/input\.value/);
assert.match(hints,/textContent =/);
assert.match(palette,/textContent/);
console.log('prompt smart-fill DOM safety: ok');
