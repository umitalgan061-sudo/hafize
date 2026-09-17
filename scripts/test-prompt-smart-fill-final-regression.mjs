import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { assertVersionedCacheDeclaration } from './shell-cache-contract.mjs';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const smart = read('public/prompt-library-smart-fill.mts');
const palette = read('public/prompt-library-command-palette.mts');
const hints = read('public/prompt-library-smart-fill-hints.mts');
const sw = read('public/sw-policy.js');
const index = read('public/index.html');
const core = read('public/prompt-library.js');

assert.match(core, /HafizePromptLibrary/);
assert.match(core, /extractVariables/);
assert.match(core, /replaceVariables/);
assert.match(smart, /HafizePromptLibrarySmartFill/);
assert.match(smart, /MAX_VALUE = 1000/);
assert.match(smart, /MAX_VARIABLES = 12/);
assert.match(smart, /MAX_PRESETS = 6/);
assert.match(smart, /MAX_PREVIEW = 8000/);
assert.match(smart, /aria-modal/);
assert.match(smart, /aria-describedby/);
assert.match(smart, /preview\.textContent/);
assert.match(smart, /composer\.value/);
assert.match(smart, /composer\.dispatchEvent/);
assert.doesNotMatch(smart, /requestSubmit/);
assert.doesNotMatch(smart, /form\.submit/);
assert.doesNotMatch(smart, /innerHTML\s*=/);

assert.match(palette, /PromptLibraryCommandPalette/);
assert.match(palette, /MAX_RESULTS = 12/);
assert.match(palette, /MAX_QUERY = 120/);
assert.match(palette, /\/prompt/);
assert.match(palette, /aria-selected/);
assert.match(palette, /HafizePromptLibrarySmartFill/);
assert.match(palette, /ArrowDown/);
assert.match(palette, /ArrowUp/);
assert.match(palette, /Escape/);
assert.match(palette, /Enter/);
assert.doesNotMatch(palette, /fetch\s*\(/);

assert.match(hints, /HafizePromptSmartFillHints/);
assert.match(hints, /MutationObserver/);
assert.match(hints, /MAX_VALUE = 1000/);
assert.match(hints, /MAX_PREVIEW = 8000/);

for (const source of [smart, palette, hints]) {
  assert.doesNotMatch(source, /fetch\s*\(/);
  assert.doesNotMatch(source, /XMLHttpRequest/);
  assert.doesNotMatch(source, /WebSocket/);
  assert.doesNotMatch(source, /navigator\.sendBeacon/);
  assert.doesNotMatch(source, /document\.cookie/);
}

assert.match(index, /prompt-library-smart-fill\.js/);
assert.match(index, /prompt-library-command-palette\.js/);
assert.match(index, /prompt-library-smart-fill-hints\.js/);
assertVersionedCacheDeclaration(sw);
assert.match(sw, /prompt-library-smart-fill\.js/);
assert.match(sw, /prompt-library-command-palette\.js/);
assert.match(sw, /prompt-library-smart-fill-hints\.js/);
assert.match(sw, /pathname\.startsWith\('\/api\/'\)/);

console.log('prompt smart-fill final regression gate: ok');
