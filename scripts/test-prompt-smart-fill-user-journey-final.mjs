import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('public/prompt-library-smart-fill.ts', 'utf8');
const index = fs.readFileSync('public/index.html', 'utf8');

const journey = [
  ['open', /function mount\(/],
  ['variable detection', /function variableNames\(/],
  ['field rendering', /activeInputs = new Map/],
  ['live preview', /const renderPreview = /],
  ['preset load', /const presetSelectOptions = /],
  ['preset save', /const savePreset = /],
  ['copy', /const copyPreview = async \(/],
  ['insert', /const insertIntoComposer = /],
  ['keyboard escape', /event\.key === 'Escape'/],
  ['focus trap', /focusables = \[\.\.\.dialog\.querySelectorAll/],
  ['use interception', /const interceptUse = /],
  ['no auto-send', /dispatchEvent\(new Event\('input'/]
];

for (const [name, pattern] of journey) assert.match(source, pattern, `missing journey step: ${name}`);
assert.match(index, /prompt-library-smart-fill/);
assert.ok(source.indexOf('insertIntoComposer') < source.indexOf('interceptUse'));
assert.match(source, /event\.preventDefault\(\);\s*\n?\s*event\.stopImmediatePropagation\(\);\s*\n?\s*openFor\(/);
assert.ok(source.indexOf('composer.dispatchEvent') >= 0);
assert.doesNotMatch(source, /form\.submit\(/);
assert.doesNotMatch(source, /click\(\)\s*;\s*send/i);

const boundaries = source.match(/MAX_[A-Z_]+\s*=\s*\d+/g) || [];
assert.ok(boundaries.length >= 4);
assert.ok(boundaries.some((entry) => entry.includes('1000')));
assert.ok(boundaries.some((entry) => entry.includes('12')));
assert.ok(boundaries.some((entry) => entry.includes('6')));

console.log('prompt smart-fill final user journey ok');
