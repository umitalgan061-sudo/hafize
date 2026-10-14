import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assertVersionedCacheDeclaration } from './shell-cache-contract.mjs';
import { assertBrowserModuleShipped } from './browser-bundle-contract.mjs';

const index = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const sw = await readFile(new URL('../public/sw-policy.ts', import.meta.url), 'utf8');

const cssMatches = index.match(/<link rel="stylesheet" href="\/scheduled-tasks\.css"\s*\/>/g) || [];
const jsMatches = index.match(/<script src="\/scheduled-tasks-[a-z-]+\.js" defer><\/script>/g) || [];
assert.equal(cssMatches.length, 1);
assert.match(index, /<script src="\/scheduled-tasks\.js" defer><\/script>/);
assertBrowserModuleShipped('scheduled-tasks-enhancements');
assertBrowserModuleShipped('scheduled-tasks-keyboard');
assertBrowserModuleShipped('scheduled-tasks-countdown');
assert.ok(jsMatches.length >= 3);
assert.match(sw, /\/scheduled-tasks\.css/);
assert.match(sw, /\/scheduled-tasks\.js/);
assertVersionedCacheDeclaration(sw);
assert.match(sw, /pathname\.startsWith\('\/api\/'\)/);
assert.match(sw, /network-only/);
console.log('scheduled task shell integration: ok');
