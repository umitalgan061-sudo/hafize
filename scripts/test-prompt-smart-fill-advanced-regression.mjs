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
assert.match(smart,/persistPresetBar\(\)/, "the preset bar is re-rendered after changes");
assert.match(smart,/renderPreview\(\)/);
assertFunctionDeclared(smart, 'insertIntoComposer');
assert.match(smart,/insert\.addEventListener\('click', insertIntoComposer\)/, 'the insert button is wired to the composer handoff');
assert.match(smart,/closeDialog\(\)/);
assert.match(smart,/dialog\.hidden = true/);
assert.match(smart,/fields\.replaceChildren\(\)/);
assert.match(smart,/presetBar\.replaceChildren\(\)/);
assert.match(smart,/errors\.textContent = ''/);
assert.match(smart,/\[name, clamp\(activeInputs\.get\(name\)\?\.value, MAX_VALUE\)\]/, 'every submitted value is clamped');
assert.match(smart,/String\(value \?\? ''\)/);
assert.match(smart,/if \(!writePresets/);
assert.match(smart,/readPresets\(activePrompt\.id\)/);

assertFunctionDeclared(palette, 'open');
assert.match(palette,/open\(cursor - match\[0\]\.length/, 'the palette opens at the trigger offset');
assert.match(palette,/triggerStart = Math\.max\(0, start\)/, 'the trigger offset is never negative');
assert.match(palette,/query\.value = ''/);
assert.match(palette,/current = searchPromptLibrary\(query\.value\)/, "the palette results come from the library search");
assert.match(palette,/list\.replaceChildren\(\)/);
assert.match(palette,/role', 'option'/);
assert.match(palette,/aria-selected/);
assert.match(palette,/scrollIntoView/);
assert.match(palette,/event\.key === 'Enter'/);
assert.match(palette,/event\.key === 'Escape'/);

assertFunctionDeclared(hints, 'paintSmartFillHints');
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
