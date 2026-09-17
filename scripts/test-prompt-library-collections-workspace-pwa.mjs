import assert from 'node:assert/strict';
import fs from 'node:fs';

const index = fs.readFileSync('public/index.html', 'utf8');
const sw = fs.readFileSync('public/sw-policy.js', 'utf8');

assert.match(index, /\/prompt-library-collections-workspace\.css/);
assert.match(index, /\/prompt-library-collections-workspace\.js/);
assert.match(sw, /CURRENT_CACHE = `\$\{CACHE_PREFIX\}v37`/);
assert.match(sw, /\/prompt-library-collections-workspace\.css/);
assert.match(sw, /\/prompt-library-collections-workspace\.js/);
assert.match(sw, /SHELL_PATHS = new Set\(SHELL_ASSETS\)/);
assert.match(sw, /pathname\.startsWith\('\/api\/'\)/);
assert.match(sw, /return 'network-only'/);
assert.match(sw, /request\.mode === 'navigate'/);

const cssPosition = index.indexOf('/prompt-library-collections-workspace.css');
const jsPosition = index.indexOf('/prompt-library-collections-workspace.js');
assert.ok(cssPosition > 0 && jsPosition > 0);

console.log('prompt collection workspace pwa: ok');
