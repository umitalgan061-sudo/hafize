import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../public/conversation-branch-lineage.js', import.meta.url), 'utf8');
const sandbox = { module: { exports: {} }, exports: {}, console, globalThis: {} };
vm.runInNewContext(source, sandbox, { filename: 'conversation-branch-lineage.js' });
const api = sandbox.module.exports;

const documentRef = {
  querySelector() { return null; },
  querySelectorAll() { return []; },
  addEventListener() {},
  removeEventListener() {}
};
const guard = {
  sanitizeStoredValue(raw) {
    return { value: JSON.parse(raw) };
  }
};
const conversations = [
  { id: 'root', messages: [] },
  { id: 'child', messages: [] },
  { id: 'sibling', messages: [] }
];
const valid = {
  childConversationId: 'child',
  parentConversationId: 'root',
  sourceMessageId: 'm1',
  mode: 'fork',
  createdAt: '2026-08-19T00:00:00.000Z'
};
const stale = {
  childConversationId: 'deleted',
  parentConversationId: 'root',
  sourceMessageId: 'm2',
  mode: 'edit',
  createdAt: '2026-08-19T00:01:00.000Z'
};

function makeStorage(lineageRaw) {
  const values = new Map([
    [api.CONVERSATION_KEY, JSON.stringify(conversations)],
    [api.STORAGE_KEY, lineageRaw]
  ]);
  const writes = [];
  return {
    values,
    writes,
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) {
      writes.push([key, String(value)]);
      values.set(key, String(value));
    }
  };
}

const storage = makeStorage(JSON.stringify([stale, valid]));
const controller = api.createController({ documentRef, storage, guard, windowRef: {} });
assert.equal(controller.compactStoredEntries(), true);
assert.equal(storage.writes.length, 1);
assert.equal(storage.writes[0][0], api.STORAGE_KEY);
assert.deepEqual(JSON.parse(storage.values.get(api.STORAGE_KEY)), [valid]);

assert.equal(controller.compactStoredEntries(), false);
assert.equal(storage.writes.length, 1, 'canonical storage must not be rewritten');

storage.values.set(api.CONVERSATION_KEY, JSON.stringify([{ id: 'root', messages: [] }]));
assert.equal(controller.compactStoredEntries(), true);
assert.deepEqual(JSON.parse(storage.values.get(api.STORAGE_KEY)), []);
assert.equal(controller.readEntries().length, 0);

const malformed = makeStorage('{broken');
const malformedController = api.createController({ documentRef, storage: malformed, guard, windowRef: {} });
assert.equal(malformedController.compactStoredEntries(), true);
assert.equal(malformed.values.get(api.STORAGE_KEY), '[]');

const oversized = makeStorage('x'.repeat(api.MAX_STORAGE_CHARS + 1));
const oversizedController = api.createController({ documentRef, storage: oversized, guard, windowRef: {} });
assert.equal(oversizedController.compactStoredEntries(), true);
assert.equal(oversized.values.get(api.STORAGE_KEY), '[]');

const empty = makeStorage('');
const emptyController = api.createController({ documentRef, storage: empty, guard, windowRef: {} });
assert.equal(emptyController.compactStoredEntries(), false);
assert.equal(empty.writes.length, 0);

let failedWrites = 0;
const failing = {
  getItem(key) {
    if (key === api.CONVERSATION_KEY) return JSON.stringify(conversations);
    return JSON.stringify([stale, valid]);
  },
  setItem() {
    failedWrites += 1;
    throw new Error('quota');
  }
};
const failingController = api.createController({ documentRef, storage: failing, guard, windowRef: {} });
assert.equal(failingController.compactStoredEntries(), false);
assert.equal(failedWrites, 1);
assert.equal(failingController.readEntries().length, 1, 'read path still filters stale metadata when compaction write fails');

console.log('conversation lineage retention controller tests passed');
