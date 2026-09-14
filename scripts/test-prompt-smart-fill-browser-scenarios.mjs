import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const smart = fs.readFileSync(path.join(root, 'public/prompt-library-smart-fill.js'), 'utf8');
const palette = fs.readFileSync(path.join(root, 'public/prompt-library-command-palette.js'), 'utf8');
const hints = fs.readFileSync(path.join(root, 'public/prompt-library-smart-fill-hints.js'), 'utf8');
const smartCss = fs.readFileSync(path.join(root, 'public/prompt-library-smart-fill.css'), 'utf8');
const paletteCss = fs.readFileSync(path.join(root, 'public/prompt-library-command-palette.css'), 'utf8');
const index = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');

const requiredSmartFlow = [
  'activePrompt = prompt',
  'activeNames = variableNames(prompt.body)',
  'renderPresetBar()',
  'renderPreview()',
  'insertIntoComposer()',
  'closeDialog()',
  'composer.value = text',
  "composer.dispatchEvent(new Event('input'"
];
for (const token of requiredSmartFlow) assert.match(smart, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

const requiredPaletteFlow = [
  'function results(query)',
  'MAX_RESULTS = 12',
  'MAX_QUERY = 120',
  'list.setAttribute(\'role\', \'listbox\')',
  "option.setAttribute('aria-selected'",
  'move(1)',
  'move(-1)',
  'insert(current[activeIndex])'
];
for (const token of requiredPaletteFlow) assert.match(palette, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

assert.match(hints, /prompt-smart-fill-count/);
assert.match(hints, /prompt-smart-fill-preview-count/);
assert.match(hints, /MutationObserver/);
assert.match(hints, /disconnect\(\)/);

assert.match(smartCss, /grid-template-columns/);
assert.match(smartCss, /max-height/);
assert.match(smartCss, /forced-colors:active/);
assert.match(paletteCss, /overflow:auto/);
assert.match(paletteCss, /forced-colors:active/);

for (const asset of [
  '/prompt-library-smart-fill.css',
  '/prompt-library-command-palette.css',
  '/prompt-library-smart-fill.js',
  '/prompt-library-command-palette.js',
  '/prompt-library-smart-fill-hints.js'
]) assert.ok(index.includes(asset), `missing index asset: ${asset}`);

assert.ok(index.indexOf('/prompt-library.js') < index.indexOf('/prompt-library-smart-fill.js'));
assert.ok(index.indexOf('/prompt-library-smart-fill.js') < index.indexOf('/prompt-library-command-palette.js'));
assert.ok(index.indexOf('/prompt-library-command-palette.js') < index.indexOf('/prompt-library-smart-fill-hints.js'));

for (const source of [smart, palette, hints]) {
  assert.doesNotMatch(source, /navigator\.sendBeacon/);
  assert.doesNotMatch(source, /fetch\s*\(/);
  assert.doesNotMatch(source, /XMLHttpRequest/);
  assert.doesNotMatch(source, /WebSocket/);
}

assert.match(smart, /role', 'dialog'/);
assert.match(smart, /role', 'alert'/);
assert.match(smart, /aria-live/);
assert.match(palette, /role', 'listbox'/);
assert.match(palette, /role', 'option'/);
console.log('prompt smart-fill browser scenarios: ok');
