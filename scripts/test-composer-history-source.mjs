import assert from 'node:assert/strict';
import fs from 'node:fs';

// `composer-history.js` is the storage/keyboard core and renders no DOM of its
// own, so only the view modules are held to the textContent rule.
const MODULES = [
  'public/composer-history.js',
  'public/composer-history-panel.js',
  'public/composer-history-backup.js',
  'public/composer-history-settings.js'
];
const RENDERS_DOM = new Set([
  'public/composer-history-panel.js',
  'public/composer-history-backup.js',
  'public/composer-history-settings.js'
]);

for (const file of MODULES) {
  const source = fs.readFileSync(file, 'utf8');
  assert.doesNotMatch(source, /\.innerHTML\s*=/, `${file} never assigns innerHTML`);
  assert.doesNotMatch(source, /outerHTML/, `${file} never touches outerHTML`);
  if (RENDERS_DOM.has(file)) assert.match(source, /textContent/, `${file} writes text through textContent`);
  assert.doesNotMatch(source, /fetch\s*\(/, `${file} stays offline`);
  assert.doesNotMatch(source, /XMLHttpRequest/, `${file} stays offline`);
}
console.log('composer history source safety: ok');
