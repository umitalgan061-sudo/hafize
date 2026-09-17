import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const smart = fs.readFileSync(path.join(root,'public/prompt-library-smart-fill.mts'),'utf8');
const palette = fs.readFileSync(path.join(root,'public/prompt-library-command-palette.mts'),'utf8');
const hints = fs.readFileSync(path.join(root,'public/prompt-library-smart-fill-hints.mts'),'utf8');
for (const source of [smart,palette,hints]) {
  assert.doesNotMatch(source,/fetch\s*\(/);
  assert.doesNotMatch(source,/XMLHttpRequest/);
  assert.doesNotMatch(source,/WebSocket/);
  assert.doesNotMatch(source,/navigator\.sendBeacon/);
  assert.doesNotMatch(source,/document\.cookie/);
  assert.doesNotMatch(source,/innerHTML\s*=/);
  assert.doesNotMatch(source,/outerHTML/);
}
assert.match(smart,/MAX_VALUE = 1000/);
assert.match(smart,/MAX_VARIABLES = 12/);
assert.match(smart,/MAX_PRESETS = 6/);
assert.match(smart,/MAX_PREVIEW = 8000/);
assert.match(smart,/preventDefault/);
assert.match(smart,/stopImmediatePropagation/);
assert.match(smart,/composer\.value/);
assert.doesNotMatch(smart,/requestSubmit/);
assert.doesNotMatch(smart,/form\.submit/);
assert.match(palette,/MAX_RESULTS = 12/);
assert.match(palette,/MAX_QUERY = 120/);
assert.match(hints,/MutationObserver/);
console.log('prompt smart-fill security review: ok');
