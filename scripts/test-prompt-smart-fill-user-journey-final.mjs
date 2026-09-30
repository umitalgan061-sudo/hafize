import assert from 'node:assert/strict';
import fs from 'node:fs';
import { assertFunctionDeclared } from './source-contract.mjs';

const source = fs.readFileSync('public/prompt-library-smart-fill.ts', 'utf8');
const index = fs.readFileSync('public/index.html', 'utf8');

// Preset loading, saving and copying are the handlers of their own buttons
// rather than named functions, so each step is asserted through the listener
// that runs it and the writer it calls.
for (const name of ['mount', 'variableNames', 'renderPreview', 'insertIntoComposer', 'interceptUse', 'trapKeydown']) {
  assertFunctionDeclared(source, name, `missing journey step: ${name}`);
}
const journey = [
  ['field rendering', /activeInputs = new Map/],
  ['preset load', /select\.addEventListener\('change'/],
  ['preset load applies values', /input\.value = found\.values\[name\] \|\| ''/],
  ['preset save', /save\.addEventListener\('click'/],
  ['preset save writes', /writePresets\(activePrompt\.id, \[next, \.\.\.readPresets\(activePrompt\.id\)\]\)/],
  ['copy', /copy\.addEventListener\('click', async \(\) => \{/],
  ['copy uses the clipboard', /navigator\?\.clipboard\?\.writeText\?\./],
  ['insert is wired', /insert\.addEventListener\('click', insertIntoComposer\)/],
  ['keyboard escape', /event\.key === 'Escape'/],
  ['focus trap', /focusables = \[\.\.\.dialog\.querySelectorAll/],
  ['no auto-send', /dispatchEvent\(new Event\('input'/]
];
for (const [name, pattern] of journey) assert.match(source, pattern, `missing journey step: ${name}`);
assert.match(index, /prompt-library-smart-fill/);
assert.ok(source.indexOf('insertIntoComposer') < source.indexOf('interceptUse'));
// The interception must preventDefault and stop propagation before opening,
// so the library's own "Kullan" handler never also runs.
const intercept = source.slice(source.indexOf('const interceptUse'));
assert.ok(intercept.indexOf('event.preventDefault();') >= 0);
assert.ok(intercept.indexOf('event.stopImmediatePropagation();') < intercept.indexOf('openFor(prompt);'));
assert.ok(source.indexOf('composer.dispatchEvent') >= 0);
assert.doesNotMatch(source, /form\.submit\(/);
assert.doesNotMatch(source, /click\(\)\s*;\s*send/i);

const boundaries = source.match(/MAX_[A-Z_]+\s*=\s*\d+/g) || [];
assert.ok(boundaries.length >= 4);
assert.ok(boundaries.some((entry) => entry.includes('1000')));
assert.ok(boundaries.some((entry) => entry.includes('12')));
assert.ok(boundaries.some((entry) => entry.includes('6')));

console.log('prompt smart-fill final user journey ok');
