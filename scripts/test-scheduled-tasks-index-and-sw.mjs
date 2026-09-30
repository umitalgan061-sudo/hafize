import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assertVersionedCacheDeclaration } from './shell-cache-contract.mjs';

const index = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const sw = await readFile(new URL('../public/sw-policy.js', import.meta.url), 'utf8');

const cssMatches = index.match(/<link rel="stylesheet" href="\/scheduled-tasks\.css"\s*\/>/g) || [];
// Two of the scheduled-task scripts became built TypeScript entries, so the
// count spans both forms rather than only the deferred classic scripts.
const jsMatches = index.match(/<script (?:type="module" )?src="\/(?:typed-build\/)?scheduled-tasks[a-z-]*\.js"(?: defer)?><\/script>/g) || [];
assert.equal(cssMatches.length, 1);
assert.match(index, /<script type="module" src="\/typed-build\/scheduled-tasks\.js"><\/script>/);
assert.match(index, /<script src="\/scheduled-tasks-enhancements\.js" defer><\/script>/);
assert.match(index, /<script src="\/scheduled-tasks-keyboard\.js" defer><\/script>/);
assert.match(index, /<script type="module" src="\/typed-build\/scheduled-tasks-countdown\.js"><\/script>/);
assert.ok(jsMatches.length >= 3);
assert.match(sw, /\/scheduled-tasks\.css/);
assert.match(sw, /\/typed-build\/scheduled-tasks\.js/);
assert.match(sw, /\/scheduled-tasks-enhancements\.js/);
assert.match(sw, /\/scheduled-tasks-keyboard\.js/);
assert.match(sw, /\/scheduled-tasks-countdown\.js/);
assertVersionedCacheDeclaration(sw);
assert.match(sw, /pathname\.startsWith\('\/api\/'\)/);
assert.match(sw, /network-only/);
console.log('scheduled task shell integration: ok');
