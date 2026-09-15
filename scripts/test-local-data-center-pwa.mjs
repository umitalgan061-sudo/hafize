import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('public/index.html', 'utf8');
const sw = fs.readFileSync('public/sw-policy.js', 'utf8');
assert.match(html, /local-data-center\.css/);
assert.match(html, /local-data-center\.js/);
assert.match(sw, /local-data-center\.css/);
assert.match(sw, /local-data-center\.js/);
assert.match(sw, /CURRENT_CACHE = .*v(\\d+)/);
assert.doesNotMatch(sw, /\/api\\//.*local-data-center/);
console.log('local data center PWA: ok');
