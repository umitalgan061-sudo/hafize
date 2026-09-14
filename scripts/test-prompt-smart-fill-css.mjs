import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const smart = fs.readFileSync(path.join(process.cwd(), 'public/prompt-library-smart-fill.css'), 'utf8');
const palette = fs.readFileSync(path.join(process.cwd(), 'public/prompt-library-command-palette.css'), 'utf8');
for (const css of [smart, palette]) {
  assert.match(css, /@media\(max-width:700px\)/);
  assert.match(css, /forced-colors:active/);
  assert.match(css, /focus-visible/);
}
assert.match(smart, /grid-template-columns/);
assert.match(smart, /max-height/);
assert.match(palette, /listbox|palette/);
assert.match(palette, /overflow:auto/);
console.log('prompt smart-fill CSS contracts: ok');
