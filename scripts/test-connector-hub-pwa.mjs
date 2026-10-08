import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assertLegacyModulesBundled } from './legacy-bundle-contract.mjs';

const sw = await readFile('public/sw-policy.ts', 'utf8');
const index = await readFile('public/index.html', 'utf8');

assert.match(sw, /['"]\/connector-hub\.css['"]/);
assert.match(sw, /SHELL_ASSETS/);
assert.match(sw, /pathname\.startsWith\(['"]\/api\//);
assert.match(sw, /network-only/);
assert.match(index, /connector-hub\.css/);

assert.ok(sw.indexOf('/api/') >= 0, 'the classifier guard still names the API prefix');
assert.ok(sw.includes('return \'network-only\'') || sw.includes('return "network-only"'));

assertLegacyModulesBundled(['connector-hub']);
console.log('connector hub PWA contract: passed');