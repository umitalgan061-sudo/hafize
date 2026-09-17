import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { migratedEntryUrl, readMigratedSource } from './migrated-entry-contract.mjs';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const smart = readMigratedSource('prompt-library-smart-fill');
const palette = readMigratedSource('prompt-library-command-palette');
const hints = readMigratedSource('prompt-library-smart-fill-hints');
const index = read('public/index.html');

// Each journey step is matched with a whitespace-tolerant pattern so that
// reformatting the source is not a contract change.
const assertFlow = (source, label, patterns) => {
  for (const pattern of patterns) assert.match(source, pattern, `${label} missing: ${pattern}`);
};

assertFlow(smart, 'open flow', [
  /const interceptUse = \(event: MouseEvent\)/,
  /closest<HTMLButtonElement>\('\.prompt-item-actions button'\)/,
  /textContent\?\.trim\(\) !== 'Kullan'/,
  /variableNames\(prompt\.body\)/,
  /event\.preventDefault\(\)/,
  /event\.stopImmediatePropagation\(\)/,
  /openFor\(prompt\)/
]);

assertFlow(smart, 'preview flow', [
  /const renderPreview = \(\): void =>/,
  /currentValues\(\)/,
  /replaceVariables\?\.\(activePrompt\.body, values\)/,
  /preview\.textContent/,
  /input\.addEventListener\('input', renderPreview\)/
]);

assertFlow(smart, 'preset flow', [
  /save\.addEventListener\('click'/,
  /readPresets\(activePrompt\.id\)/,
  /writePresets\(activePrompt\.id/,
  /persistPresetBar\(\)/,
  /found\.values\[name\]/
]);

assertFlow(smart, 'insert flow', [
  /const insertIntoComposer = \(\): void =>/,
  /const missing = activeNames\.filter\(/,
  /\(values\[name\] \?\? ''\)\.trim\(\)\.length === 0/,
  /Doldurulmamış değişkenler/,
  /composer\.value = text/,
  /new Event\('input', \{ bubbles: true \}\)/,
  /composer\.focus\(\)/,
  /closeDialog\(\)/
]);
assert.doesNotMatch(smart, /requestSubmit\s*\(/);
assert.doesNotMatch(smart, /\.submit\s*\(/);

assertFlow(palette, 'palette flow', [
  /const onInput = \(\): void =>/,
  /input\.value\.slice\(0, cursor\)\.match\(\/\(\^\|\\s\)\\\/prompt/,
  /activeIndex = 0/,
  /render\(\)/,
  /const move = \(delta: number\): void =>/,
  /event\.key === 'Enter'/,
  /event\.key === 'Escape'/,
  /insert\(item\)/
]);

assert.match(hints, /export function paintSmartFillHints\(panel: HTMLElement\)/);
assert.match(hints, /nextElementSibling/);
assert.match(hints, /requestAnimationFrame/);

for (const asset of [
  '/prompt-library-smart-fill.css',
  '/prompt-library-command-palette.css',
  migratedEntryUrl('prompt-library-smart-fill'),
  migratedEntryUrl('prompt-library-command-palette'),
  migratedEntryUrl('prompt-library-smart-fill-hints')
]) assert.ok(index.includes(asset), `missing asset: ${asset}`);

// The core library defines the API the typed entries bridge to, so it loads
// first, and the entries keep their documented order among themselves.
assert.ok(index.indexOf('/prompt-library.js') < index.indexOf(migratedEntryUrl('prompt-library-smart-fill')));
assert.ok(index.indexOf(migratedEntryUrl('prompt-library-smart-fill')) < index.indexOf(migratedEntryUrl('prompt-library-command-palette')));
assert.ok(index.indexOf(migratedEntryUrl('prompt-library-command-palette')) < index.indexOf(migratedEntryUrl('prompt-library-smart-fill-hints')));

for (const source of [smart, palette, hints]) {
  assert.doesNotMatch(source, /fetch\s*\(/);
  assert.doesNotMatch(source, /XMLHttpRequest/);
  assert.doesNotMatch(source, /WebSocket/);
  assert.doesNotMatch(source, /navigator\.sendBeacon/);
  assert.doesNotMatch(source, /innerHTML\s*=/);
  assert.doesNotMatch(source, /outerHTML/);
}

console.log('prompt smart-fill user journey: ok');
