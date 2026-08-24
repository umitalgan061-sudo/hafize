import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const lineage = require('../public/conversation-branch-lineage.js');

function storageFrom(values, { failWrites = false } = {}) {
  const state = new Map(Object.entries(values));
  return {
    state,
    getItem(key) { return state.has(key) ? state.get(key) : null; },
    setItem(key, value) {
      if (failWrites) throw new Error('quota');
      state.set(key, String(value));
    }
  };
}

function guard() {
  return {
    sanitizeStoredValue(raw) {
      const value = JSON.parse(raw || '[]');
      return { value: Array.isArray(value) ? value : [] };
    }
  };
}

function doc() {
  return {
    head: { append() {} },
    querySelector(selector) {
      if (selector === '.chat-stage') return { prepend() {} };
      return null;
    },
    querySelectorAll() { return []; },
    getElementById() { return null; },
    createElement() {
      return {
        hidden: false,
        className: '',
        dataset: {},
        setAttribute() {},
        addEventListener() {},
        append() {},
        remove() {}
      };
    },
    addEventListener() {},
    removeEventListener() {}
  };
}

const conversations = [
  { id: 'parent', messages: [{ id: 'newest', role: 'user', content: 'kept' }] },
  { id: 'child', messages: [{ id: 'child-message', role: 'assistant', content: 'branch' }] }
];
const stale = [{
  childConversationId: 'child',
  parentConversationId: 'parent',
  sourceMessageId: 'trimmed-old-source',
  mode: 'edit',
  createdAt: '2026-08-19T01:00:00.000Z'
}];
const valid = [{ ...stale[0], sourceMessageId: 'newest' }];

const storage = storageFrom({
  [lineage.CONVERSATION_KEY]: JSON.stringify(conversations),
  [lineage.STORAGE_KEY]: JSON.stringify(stale)
});
const controller = lineage.createController({ documentRef: doc(), storage, guard: guard(), windowRef: {} });
assert.deepEqual(controller.readEntries(), [], 'read path ignores stale source anchor before persistence succeeds');
assert.equal(controller.compactStoredEntries(), true);
assert.equal(storage.state.get(lineage.STORAGE_KEY), '[]');

storage.state.set(lineage.STORAGE_KEY, JSON.stringify(valid));
assert.equal(controller.compactStoredEntries(), false, 'canonical ISO storage remains stable without a redundant write');
assert.equal(controller.readEntries().length, 1);
assert.equal(controller.compactStoredEntries(), false, 'canonical storage remains stable');

const failingStorage = storageFrom({
  [lineage.CONVERSATION_KEY]: JSON.stringify(conversations),
  [lineage.STORAGE_KEY]: JSON.stringify(stale)
}, { failWrites: true });
const failingController = lineage.createController({ documentRef: doc(), storage: failingStorage, guard: guard(), windowRef: {} });
assert.deepEqual(failingController.readEntries(), [], 'write failure never revives stale metadata in read path');
assert.equal(failingController.compactStoredEntries(), false, 'best-effort compaction reports persistence failure');
assert.notEqual(failingStorage.state.get(lineage.STORAGE_KEY), '[]', 'failing storage remains untouched');

const noSourceParent = [{ id: 'parent', messages: [] }, { id: 'child', messages: [{ id: 'child-message' }] }];
const noSourceStorage = storageFrom({
  [lineage.CONVERSATION_KEY]: JSON.stringify(noSourceParent),
  [lineage.STORAGE_KEY]: JSON.stringify(valid)
});
const noSourceController = lineage.createController({ documentRef: doc(), storage: noSourceStorage, guard: guard(), windowRef: {} });
assert.equal(noSourceController.record(valid[0]), false, 'new lineage cannot record a source absent from parent canonical messages');

const secretCanary = 'SECRET_CANARY_DO_NOT_COPY';
const canaryConversations = [
  { id: 'parent', messages: [{ id: 'safe-source', role: 'user', content: secretCanary }] },
  { id: 'child', messages: [{ id: 'child-message', role: 'assistant', content: secretCanary }] }
];
const canaryIndex = lineage.buildConversationIndex(canaryConversations);
const canaryEntry = lineage.normalizeEntry({ ...valid[0], sourceMessageId: 'safe-source' }, canaryIndex);
assert.ok(canaryEntry);
assert.equal(JSON.stringify(canaryEntry).includes(secretCanary), false, 'lineage metadata never copies message content');
assert.equal(JSON.stringify([...canaryIndex.get('parent')]).includes(secretCanary), false, 'source index stores only bounded IDs');

console.log('conversation lineage source compaction: ok');
