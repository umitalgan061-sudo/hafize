import assert from 'node:assert/strict';
import fs from 'node:fs';
const sw = fs.readFileSync('public/sw-policy.js', 'utf8');
const loader = fs.readFileSync('public/prompt-library-enhancements.js', 'utf8');
assert.match(sw, /\/prompt-library-revision-checkpoint\.js/);
assert.match(sw, /CURRENT_CACHE = `\$\{CACHE_PREFIX\}v32`/);
assert.match(loader, /data-hafize-prompt-revision-checkpoint/);
assert.match(loader, /prompt-library-revision-checkpoint\.js/);
console.log('checkpoint PWA integration: ok');
