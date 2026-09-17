import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const smart = read('public/prompt-library-smart-fill.ts');
const palette = read('public/prompt-library-command-palette.ts');
const hints = read('public/prompt-library-smart-fill-hints.ts');
const index = read('public/index.html');

const openFlow = [
  'const interceptUse',
  "closest<HTMLButtonElement>('.prompt-item-actions button')",
  "textContent?.trim() !== 'Kullan'",
  'variableNames(prompt.body)',
  'event.preventDefault()',
  'event.stopImmediatePropagation()',
  'openFor(prompt)'
];
for (const token of openFlow) assert.ok(smart.includes(token), `open flow missing: ${token}`);

const editFlow = [
  'const renderPreview',
  'currentValues()',
  'replaceVariables?.(activePrompt.body, values)',
  'preview.textContent',
  'input.addEventListener(\'input\', renderPreview)'
];
for (const token of editFlow) assert.ok(smart.includes(token), `preview flow missing: ${token}`);

const presetFlow = [
  'const savePreset',
  'readPresets(activePrompt.id)',
  'writePresets(activePrompt.id',
  'renderPresetBar()',
  'found.values[name]'
];
for (const token of presetFlow) assert.ok(smart.includes(token), `preset flow missing: ${token}`);

const insertFlow = [
  'const insertIntoComposer',
  'activeNames.filter',
  "(values[name] ?? '').trim().length === 0",
  'showError(`Doldurulmamış değişkenler',
  'composer.value = text',
  "new Event('input', { bubbles: true })",
  'composer.focus()',
  'closeDialog()'
];
for (const token of insertFlow) assert.ok(smart.includes(token), `insert flow missing: ${token}`);
assert.doesNotMatch(smart,/requestSubmit\s*\(/);
assert.doesNotMatch(smart,/\.submit\s*\(/);

const paletteFlow = [
  'const onInput',
  "input.value.slice(0, cursor).match(/(^|\\s)\\/prompt",
  'activeIndex = 0',
  'render()',
  'const move',
  "event.key === 'Enter'",
  "event.key === 'Escape'",
  'insert(item)'
];
for (const token of paletteFlow) assert.ok(palette.includes(token), `palette flow missing: ${token}`);

assert.match(hints,/function paintSmartFillHints\(panel/);
assert.match(hints,/nextElementSibling/);
assert.match(hints,/requestAnimationFrame/);

for (const asset of [
  'prompt-library-smart-fill.css',
  'prompt-library-command-palette.css',
  'prompt-library-smart-fill.js',
  'prompt-library-command-palette.js',
  'prompt-library-smart-fill-hints.js'
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
