import assert from 'node:assert/strict';
import fs from 'node:fs';
for (const file of ['public/composer-history.js','public/composer-history-panel.js','public/composer-history-backup.js','public/composer-history-settings.js']) {
  const source = fs.readFileSync(file, 'utf8');
  assert.doesNotMatch(source, /\.innerHTML\s*=/);
  assert.doesNotMatch(source, /outerHTML/);
  assert.match(source, /textContent/);
  assert.doesNotMatch(source, /fetch\s*\(/);
  assert.doesNotMatch(source, /XMLHttpRequest/);
}
console.log('composer history source safety: ok');
