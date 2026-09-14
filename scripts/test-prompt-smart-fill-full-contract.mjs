import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const core = read('public/prompt-library.js');
const smart = read('public/prompt-library-smart-fill.js');
const hints = read('public/prompt-library-smart-fill-hints.js');
const palette = read('public/prompt-library-command-palette.js');
const smartCss = read('public/prompt-library-smart-fill.css');
const paletteCss = read('public/prompt-library-command-palette.css');
const index = read('public/index.html');
const sw = read('public/sw-policy.js');

const coreContracts = [
  'hafize.prompt-library.v1',
  'normalizeItem',
  'normalizeCollection',
  'extractVariables',
  'replaceVariables',
  'loadItems',
  'saveItems',
  'useCount'
];
for (const token of coreContracts) assert.ok(core.includes(token), `core contract missing: ${token}`);

const smartContracts = [
  'HafizePromptLibrarySmartFill',
  'hafize.prompt-library.smart-fill.v1',
  'role',
  'aria-modal',
  'aria-labelledby',
  'aria-describedby',
  'aria-live',
  'role',
  'MAX_VALUE = 1000',
  'MAX_VARIABLES = 12',
  'MAX_PRESETS = 6',
  'MAX_PREVIEW = 8000',
  'readPresets',
  'writePresets',
  'variableNames',
  'renderPreview',
  'currentValues',
  'insertIntoComposer',
  'preventDefault',
  'stopImmediatePropagation',
  'replaceChildren',
  'textContent',
  'composer.value',
  'composer.dispatchEvent'
];
for (const token of smartContracts) assert.ok(smart.includes(token), `smart contract missing: ${token}`);
for (const forbidden of ['fetch(', 'XMLHttpRequest', 'WebSocket', 'navigator.sendBeacon', 'document.cookie', 'innerHTML =', 'outerHTML', 'requestSubmit(', 'form.submit(']) assert.ok(!smart.includes(forbidden), `smart forbidden token: ${forbidden}`);

const paletteContracts = [
  'PromptLibraryCommandPalette',
  'MAX_RESULTS = 12',
  'MAX_QUERY = 120',
  'function results(query)',
  'role',
  'listbox',
  'aria-selected',
  'ArrowDown',
  'ArrowUp',
  'Escape',
  'Enter',
  '/prompt',
  'HafizePromptLibrarySmartFill',
  'triggerStart'
];
for (const token of paletteContracts) assert.ok(palette.includes(token), `palette contract missing: ${token}`);
for (const forbidden of ['fetch(', 'XMLHttpRequest', 'WebSocket', 'navigator.sendBeacon']) assert.ok(!palette.includes(forbidden), `palette forbidden token: ${forbidden}`);

const hintContracts = ['HafizePromptSmartFillHints','MAX_VALUE = 1000','MAX_PREVIEW = 8000','MutationObserver','prompt-smart-fill-count','prompt-smart-fill-preview-count','disconnect()'];
for (const token of hintContracts) assert.ok(hints.includes(token), `hint contract missing: ${token}`);

for (const css of [smartCss, paletteCss]) {
  assert.match(css, /focus-visible/);
  assert.match(css, /forced-colors:active/);
  assert.match(css, /max-width:700px/);
}

for (const asset of [
  'prompt-library-smart-fill.css',
  'prompt-library-smart-fill.js',
  'prompt-library-smart-fill-hints.js',
  'prompt-library-command-palette.css',
  'prompt-library-command-palette.js'
]) {
  assert.ok(index.includes(asset), `index asset missing: ${asset}`);
  assert.ok(sw.includes(asset), `service worker asset missing: ${asset}`);
}
assert.match(sw,/CURRENT_CACHE = `\$\{CACHE_PREFIX\}v29`/);
assert.match(sw,/pathname\.startsWith\('\/api\/'\)/);
assert.match(sw,/return 'network-only'/);

assert.ok(index.indexOf('prompt-library.js') < index.indexOf('prompt-library-smart-fill.js'));
assert.ok(index.indexOf('prompt-library-smart-fill.js') < index.indexOf('prompt-library-command-palette.js'));
assert.ok(index.indexOf('prompt-library-command-palette.js') < index.indexOf('prompt-library-smart-fill-hints.js'));

console.log('prompt smart-fill full contract: ok');
