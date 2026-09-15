import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const index = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const sw = await readFile(new URL('../public/sw-policy.js', import.meta.url), 'utf8');

const cssMatches = index.match(/<link rel="stylesheet" href="\/scheduled-tasks\.css"\s*\/>/g) || [];
const jsMatches = index.match(/<script src="\/scheduled-tasks-[a-z-]+\.js" defer><\/script>/g) || [];
assert.equal(cssMatches.length, 1);
assert.match(index, /<script src="\/scheduled-tasks\.js" defer><\/script>/);
assert.match(index, /<script src="\/scheduled-tasks-enhancements\.js" defer><\/script>/);
assert.match(index, /<script src="\/scheduled-tasks-keyboard\.js" defer><\/script>/);
assert.match(index, /<script src="\/scheduled-tasks-countdown\.js" defer><\/script>/);
assert.ok(jsMatches.length >= 3);
assert.match(sw, /\/scheduled-tasks\.css/);
assert.match(sw, /\/scheduled-tasks\.js/);
assert.match(sw, /\/scheduled-tasks-enhancements\.js/);
assert.match(sw, /\/scheduled-tasks-keyboard\.js/);
assert.match(sw, /\/scheduled-tasks-countdown\.js/);
assert.match(sw, /CURRENT_CACHE = `\$\{CACHE_PREFIX\}v32`/);
assert.match(sw, /pathname\.startsWith\('\/api\/'\)/);
assert.match(sw, /network-only/);
console.log('scheduled task shell integration: ok');
