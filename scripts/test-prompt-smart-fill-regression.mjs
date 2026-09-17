import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { assertVersionedCacheDeclaration } from './shell-cache-contract.mjs';
const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root,p),'utf8');
const smart = read('public/prompt-library-smart-fill.ts');
const hints = read('public/prompt-library-smart-fill-hints.ts');
const palette = read('public/prompt-library-command-palette.ts');
const index = read('public/index.html');
const sw = read('public/sw-policy.js');
const core = read('public/prompt-library.js');

assert.match(core,/hafize\.prompt-library\.v1/);
assert.match(smart,/hafize\.prompt-library\.smart-fill\.v1/);
assert.match(smart,/extractVariables/);
assert.match(smart,/replaceVariables/);
assert.match(smart,/insertIntoComposer/);
assert.match(smart,/stopImmediatePropagation/);
assert.match(smart,/role', 'dialog'/);
assert.match(smart,/role', 'alert'/);
assert.match(smart,/aria-modal/);
assert.match(smart,/aria-labelledby/);
assert.match(smart,/aria-describedby/);
assert.match(smart,/MAX_VALUE = 1000/);
assert.match(smart,/MAX_VARIABLES = 12/);
assert.match(smart,/MAX_PRESETS = 6/);
assert.match(smart,/MAX_PREVIEW = 8000/);
assert.match(smart,/localStorage/);
assert.doesNotMatch(smart,/fetch\s*\(/);
assert.doesNotMatch(smart,/XMLHttpRequest/);
assert.doesNotMatch(smart,/WebSocket/);
assert.doesNotMatch(smart,/innerHTML\s*=/);
assert.doesNotMatch(smart,/requestSubmit/);
assert.doesNotMatch(smart,/form\.submit/);

assert.match(hints,/HafizePromptSmartFillHints/);
assert.match(hints,/MAX_VALUE = 1000/);
assert.match(hints,/MAX_PREVIEW = 8000/);
assert.match(hints,/MutationObserver/);
assert.match(hints,/prompt-smart-fill-count/);

assert.match(palette,/PromptLibraryCommandPalette/);
assert.match(palette,/\/prompt/);
assert.match(palette,/MAX_RESULTS = 12/);
assert.match(palette,/MAX_QUERY = 120/);
assert.match(palette,/listbox/);
assert.match(palette,/aria-selected/);
assert.match(palette,/ArrowDown/);
assert.match(palette,/ArrowUp/);
assert.match(palette,/Escape/);
assert.match(palette,/Enter/);
assert.match(palette,/HafizePromptLibrarySmartFill/);
assert.doesNotMatch(palette,/fetch\s*\(/);
assert.doesNotMatch(palette,/XMLHttpRequest/);

assert.match(index,/prompt-library-smart-fill\.css/);
assert.match(index,/prompt-library-command-palette\.css/);
assert.match(index,/prompt-library-smart-fill\.js/);
assert.match(index,/prompt-library-command-palette\.js/);
assert.match(index,/prompt-library-smart-fill-hints\.js/);
assertVersionedCacheDeclaration(sw);
for (const asset of [
  'prompt-library-smart-fill.css',
  'prompt-library-smart-fill.js',
  'prompt-library-smart-fill-hints.js',
  'prompt-library-command-palette.css',
  'prompt-library-command-palette.js'
]) assert.match(sw,new RegExp(asset.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
assert.match(sw,/pathname\.startsWith\('\/api\/'\)/);
console.log('prompt smart-fill regression suite: ok');
