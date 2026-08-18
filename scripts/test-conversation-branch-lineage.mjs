import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../public/conversation-branch-lineage.js', import.meta.url), 'utf8');
const sandbox = { module: { exports: {} }, exports: {}, globalThis: {} };
vm.runInNewContext(source, sandbox, { filename: 'conversation-branch-lineage.js' });
const api = sandbox.module.exports;

const ids = new Set(['parent-1', 'child-1', 'child-2']);
const valid = {
  childConversationId: 'child-1',
  parentConversationId: 'parent-1',
  sourceMessageId: 'message-1',
  mode: 'fork',
  createdAt: '2026-08-19T00:00:00.000Z'
};
assert.deepEqual({ ...api.normalizeEntry(valid, ids) }, valid);
assert.equal(api.normalizeEntry({ ...valid, childConversationId: 'parent-1' }, ids), null);
assert.equal(api.normalizeEntry({ ...valid, parentConversationId: 'missing' }, ids), null);
assert.equal(api.normalizeEntry({ ...valid, sourceMessageId: '<script>' }, ids), null);
assert.equal(api.normalizeEntry({ ...valid, mode: 'merge' }, ids), null);
assert.equal(api.normalizeEntry({ ...valid, createdAt: 'not-a-date' }, ids), null);
assert.equal(api.normalizeEntry({ ...valid, ownerId: 'secret-owner' }, ids)?.ownerId, undefined);

const many = Array.from({ length: 80 }, (_, index) => ({
  ...valid,
  childConversationId: index % 2 ? 'child-1' : 'child-2',
  sourceMessageId: `message-${index}`
}));
const deduped = api.normalizeEntries(many, ids);
assert.equal(deduped.length, 2);
assert.equal(new Set(deduped.map((entry) => entry.childConversationId)).size, 2);

const exactIds = new Set(['parent-1', ...Array.from({ length: 70 }, (_, i) => `child-${i}`)]);
const bounded = api.normalizeEntries(Array.from({ length: 70 }, (_, index) => ({
  childConversationId: `child-${index}`,
  parentConversationId: 'parent-1',
  sourceMessageId: `message-${index}`,
  mode: index % 2 ? 'edit' : 'fork',
  createdAt: `2026-08-19T00:${String(index % 60).padStart(2, '0')}:00.000Z`
})), exactIds);
assert.equal(bounded.length, api.MAX_ENTRIES);

assert.deepEqual(api.parseEntries('{bad json', ids), []);
assert.equal(api.normalizeId('a'.repeat(api.MAX_ID_CHARS + 1)), '');
assert.equal(api.normalizeId('ok:id-1'), 'ok:id-1');
assert.equal(api.normalizeMode('edit'), 'edit');
assert.equal(api.normalizeMode('fork'), 'fork');
assert.equal(api.normalizeMode('retry'), '');

const encoded = JSON.stringify([valid, { ...valid, childConversationId: 'missing' }]);
assert.equal(api.parseEntries(encoded, ids).length, 1);

console.log('conversation branch lineage normalization: ok');
