// Source safety for the composer history modules.
//
// Submission history is device-local, so none of these files may ship an HTML
// sink or a network call. The rendering modules additionally have to build their
// DOM through `textContent`; the core module holds no DOM code at all, so
// requiring `textContent` there asserted the wrong thing and could only be
// satisfied by adding dead code.

import assert from 'node:assert/strict';
import fs from 'node:fs';

const CORE = 'public/composer-history.js';
const RENDERING = [
  'public/composer-history-panel.js',
  'public/composer-history-backup.js',
  'public/composer-history-settings.js',
  'public/composer-history-help.js'
];

const read = (file) => fs.readFileSync(file, 'utf8');

// No module may use an HTML sink or talk to the network.
for (const file of [CORE, ...RENDERING]) {
  const source = read(file);
  assert.doesNotMatch(source, /\.innerHTML\s*=/, `${file} assigns innerHTML`);
  assert.doesNotMatch(source, /outerHTML/, `${file} uses outerHTML`);
  assert.doesNotMatch(source, /insertAdjacentHTML/, `${file} uses insertAdjacentHTML`);
  assert.doesNotMatch(source, /document\.write/, `${file} uses document.write`);
  assert.doesNotMatch(source, /eval\(/, `${file} uses eval`);
  assert.doesNotMatch(source, /new Function\(/, `${file} builds a function from source`);
  assert.doesNotMatch(source, /fetch\s*\(/, `${file} calls fetch`);
  assert.doesNotMatch(source, /XMLHttpRequest/, `${file} uses XMLHttpRequest`);
  assert.doesNotMatch(source, /WebSocket/, `${file} opens a WebSocket`);
  assert.doesNotMatch(source, /navigator\.sendBeacon/, `${file} calls sendBeacon`);
  assert.doesNotMatch(source, /document\.cookie/, `${file} reads cookies`);
}

// Every module that renders history text does so as text, never as markup.
for (const file of RENDERING) {
  const source = read(file);
  assert.match(source, /textContent/, `${file} renders through textContent`);
}

// The core module stays free of DOM construction, so the storage contract can be
// unit tested without a document.
const core = read(CORE);
assert.doesNotMatch(core, /createElement\(/, 'the core module builds no DOM');

console.log('composer history source safety: ok');
