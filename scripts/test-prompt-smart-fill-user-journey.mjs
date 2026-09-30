import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { assertFunctionDeclared } from './source-contract.mjs';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const smart = read('public/prompt-library-smart-fill.ts');
const palette = read('public/prompt-library-command-palette.ts');
const hints = read('public/prompt-library-smart-fill-hints.ts');
const index = read('public/index.html');

// Each flow is asserted as the steps it takes, in whichever form the typed
// migration kept: inner `function x()` declarations became `const x = () =>`,
// and `closest()` calls are now typed and guarded by an instance check.
assertFunctionDeclared(smart, 'interceptUse');
const openFlow = [
  "event.target.closest<HTMLButtonElement>('.prompt-item-actions button')",
  "textContent?.trim() !== 'Kullan'",
  'variableNames(prompt.body).length',
  'event.preventDefault()',
  'event.stopImmediatePropagation()',
  'openFor(prompt)'
];
for (const token of openFlow) assert.ok(smart.includes(token), `open flow missing: ${token}`);

assertFunctionDeclared(smart, 'renderPreview');
const editFlow = [
  'currentValues()',
  'replaceVariables?.(activePrompt.body, values)',
  'preview.textContent',
  'input.addEventListener(\'input\', renderPreview)'
];
for (const token of editFlow) assert.ok(smart.includes(token), `preview flow missing: ${token}`);

// Saving a preset is the save button's own handler rather than a named
// function, so the flow is asserted through the writer it calls.
const presetFlow = [
  "save.addEventListener('click'",
  'readPresets(activePrompt.id)',
  'writePresets(activePrompt.id',
  'persistPresetBar()',
  'found.values[name]'
];
for (const token of presetFlow) assert.ok(smart.includes(token), `preset flow missing: ${token}`);

assertFunctionDeclared(smart, 'insertIntoComposer');
const insertFlow = [
  'const missing = activeNames.filter((name) => values[name].trim().length === 0)',
  'if (missing.length) return showError(',
  'composer.value = text',
  "new Event('input', { bubbles: true })",
  'composer.focus()',
  'closeDialog()'
];
for (const token of insertFlow) assert.ok(smart.includes(token), `insert flow missing: ${token}`);
assert.doesNotMatch(smart,/requestSubmit\s*\(/);
assert.doesNotMatch(smart,/\.submit\s*\(/);

assertFunctionDeclared(palette, 'onInput');
assertFunctionDeclared(palette, 'readTrigger');
const paletteFlow = [
  "input.value.slice(0, cursor).match(/(^|\\s)\\/prompt",
  'activeIndex = 0',
  'render()',

  "event.key === 'Enter'",
  "event.key === 'Escape'",
  'insert(item)'
];
assertFunctionDeclared(palette, 'move');
for (const token of paletteFlow) assert.ok(palette.includes(token), `palette flow missing: ${token}`);

assertFunctionDeclared(hints, 'paint');
assert.match(hints,/nextElementSibling/);
assert.match(hints,/requestAnimationFrame/);

for (const asset of [
  'prompt-library-smart-fill.css',
  'prompt-library-command-palette.css',
  '/typed-build/prompt-library-smart-fill.js',
  '/typed-build/prompt-library-command-palette.js',
  '/typed-build/prompt-library-smart-fill-hints.js'
]) assert.ok(index.includes(asset), `missing asset: ${asset}`);

assert.ok(index.indexOf('prompt-library.js') < index.indexOf('prompt-library-smart-fill.js'));
assert.ok(index.indexOf('prompt-library-smart-fill.js') < index.indexOf('prompt-library-command-palette.js'));
assert.ok(index.indexOf('prompt-library-command-palette.js') < index.indexOf('prompt-library-smart-fill-hints.js'));

for (const source of [smart,palette,hints]) {
  assert.doesNotMatch(source,/fetch\s*\(/);
  assert.doesNotMatch(source,/XMLHttpRequest/);
  assert.doesNotMatch(source,/WebSocket/);
  assert.doesNotMatch(source,/navigator\.sendBeacon/);
  assert.doesNotMatch(source,/innerHTML\s*=/);
  assert.doesNotMatch(source,/outerHTML/);
}

console.log('prompt smart-fill user journey: ok');
