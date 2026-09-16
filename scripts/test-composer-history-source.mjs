import assert from 'node:assert/strict';
import fs from 'node:fs';

const ALL = [
  'public/composer-history.js',
  'public/composer-history-panel.js',
  'public/composer-history-backup.js',
  'public/composer-history-settings.js',
  'public/composer-history-help.js'
];
// The core module never renders: it only reads and writes the composer's value.
const RENDERING = ALL.filter((file) => file !== 'public/composer-history.js');

for (const file of ALL) {
  const source = fs.readFileSync(file, 'utf8');
  assert.doesNotMatch(source, /\.innerHTML\s*=/, `${file} assigns innerHTML`);
  assert.doesNotMatch(source, /outerHTML/, `${file} uses outerHTML`);
  assert.doesNotMatch(source, /insertAdjacentHTML/, `${file} uses insertAdjacentHTML`);
  assert.doesNotMatch(source, /document\.write/, `${file} uses document.write`);
  assert.doesNotMatch(source, /eval\(/, `${file} evaluates strings`);
  // Composer history is device-local: nothing here talks to the network.
  assert.doesNotMatch(source, /fetch\s*\(/, `${file} calls fetch`);
  assert.doesNotMatch(source, /XMLHttpRequest/, `${file} uses XMLHttpRequest`);
  assert.doesNotMatch(source, /WebSocket/, `${file} opens a WebSocket`);
  assert.doesNotMatch(source, /navigator\.sendBeacon/, `${file} beacons data out`);
}

for (const file of RENDERING) {
  assert.match(fs.readFileSync(file, 'utf8'), /textContent/, `${file} should write text with textContent`);
}

console.log('composer history source safety: ok');
