import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const index = await readFile(path.join(root, 'public', 'index.html'), 'utf8');
const sw = await readFile(path.join(root, 'public', 'sw-policy.js'), 'utf8');

const coreIndex = index.indexOf('/prompt-library-health.js');
const extraIndex = index.indexOf('/prompt-library-health-enhancements.js');
assert.ok(coreIndex >= 0);
assert.ok(extraIndex > coreIndex);
assert.match(index, /prompt-library-health\.css/);
assert.match(index, /prompt-library-health\.js/);
assert.match(index, /prompt-library-health-enhancements\.js/);
assert.match(sw, /prompt-library-health\.js/);
assert.match(sw, /prompt-library-health-enhancements\.js/);
assert.match(sw, /CURRENT_CACHE\s*=\s*`\$\{CACHE_PREFIX\}v38`/);
console.log('prompt library health integration: ok');
