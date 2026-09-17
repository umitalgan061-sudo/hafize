import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assertVersionedCacheDeclaration } from './shell-cache-contract.mjs';
import { assertMigratedEntryLoaded, migratedEntryUrl } from './migrated-entry-contract.mjs';

const index = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const sw = await readFile(new URL('../public/sw-policy.js', import.meta.url), 'utf8');

const cssMatches = index.match(/<link rel="stylesheet" href="\/scheduled-tasks\.css"\s*\/>/g) || [];
const jsMatches = index.match(/<script src="\/scheduled-tasks-[a-z-]+\.js" defer><\/script>/g) || [];
assert.equal(cssMatches.length, 1);
assert.match(index, /<script src="\/scheduled-tasks\.js" defer><\/script>/);
assert.match(index, /<script src="\/scheduled-tasks-enhancements\.js" defer><\/script>/);
assert.match(index, /<script src="\/scheduled-tasks-keyboard\.js" defer><\/script>/);
// The countdown moved to TypeScript, so the page loads its generated module.
assertMigratedEntryLoaded(index, 'scheduled-tasks-countdown');
// `scheduled-tasks-enhancements` and `-keyboard` are still classic deferred
// scripts; the countdown is asserted above as a generated module instead.
assert.ok(jsMatches.length >= 2, 'classic scheduled-tasks scripts are still loaded');
assert.match(sw, /\/scheduled-tasks\.css/);
assert.match(sw, /\/scheduled-tasks\.js/);
assert.match(sw, /\/scheduled-tasks-enhancements\.js/);
assert.match(sw, /\/scheduled-tasks-keyboard\.js/);
assert.ok(sw.includes(migratedEntryUrl('scheduled-tasks-countdown')));
assertVersionedCacheDeclaration(sw);
assert.match(sw, /pathname\.startsWith\('\/api\/'\)/);
assert.match(sw, /network-only/);
console.log('scheduled task shell integration: ok');
