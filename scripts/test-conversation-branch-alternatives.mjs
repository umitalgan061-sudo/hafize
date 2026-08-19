import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../public/conversation-branch-lineage.js', import.meta.url), 'utf8');
const sandbox = { module: { exports: {} }, exports: {}, console, globalThis: {} };
vm.runInNewContext(source, sandbox, { filename: 'conversation-branch-lineage.js' });
const api = sandbox.module.exports;

const make = (child, parent, sourceMessageId, createdAt, mode = 'fork') => ({
  childConversationId: child,
  parentConversationId: parent,
  sourceMessageId,
  mode,
  createdAt
});

const entries = [
  make('branch-b', 'root', 'm1', '2026-08-19T01:00:00.000Z'),
  make('branch-a', 'root', 'm1', '2026-08-19T00:00:00.000Z'),
  make('branch-c', 'root', 'm1', '2026-08-19T02:00:00.000Z', 'edit'),
  make('other-source', 'root', 'm2', '2026-08-19T03:00:00.000Z'),
  make('other-parent', 'parent-2', 'm1', '2026-08-19T04:00:00.000Z')
];

const first = api.resolveSiblings(entries, 'branch-a');
assert.equal(first.entries.length, 3);
assert.equal(first.index, 0);
assert.equal(first.previousConversationId, '');
assert.equal(first.nextConversationId, 'branch-b');
assert.deepEqual(Array.from(first.entries, (entry) => entry.childConversationId), ['branch-a', 'branch-b', 'branch-c']);

const middle = api.resolveSiblings(entries, 'branch-b');
assert.equal(middle.index, 1);
assert.equal(middle.previousConversationId, 'branch-a');
assert.equal(middle.nextConversationId, 'branch-c');

const last = api.resolveSiblings(entries, 'branch-c');
assert.equal(last.index, 2);
assert.equal(last.previousConversationId, 'branch-b');
assert.equal(last.nextConversationId, '');

const unrelated = api.resolveSiblings(entries, 'other-source');
assert.equal(unrelated.entries.length, 1);
assert.equal(unrelated.index, 0);
assert.equal(unrelated.previousConversationId, '');
assert.equal(unrelated.nextConversationId, '');

const tie = api.resolveSiblings([
  make('z', 'root', 'same', '2026-08-19T00:00:00.000Z'),
  make('a', 'root', 'same', '2026-08-19T00:00:00.000Z')
], 'a');
assert.deepEqual(Array.from(tie.entries, (entry) => entry.childConversationId), ['a', 'z']);

const malformed = api.resolveSiblings([
  make('safe', 'root', 'm1', '2026-08-19T00:00:00.000Z'),
  make('<script>', 'root', 'm1', '2026-08-19T01:00:00.000Z'),
  make('unsafe-parent', '../bad', 'm1', '2026-08-19T02:00:00.000Z')
], 'safe');
assert.equal(malformed.entries.length, 1);
assert.equal(malformed.entries[0].childConversationId, 'safe');

assert.equal(api.resolveSiblings(entries, 'missing').index, -1);
assert.equal(api.resolveSiblings(entries, '../bad').entries.length, 0);
assert.equal(api.resolveSiblings(null, 'branch-a').entries.length, 0);

console.log('conversation branch alternative tests passed');
