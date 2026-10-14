import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assertBrowserModuleShipped } from './browser-bundle-contract.mjs';

const sw = await readFile('public/sw-policy.ts', 'utf8');
const index = await readFile('public/index.html', 'utf8');

assert.match(sw, /['"]\/connector-hub\.css['"]/);
assertBrowserModuleShipped('connector-hub');
assert.match(sw, /SHELL_ASSETS/);
assert.match(sw, /pathname\.startsWith\(['"]\/api\//);
assert.match(sw, /network-only/);
assert.match(index, /connector-hub\.css/);

const apiAssetPos = sw.indexOf('/api/');
const hubAssetPos = sw.indexOf('/typed-build/legacy-app.js');
assert.ok(apiAssetPos >= 0 && hubAssetPos >= 0);
assert.ok(sw.includes('return \'network-only\'') || sw.includes('return "network-only"'));

console.log('connector hub PWA contract: passed');