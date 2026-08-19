import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../public/conversation-branch-lineage.js', import.meta.url), 'utf8');
const sandbox = { module: { exports: {} }, exports: {}, console, globalThis: {} };
vm.runInNewContext(source, sandbox, { filename: 'conversation-branch-lineage.js' });
const api = sandbox.module.exports;

const at = '2026-08-19T00:00:00.000Z';
const entry = (child, parent, index = 0, mode = 'fork') => ({
  childConversationId: child,
  parentConversationId: parent,
  sourceMessageId: `m-${index}`,
  mode,
  createdAt: at
});

assert.equal(api.MAX_DEPTH, 12);

const chain = [
  entry('c3', 'c2', 3),
  entry('c2', 'c1', 2, 'edit'),
  entry('c1', 'root', 1)
];
const normalized = api.normalizeEntries(chain);
assert.equal(normalized.length, 3);
const ancestry = api.resolveAncestry(normalized, 'c3');
assert.equal(ancestry.depth, 3);
assert.equal(ancestry.rootConversationId, 'root');
assert.deepEqual(Array.from(ancestry.entries, (item) => item.childConversationId), ['c3', 'c2', 'c1']);

const direct = api.resolveAncestry([entry('child', 'root', 1)], 'child');
assert.equal(direct.depth, 1);
assert.equal(direct.rootConversationId, 'root');

const root = api.resolveAncestry(chain, 'root');
assert.equal(root.depth, 0);
assert.equal(root.rootConversationId, 'root');

const cycle = api.normalizeEntries([
  entry('a', 'b', 1),
  entry('b', 'a', 2)
]);
assert.equal(cycle.length, 1);
assert.equal(cycle[0].childConversationId, 'a');
assert.equal(cycle[0].parentConversationId, 'b');

const longerCycle = api.normalizeEntries([
  entry('a', 'b', 1),
  entry('b', 'c', 2),
  entry('c', 'a', 3)
]);
assert.equal(longerCycle.length, 2);
assert.deepEqual(Array.from(longerCycle, (item) => item.childConversationId), ['a', 'b']);

const duplicateChild = api.normalizeEntries([
  entry('child', 'first', 1),
  entry('child', 'second', 2)
]);
assert.equal(duplicateChild.length, 1);
assert.equal(duplicateChild[0].parentConversationId, 'first');

const deep = [];
for (let index = 0; index < api.MAX_DEPTH + 2; index += 1) {
  deep.push(entry(`d${index}`, index === api.MAX_DEPTH + 1 ? 'root' : `d${index + 1}`, index));
}
const deepest = api.resolveAncestry(deep, 'd0');
assert.equal(deepest.depth, api.MAX_DEPTH);
assert.equal(deepest.entries.length, api.MAX_DEPTH);
assert.notEqual(deepest.rootConversationId, 'root');

const validIds = new Set(['a', 'b', 'root']);
const filtered = api.normalizeEntries([
  entry('a', 'b', 1),
  entry('missing', 'root', 2)
], validIds);
assert.equal(filtered.length, 1);
assert.equal(filtered[0].childConversationId, 'a');

const malformed = api.resolveAncestry([
  { childConversationId: '<script>', parentConversationId: 'root' },
  entry('safe', 'root', 3)
], 'safe');
assert.equal(malformed.depth, 1);
assert.equal(malformed.rootConversationId, 'root');

assert.equal(api.resolveAncestry(normalized, '../bad').depth, 0);
assert.equal(api.resolveAncestry(null, 'c3').depth, 0);

console.log('conversation branch ancestry tests passed');
