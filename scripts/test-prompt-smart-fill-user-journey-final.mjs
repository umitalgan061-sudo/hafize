import assert from 'node:assert/strict';
import { assertAnchors, declarationPattern, readSource } from './source-contract.mjs';

const source = readSource('public/prompt-library-smart-fill.ts');
const index = readSource('public/index.html');

const journey = [
  ['open', declarationPattern('mount')],
  ['variable detection', declarationPattern('variableNames')],
  ['field rendering', /activeInputs = new Map/],
  ['live preview', declarationPattern('renderPreview')],
  ['preset load', declarationPattern('presetSelectOptions')],
  ['preset save', declarationPattern('savePreset')],
  ['copy', declarationPattern('copyPreview')],
  ['insert', declarationPattern('insertIntoComposer')],
  ['keyboard escape', /event\.key === 'Escape'/],
  ['focus trap', /focusables = \[\.\.\.dialog\.querySelectorAll/],
  ['use interception', declarationPattern('interceptUse')],
  ['no auto-send', /dispatchEvent\(new Event\('input'/]
];

assertAnchors(source, journey, 'journey step');
assert.match(index, /prompt-library-smart-fill/);
assert.ok(source.indexOf('insertIntoComposer') < source.indexOf('interceptUse'));
assert.ok(source.indexOf('event.preventDefault();') >= 0 && source.indexOf('event.stopImmediatePropagation();') >= 0);
assert.ok(source.indexOf('composer.dispatchEvent') >= 0);
assert.doesNotMatch(source, /form\.submit\(/);
assert.doesNotMatch(source, /click\(\)\s*;\s*send/i);

const boundaries = source.match(/MAX_[A-Z_]+\s*=\s*\d+/g) || [];
assert.ok(boundaries.length >= 4);
assert.ok(boundaries.some((entry) => entry.includes('1000')));
assert.ok(boundaries.some((entry) => entry.includes('12')));
assert.ok(boundaries.some((entry) => entry.includes('6')));

console.log('prompt smart-fill final user journey ok');
