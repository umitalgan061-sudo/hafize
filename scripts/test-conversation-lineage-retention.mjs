import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../public/conversation-branch-lineage.js', import.meta.url), 'utf8');
const sandbox = { module: { exports: {} }, exports: {}, console, globalThis: {} };
vm.runInNewContext(source, sandbox, { filename: 'conversation-branch-lineage.js' });
const api = sandbox.module.exports;

assert.equal(api.MAX_STORAGE_CHARS, 64 * 1024);

const validIds = new Set(['root', 'child', 'other']);
const entry = (child, parent, sourceMessageId = 'm1') => ({
  childConversationId: child,
  parentConversationId: parent,
  sourceMessageId,
  mode: 'fork',
  createdAt: '2026-08-19T00:00:00.000Z'
});

const validRaw = JSON.stringify([entry('child', 'root')]);
assert.equal(api.parseEntries(validRaw, validIds).length, 1);

const staleChildRaw = JSON.stringify([
  entry('child', 'root'),
  entry('deleted-child', 'root')
]);
assert.deepEqual(
  Array.from(api.parseEntries(staleChildRaw, validIds), (item) => item.childConversationId),
  ['child']
);

const staleParentRaw = JSON.stringify([
  entry('child', 'deleted-parent'),
  entry('other', 'root')
]);
assert.deepEqual(
  Array.from(api.parseEntries(staleParentRaw, validIds), (item) => item.childConversationId),
  ['other']
);

assert.equal(api.parseEntries('{bad-json', validIds).length, 0);
assert.equal(api.parseEntries('x'.repeat(api.MAX_STORAGE_CHARS + 1), validIds).length, 0);
assert.equal(api.parseEntries('', validIds).length, 0);
assert.equal(api.parseEntries(null, validIds).length, 0);

const many = [];
for (let index = 0; index < api.MAX_ENTRIES + 20; index += 1) {
  many.push(entry(`c${index}`, 'root', `m${index}`));
  validIds.add(`c${index}`);
}
assert.equal(api.parseEntries(JSON.stringify(many), validIds).length, api.MAX_ENTRIES);

const malicious = JSON.stringify([
  entry('<script>', 'root'),
  entry('child', '../bad'),
  entry('child', 'root')
]);
const sanitized = api.parseEntries(malicious, validIds);
assert.equal(sanitized.length, 1);
assert.equal(sanitized[0].childConversationId, 'child');
assert.equal(sanitized[0].parentConversationId, 'root');

console.log('conversation lineage retention parser tests passed');
