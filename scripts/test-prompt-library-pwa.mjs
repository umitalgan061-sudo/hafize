import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const sw = fs.readFileSync(new URL('../public/sw-policy.js', import.meta.url), 'utf8');
assert.match(html, /\/prompt-library\.css/);
assert.match(html, /\/prompt-library\.js/);
assert.match(html, /\/prompt-library-starters\.js/);
assert.match(sw, /\/prompt-library\.css/);
assert.match(sw, /\/prompt-library\.js/);
assert.match(sw, /CURRENT_CACHE = `\$\{CACHE_PREFIX\}v24`/);
console.log('test-prompt-library-pwa: ok');
