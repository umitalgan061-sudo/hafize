import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assertModuleShipped, assertStylesheetShipped } from './shell-cache-contract.mjs';

const sw = await readFile('public/sw-policy.ts', 'utf8');
const index = await readFile('public/index.html', 'utf8');

assertStylesheetShipped('/connector-hub.css');
assertModuleShipped('connector-hub');
assert.match(sw, /SHELL_ASSETS/);
assert.match(sw, /pathname\.startsWith\(['"]\/api\//);
assert.match(sw, /network-only/);

const apiAssetPos = sw.indexOf('/api/');
const hubAssetPos = sw.indexOf('/typed-build/legacy-app.js');
assert.ok(apiAssetPos >= 0 && hubAssetPos >= 0);
assert.ok(sw.includes('return \'network-only\'') || sw.includes('return "network-only"'));

console.log('connector hub PWA contract: passed');