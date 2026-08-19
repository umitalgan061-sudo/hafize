import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const lineage = require('../public/conversation-branch-lineage.js');

function createStorage(initial) {
  const map = new Map(Object.entries(initial));
  return {
    map,
    getItem(key) { return map.has(key) ? map.get(key) : null; },
    setItem(key, value) { map.set(key, String(value)); }
  };
}
function createDocument() {
  return {
    head: { append() {} },
    querySelector(selector) { return selector === '.chat-stage' ? { prepend() {} } : null; },
    querySelectorAll() { return []; },
    getElementById() { return null; },
    createElement() { return { hidden: false, dataset: {}, setAttribute() {}, addEventListener() {}, append() {}, remove() {} }; },
    addEventListener() {}, removeEventListener() {}
  };
}
function createWindow() {
  const listeners = new Map();
  return {
    listeners,
    addEventListener(name, fn) { listeners.set(name, fn); },
    removeEventListener(name, fn) { if (listeners.get(name) === fn) listeners.delete(name); },
    dispatchStorage(key) { listeners.get('storage')?.({ key }); }
  };
}
function edge(child, time) {
  return { childConversationId: child, parentConversationId: 'parent', sourceMessageId: 'source', mode: 'fork', createdAt: time };
}

const conversations = [
  { id: 'parent', messages: [{ id: 'source', role: 'user', content: 'source text' }] },
  { id: 'child-a', messages: [{ id: 'a' }] },
  { id: 'child-b', messages: [{ id: 'b' }] }
];
const storage = createStorage({ [lineage.CONVERSATION_KEY]: JSON.stringify(conversations), [lineage.STORAGE_KEY]: '[]' });
const windowRef = createWindow();
const guard = { sanitizeStoredValue(raw) { return { value: JSON.parse(raw || '[]') }; } };
const controller = lineage.createController({ documentRef: createDocument(), storage, guard, windowRef });
controller.mount();

const local = edge('child-a', '2026-08-19T02:00:00.000Z');
const remote = edge('child-b', '2026-08-19T02:01:00.000Z');
assert.equal(controller.record(local), true);
assert.deepEqual(controller.readEntries().map((item) => item.childConversationId), ['child-a']);

storage.setItem(lineage.STORAGE_KEY, JSON.stringify([remote]));
windowRef.dispatchStorage(lineage.STORAGE_KEY);
assert.deepEqual(controller.readEntries().map((item) => item.childConversationId), ['child-b', 'child-a'], 'remote overwrite heals with session-local branch');

const canonicalAfterHeal = storage.getItem(lineage.STORAGE_KEY);
windowRef.dispatchStorage(lineage.STORAGE_KEY);
assert.equal(storage.getItem(lineage.STORAGE_KEY), canonicalAfterHeal, 'canonical storage event does not ping-pong');

storage.setItem(lineage.CONVERSATION_KEY, JSON.stringify([
  { id: 'parent', messages: [{ id: 'other-source' }] },
  { id: 'child-a', messages: [{ id: 'a' }] },
  { id: 'child-b', messages: [{ id: 'b' }] }
]));
windowRef.dispatchStorage(lineage.CONVERSATION_KEY);
assert.deepEqual(controller.readEntries(), [], 'retention invalidation removes remembered and remote stale anchors');

storage.setItem(lineage.CONVERSATION_KEY, JSON.stringify(conversations));
windowRef.dispatchStorage(lineage.CONVERSATION_KEY);
assert.deepEqual(controller.readEntries(), [], 'stale session memory is not resurrected after source returns');

controller.destroy();
assert.equal(windowRef.listeners.has('storage'), false, 'destroy releases cross-tab listener and session memory');

console.log('conversation lineage cross-tab controller: ok');
