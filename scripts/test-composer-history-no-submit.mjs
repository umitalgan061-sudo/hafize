import assert from 'node:assert/strict';
import fs from 'node:fs';
const panel = fs.readFileSync('public/composer-history-panel.js', 'utf8');
const backup = fs.readFileSync('public/composer-history-backup.js', 'utf8');
for (const source of [panel, backup]) {
  assert.doesNotMatch(source, /\.submit\(\)/);
  assert.doesNotMatch(source, /dispatchEvent\([^)]*submit/);
}
assert.match(panel, /composer\.value/);
assert.match(panel, /composer\.dispatchEvent/);
console.log('composer history no-submit: ok');
