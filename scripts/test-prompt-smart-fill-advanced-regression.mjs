import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { assertFunctionDeclared } from './source-contract.mjs';

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root,p),'utf8');
const smart = read('public/prompt-library-smart-fill.ts');
const palette = read('public/prompt-library-command-palette.ts');
const hints = read('public/prompt-library-smart-fill-hints.ts');
const docs = read('docs/PROMPT_SMART_FILL_STATE_MACHINE.md');

assertFunctionDeclared(smart, 'openFor');
assert.match(smart,/activePrompt = prompt/);
assert.match(smart,/activeNames = variableNames\(prompt\.body\)/);
assert.match(smart,/persistPresetBar\(\);/);
assert.match(smart,/const values = currentValues\(\);/);
assert.match(smart,/insert\.addEventListener\('click', insertIntoComposer\)/);
assert.match(smart,/close\.addEventListener\('click', closeDialog\)/);
assert.match(smart,/dialog\.hidden = true/);
assert.match(smart,/fields\.replaceChildren\(\)/);
assert.match(smart,/presetBar\.replaceChildren\(\)/);
assert.match(smart,/errors\.textContent = ''/);
// Every field value passes through the shared clamp on its way into the map.
assert.match(smart,/activeNames\.map\(\(name\) => \[name, clamp\(activeInputs\.get\(name\)\?\.value, MAX_VALUE\)\]\)/);
assert.match(smart,/String\(value \?\? ''\)/);
assert.match(smart,/if \(!writePresets/);
assert.match(smart,/readPresets\(activePrompt\.id\)/);

assertFunctionDeclared(palette, 'open');
assert.match(palette,/triggerStart = Math\.max\(0, start\)/);
assert.match(palette,/query\.value = ''/);
// `results` is the public alias for the exported search function.
assert.match(palette,/current = searchPromptLibrary\(query\.value\)/);
assert.match(palette,/results: searchPromptLibrary/);
assert.match(palette,/list\.replaceChildren\(\)/);
assert.match(palette,/role', 'option'/);
assert.match(palette,/aria-selected/);
assert.match(palette,/scrollIntoView/);
assert.match(palette,/event\.key === 'Enter'/);
assert.match(palette,/event\.key === 'Escape'/);

assertFunctionDeclared(hints, 'paint');
assert.match(hints,/nextElementSibling/);
assert.match(hints,/prompt-smart-fill-count/);
assert.match(hints,/prompt-smart-fill-preview-count/);
assert.match(hints,/requestAnimationFrame/);

for (const source of [smart,palette,hints]) {
  assert.doesNotMatch(source,/fetch\s*\(/);
  assert.doesNotMatch(source,/XMLHttpRequest/);
  assert.doesNotMatch(source,/WebSocket/);
  assert.doesNotMatch(source,/document\.cookie/);
  assert.doesNotMatch(source,/innerHTML\s*=/);
}
assert.match(docs,/closed/);
assert.match(docs,/open/);
assert.match(docs,/editing/);
assert.match(docs,/Focus invariant/);
assert.match(docs,/Submit invariant/);
assert.match(docs,/Lifecycle invariant/);
console.log('prompt smart-fill advanced regression: ok');
