import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../public/schedule-scope-counts-ui.js', import.meta.url), 'utf8');
const index = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const swPolicy = await readFile(new URL('../public/sw-policy.js', import.meta.url), 'utf8');

assert.match(source, /const COUNTS_PATH = '\/api\/schedules\?view=counts'/);
assert.match(source, /method: 'GET'/);
assert.match(source, /credentials: 'same-origin'/);
assert.match(source, /cache: 'no-store'/);
assert.match(source, /headers: \{ Accept: 'application\/json' \}/);
assert.doesNotMatch(source, /method:\s*['"](?:POST|PUT|PATCH|DELETE)['"]/);
assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB|document\.cookie|navigator\.clipboard/);
assert.doesNotMatch(source, /Authorization|Bearer|accessToken|refreshToken|clientSecret|ownerId|traceId/);
assert.doesNotMatch(source, /innerHTML|outerHTML|insertAdjacentHTML|DOMParser/);
assert.doesNotMatch(source, /child_process|exec\(|spawn\(|shell\s*:\s*true/);
assert.doesNotMatch(source, /fetch\(['"]https?:\/\//);
assert.match(source, /active \+ counts\.history !== counts\.all/);
assert.match(source, /counts\.failed > counts\.history/);
assert.match(source, /MAX_COUNT = 1_000_000/);
assert.match(source, /hafize:schedule-created/);
assert.match(source, /hafize:schedule-cancelled/);
assert.match(source, /hafize:schedule-rescheduled/);
assert.match(source, /generation \+= 1/);
assert.match(source, /removeEventListener/);

assert.match(index, /<script src="\/schedule-scope-counts-ui\.js" defer><\/script>/);
assert.equal((index.match(/schedule-scope-counts-ui\.js/g) || []).length, 1);
assert.match(swPolicy, /hafize-shell-`?v87|CACHE_PREFIX}\v87|CACHE_PREFIX\}v87/);
assert.match(swPolicy, /'\/schedule-scope-counts-ui\.js'/);
assert.match(swPolicy, /if \(pathname\.startsWith\('\/api\/'\)\) return 'network-only'/);

process.stdout.write('schedule scope counts UI security tests passed\n');
