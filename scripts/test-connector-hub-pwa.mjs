import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assertBundledModule } from './legacy-bundle-contract.mjs';

const sw = await readFile('public/sw-policy.ts', 'utf8');
const index = await readFile('public/index.html', 'utf8');

assert.match(sw, /['"]\/connector-hub\.css['"]/);
// `connector-hub` ships inside the legacy-app bundle; assertBundledModule checks its real URL below.
assert.match(sw, /SHELL_ASSETS/);
assert.match(sw, /pathname\.startsWith\(['"]\/api\//);
assert.match(sw, /network-only/);
assert.match(index, /connector-hub\.css/);
assertBundledModule('connector-hub');

const apiAssetPos = sw.indexOf('/api/');
const hubAssetPos = sw.indexOf('/connector-hub.js');
assert.ok(apiAssetPos >= 0 && hubAssetPos >= 0);
assert.ok(sw.includes('return \'network-only\'') || sw.includes('return "network-only"'));

console.log('connector hub PWA contract: passed');