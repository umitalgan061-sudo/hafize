import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const index = await readFile(path.join(root, 'public', 'index.html'), 'utf8');
const sw = await readFile(path.join(root, 'public', 'sw-policy.js'), 'utf8');

assert.match(index, /prompt-library-health\.css/);
assert.match(index, /prompt-library-health\.js/);
assert.match(sw, /prompt-library-health\.css/);
assert.match(sw, /prompt-library-health\.js/);
assert.match(sw, /CURRENT_CACHE\s*=\s*`\$\{CACHE_PREFIX\}v37`/);
assert.match(sw, /SHELL_PATHS/);
assert.match(sw, /pathname\.startsWith\('\/api\/'\)/);
assert.match(sw, /return 'network-only'/);
assert.doesNotMatch(sw, /\/api\/.*shell/);
console.log('prompt library health pwa: ok');
