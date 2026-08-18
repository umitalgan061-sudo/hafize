import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../public/schedule-list.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../public/schedule-list.css', import.meta.url), 'utf8');
const swPolicy = await readFile(new URL('../public/sw-policy.js', import.meta.url), 'utf8');

assert.match(source, /const PAGE_SIZE = 100;/);
assert.match(source, /const MAX_ITEMS = 500;/);
assert.match(source, /Daha eski görevleri yükle/);
assert.match(source, /response\.status === 409/);
assert.match(source, /SCHEDULE_LIST_SNAPSHOT_CHANGED/);
assert.match(source, /resetPagination\(\)/);
assert.match(source, /loadPage\(\{ append: false, reason: 'snapshot-changed' \}\)/);
assert.match(source, /credentials: 'same-origin'/);
assert.match(source, /cache: 'no-store'/);
assert.doesNotMatch(source, /method:\s*['"](?:POST|PUT|PATCH|DELETE)['"]/);
assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB|document\.cookie|navigator\.clipboard/);
assert.doesNotMatch(source, /innerHTML|insertAdjacentHTML|outerHTML/);
assert.doesNotMatch(source, /Authorization|Bearer|access[_-]?token|refresh[_-]?token/i);
assert.doesNotMatch(source, /WebSocket|EventSource|sendBeacon|XMLHttpRequest/);

const appendGuard = source.indexOf("if (append && (nextOffset === null || snapshot === null || loadedItems.length >= MAX_ITEMS)) return false;");
const networkCall = source.indexOf('const response = await client.list({ offset: requestOffset, snapshot: requestSnapshot });');
assert.ok(appendGuard >= 0 && networkCall > appendGuard, 'bounded append guard must run before network');

const staleBranch = source.indexOf("response.payload?.error === 'SCHEDULE_LIST_SNAPSHOT_CHANGED'");
const staleReset = source.indexOf('resetPagination();', staleBranch);
const staleReload = source.indexOf("loadPage({ append: false, reason: 'snapshot-changed' })", staleBranch);
assert.ok(staleBranch >= 0 && staleReset > staleBranch && staleReload > staleReset, '409 must clear old pages before reloading first page');

assert.match(css, /\.schedule-list-more/);
assert.match(css, /min-height:\s*44px/);
assert.match(css, /schedule-list-status\[data-state="stale"\]/);
assert.match(css, /prefers-reduced-motion:\s*reduce/);
assert.match(css, /forced-colors:\s*active/);

assert.match(swPolicy, /hafize-shell-v83/);
assert.match(swPolicy, /'\/schedule-list\.js'/);
assert.match(swPolicy, /'\/schedule-list\.css'/);
assert.match(swPolicy, /if \(pathname\.startsWith\('\/api\/'\)\) return 'network-only';/);

const registry = JSON.parse(await readFile(new URL('../agents/registry.json', import.meta.url), 'utf8'));
assert.equal(registry.agents.length, 4);
assert.equal(registry.policy?.externalWritesRequireApproval, true);
assert.equal(registry.policy?.secretsNeverEnterAgentContext, true);
for (const agent of registry.agents) assert.equal(agent.tools?.default, 'deny');

console.log('schedule list load-more integration tests passed');
