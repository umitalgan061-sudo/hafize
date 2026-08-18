import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const listSource = await readFile(new URL('../public/schedule-list.js', import.meta.url), 'utf8');
const filterSource = await readFile(new URL('../public/schedule-list-filter.js', import.meta.url), 'utf8');
const swSource = await readFile(new URL('../public/sw-policy.js', import.meta.url), 'utf8');

for (const source of [listSource, filterSource]) {
  for (const forbidden of [
    'localStorage', 'sessionStorage', 'indexedDB', 'document.cookie', 'navigator.clipboard',
    'Authorization:', 'Bearer ', 'WebSocket(', 'EventSource(', 'sendBeacon(',
    'child_process', 'exec(', 'spawn(', 'shell: true', 'shell=True', 'innerHTML =', 'outerHTML ='
  ]) assert.equal(source.includes(forbidden), false, `scope UI introduced forbidden surface: ${forbidden}`);
}

assert.match(listSource, /credentials: 'same-origin'/);
assert.match(listSource, /cache: 'no-store'/);
assert.match(listSource, /method: 'GET'/);
assert.match(listSource, /view: 'summary', scope: selectedScope/);
assert.match(listSource, /requestScope !== currentScope/);
assert.match(listSource, /resetPagination\(\)/);
assert.match(listSource, /pendingScope/);
assert.match(filterSource, /new root\.CustomEvent\(SCOPE_EVENT, \{ detail \}\)/);
assert.match(filterSource, /Yüklü görev veya ajan ara/);
assert.match(filterSource, /refs\.count\.hidden = serverScope !== 'all'/);
assert.match(swSource, /hafize-shell-v86/);
assert.match(swSource, /if \(pathname\.startsWith\('\/api\/'\)\) return 'network-only'/);

const registry = JSON.parse(await readFile(new URL('../agents/registry.json', import.meta.url), 'utf8'));
assert.equal(registry.agents.length, 4);
assert.equal(registry.policy.externalWritesRequireApproval, true);
assert.equal(registry.policy.secretsNeverEnterAgentContext, true);
assert.equal(registry.policy.sharedTraceIdRequired, true);
for (const agent of registry.agents) assert.equal(agent.toolPolicy.default, 'deny');

console.log('schedule list scope UI security tests passed');
