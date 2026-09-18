import assert from 'node:assert/strict';
import fs from 'node:fs';

const sw = fs.readFileSync('public/sw-policy.js', 'utf8');
const usage = fs.readFileSync('public/prompt-library-usage.js', 'utf8');
for (const asset of [
  'prompt-library-fill-history-backup.js',
  'prompt-library-fill-history-backup-ui.js',
  'prompt-library-fill-session-ui.js',
  'prompt-library-fill-copy.js'
]) {
  assert.match(sw, new RegExp(asset));
  assert.match(usage, new RegExp(asset));
}
assert.match(sw, /CURRENT_CACHE.*v40/);
console.log('smart fill final PWA namespace wiring: ok');
