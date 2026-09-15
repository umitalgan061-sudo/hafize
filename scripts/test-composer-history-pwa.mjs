import assert from 'node:assert/strict';
import fs from 'node:fs';
const html = fs.readFileSync('public/index.html', 'utf8');
const sw = fs.readFileSync('public/sw-policy.js', 'utf8');
for (const asset of ['/composer-history.css','/composer-history.js','/composer-history-panel.js','/composer-history-backup.js','/composer-history-help.js','/composer-history-settings.js']) {
  assert.match(html, new RegExp(asset.replaceAll('/','\\/')));
  assert.match(sw, new RegExp(asset.replaceAll('/','\\/')));
}
assert.match(sw, /hafize-shell-v30/);
assert.doesNotMatch(sw, /'\/api\//);
console.log('composer history PWA contract: ok');
