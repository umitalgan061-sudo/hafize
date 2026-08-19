import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const lineage = require('../public/conversation-branch-lineage.js');

const conversations = [
  { id: 'parent', messages: [{ id: 'source', role: 'user', content: 'private source text' }] },
  { id: 'branch-a', messages: [{ id: 'a' }] },
  { id: 'branch-b', messages: [{ id: 'b' }] }
];
const shared = new Map([
  [lineage.CONVERSATION_KEY, JSON.stringify(conversations)],
  [lineage.STORAGE_KEY, '[]']
]);
function storage() {
  return {
    getItem(key) { return shared.has(key) ? shared.get(key) : null; },
    setItem(key, value) { shared.set(key, String(value)); }
  };
}
function documentRef() {
  return {
    head: { append() {} }, querySelector(selector) { return selector === '.chat-stage' ? { prepend() {} } : null; },
    querySelectorAll() { return []; }, getElementById() { return null; }, addEventListener() {}, removeEventListener() {},
    createElement() { return { dataset: {}, hidden: false, setAttribute() {}, addEventListener() {}, append() {}, remove() {} }; }
  };
}
function windowRef() {
  const handlers = new Map();
  return {
    handlers,
    addEventListener(type, handler) { handlers.set(type, handler); },
    removeEventListener(type, handler) { if (handlers.get(type) === handler) handlers.delete(type); },
    storageChanged(key) { handlers.get('storage')?.({ key }); }
  };
}
const guard = { sanitizeStoredValue(raw) { return { value: JSON.parse(raw || '[]') }; } };
const winA = windowRef();
const winB = windowRef();
const tabA = lineage.createController({ documentRef: documentRef(), storage: storage(), guard, windowRef: winA });
const tabB = lineage.createController({ documentRef: documentRef(), storage: storage(), guard, windowRef: winB });
tabA.mount();
tabB.mount();

const edgeA = { childConversationId: 'branch-a', parentConversationId: 'parent', sourceMessageId: 'source', mode: 'fork', createdAt: '2026-08-19T02:30:00.000Z' };
const edgeB = { childConversationId: 'branch-b', parentConversationId: 'parent', sourceMessageId: 'source', mode: 'fork', createdAt: '2026-08-19T02:30:01.000Z' };

assert.equal(tabA.record(edgeA), true);
const snapshotAfterA = shared.get(lineage.STORAGE_KEY);
assert.equal(tabB.record(edgeB), true);
assert.notEqual(shared.get(lineage.STORAGE_KEY), snapshotAfterA);

// Browser storage events are delivered to the other document, not the writer.
winA.storageChanged(lineage.STORAGE_KEY);
winB.storageChanged(lineage.STORAGE_KEY);
winA.storageChanged(lineage.STORAGE_KEY);

const finalEntries = tabA.readEntries();
assert.deepEqual(finalEntries.map((entry) => entry.childConversationId), ['branch-b', 'branch-a']);
assert.deepEqual(tabB.readEntries(), finalEntries);
assert.equal(new Set(finalEntries.map((entry) => entry.childConversationId)).size, 2);
assert.equal(shared.get(lineage.STORAGE_KEY).includes('private source text'), false);

const stable = shared.get(lineage.STORAGE_KEY);
for (let i = 0; i < 5; i += 1) {
  winA.storageChanged(lineage.STORAGE_KEY);
  winB.storageChanged(lineage.STORAGE_KEY);
}
assert.equal(shared.get(lineage.STORAGE_KEY), stable, 'repeated cross-tab events converge without write oscillation');

tabA.destroy();
tabB.destroy();
console.log('conversation lineage two-tab integration: ok');
