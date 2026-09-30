import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { assertMinimumCacheVersion } from './shell-cache-contract.mjs';

const root = process.cwd();
const index = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'public/sw-policy.js'), 'utf8');

assert.match(index, /href="\/model-preferences\.css"/);
assert.match(index, /typed-build\/app-shell\.js/);
assertMinimumCacheVersion(45, 'model preferences shell cache');
assert.match(sw, /'\/model-preferences\.css'/);
assert.match(sw, /SHELL_ASSETS/);
assert.ok(sw.includes("pathname.startsWith('/api/')"));
console.log('model preferences pwa contract ok');
