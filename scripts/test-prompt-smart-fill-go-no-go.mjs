import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { assertVersionedCacheDeclaration } from './shell-cache-contract.mjs';
const root = process.cwd();
const smart = fs.readFileSync(path.join(root,'public/prompt-library-smart-fill.ts'),'utf8');
const palette = fs.readFileSync(path.join(root,'public/prompt-library-command-palette.ts'),'utf8');
const hints = fs.readFileSync(path.join(root,'public/prompt-library-smart-fill-hints.ts'),'utf8');
const index = fs.readFileSync(path.join(root,'public/index.html'),'utf8');
const sw = fs.readFileSync(path.join(root,'public/sw-policy.js'),'utf8');

for (const asset of ['prompt-library-smart-fill.css','prompt-library-smart-fill.js','prompt-library-command-palette.css','prompt-library-command-palette.js','prompt-library-smart-fill-hints.js']) {
  assert.ok(index.includes(asset));
  assert.ok(sw.includes(asset));
}
assertVersionedCacheDeclaration(sw);
assert.match(sw,/network-only/);
assert.match(smart,/replaceVariables/);
assert.match(smart,/composer\.value/);
assert.match(smart,/preventDefault/);
assert.match(smart,/stopImmediatePropagation/);
assert.match(smart,/MAX_VALUE = 1000/);
assert.match(smart,/MAX_VARIABLES = 12/);
assert.match(smart,/MAX_PRESETS = 6/);
assert.match(palette,/\/prompt/);
assert.match(palette,/MAX_RESULTS = 12/);
assert.match(palette,/MAX_QUERY = 120/);
assert.match(hints,/MutationObserver/);
assert.doesNotMatch(smart,/fetch\s*\(/);
assert.doesNotMatch(palette,/fetch\s*\(/);
assert.doesNotMatch(hints,/fetch\s*\(/);
assert.doesNotMatch(smart,/requestSubmit/);
assert.doesNotMatch(smart,/form\.submit/);
console.log('prompt smart-fill go/no-go gate: ok');
