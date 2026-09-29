import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const index = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'public/sw-policy.js'), 'utf8');

assert.match(index, /href="\/model-preferences\.css"/);
assert.match(index, /typed-build\/app-shell\.js/);
assert.match(sw, /CURRENT_CACHE = .*[v]45/);
assert.match(sw, /'\/model-preferences\.css'/);
assert.match(sw, /SHELL_ASSETS/);
assert.ok(sw.includes("pathname.startsWith('/api/')"));
console.log('model preferences pwa contract ok');
