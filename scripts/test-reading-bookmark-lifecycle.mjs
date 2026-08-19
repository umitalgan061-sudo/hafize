import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const reading = require('../public/reading-focus.js');
const deleteApi = require('../public/conversation-delete-confirm.js');
const guard = require('../public/conversation-storage-guard.js');

function message(id, role, minute) {
  const stamp = `2026-08-19T06:${String(minute).padStart(2, '0')}:00.000Z`;
  return { id, role, content: `${role}-${id}`, at: stamp };
}

function conversation(id, minute, messages) {
  const stamp = `2026-08-19T06:${String(minute).padStart(2, '0')}:00.000Z`;
  return guard.normalizeConversation({
    id,
    title: `Sohbet ${id}`,
    agentId: 'minimal-engineer',
    toolsEnabled: false,
    createdAt: stamp,
    updatedAt: stamp,
    messages
  });
}

function storage(seed = {}) {
  const values = new Map(Object.entries(seed));
  let writes = 0;
  return {
    getItem(key) { return values.has(String(key)) ? values.get(String(key)) : null; },
    setItem(key, value) { writes += 1; values.set(String(key), String(value)); },
    removeItem(key) { values.delete(String(key)); },
    raw(key) { return values.get(String(key)); },
    writes() { return writes; }
  };
}

function createButton() {
  const attrs = new Map();
  const listeners = [];
  return {
    id: 'clearHistoryBtn',
    textContent: 'Temizle',
    getAttribute(name) { return attrs.has(name) ? attrs.get(name) : null; },
    setAttribute(name, value) { attrs.set(name, String(value)); },
    removeAttribute(name) { attrs.delete(name); },
    focus() {},
    closest(selector) { return selector === '#clearHistoryBtn' ? this : null; },
    click() { for (const listener of listeners) listener(); },
    onSynthetic(listener) { listeners.push(listener); }
  };
}

function eventFor(target) {
  return {
    target,
    defaultPrevented: false,
    preventDefault() { this.defaultPrevented = true; },
    stopImmediatePropagation() {}
  };
}

const alpha = conversation('alpha', 1, [
  message('alpha-user', 'user', 1),
  message('alpha-assistant', 'assistant', 2)
]);
const beta = conversation('beta', 3, [
  message('beta-user', 'user', 3),
  message('beta-assistant', 'assistant', 4)
]);
const conversations = guard.normalizeConversations([beta, alpha]);

assert.equal(reading.CONVERSATION_STORAGE_KEY, guard.STORAGE_KEY);
assert.equal(reading.MAX_BOOKMARKS, 200);
assert.equal(reading.MAX_STORAGE_CHARS, 48 * 1024);
assert.deepEqual(
  [...reading.messageIdsFromConversations(conversations)].sort(),
  ['alpha-assistant', 'alpha-user', 'beta-assistant', 'beta-user']
);
assert.deepEqual(
  reading.pruneBookmarkIds(['alpha-user', 'stale', 'beta-assistant', 'alpha-user'], reading.messageIdsFromConversations(conversations)),
  ['alpha-user', 'beta-assistant']
);

{
  const local = storage({
    [guard.STORAGE_KEY]: JSON.stringify(conversations),
    [reading.STORAGE_KEY]: JSON.stringify({
      focusMode: true,
      bookmarkIds: ['alpha-user', 'deleted-message', 'beta-assistant'],
      token: 'must-not-survive'
    })
  });
  const result = reading.compactState(local, guard);
  assert.equal(result.changed, true);
  assert.equal(result.persisted, true);
  assert.deepEqual(result.state, {
    focusMode: true,
    bookmarkIds: ['alpha-user', 'beta-assistant']
  });
  assert.deepEqual(JSON.parse(local.raw(reading.STORAGE_KEY)), result.state);
  assert.equal(local.raw(reading.STORAGE_KEY).includes('token'), false);

  const writesAfterFirst = local.writes();
  const second = reading.compactState(local, guard);
  assert.equal(second.changed, false, 'canonical bookmark state must not generate storage write ping-pong');
  assert.equal(local.writes(), writesAfterFirst);
}

{
  const local = storage({
    [guard.STORAGE_KEY]: JSON.stringify(conversations),
    [reading.STORAGE_KEY]: reading.serializeState({ focusMode: true, bookmarkIds: ['alpha-user', 'stale'] })
  });
  const result = reading.compactState(local, null);
  assert.equal(result.changed, false, 'missing canonical guard must fail closed instead of pruning user bookmarks');
  assert.deepEqual(result.state.bookmarkIds, ['alpha-user', 'stale']);
  assert.equal(local.writes(), 0);
}

{
  const oversized = 'x'.repeat(reading.MAX_STORAGE_CHARS + 1);
  assert.deepEqual(reading.parseState(oversized), { focusMode: false, bookmarkIds: [] });
}

{
  const local = storage({
    [guard.STORAGE_KEY]: '[]',
    [reading.STORAGE_KEY]: reading.serializeState({ focusMode: true, bookmarkIds: ['alpha-user', 'beta-user'] })
  });
  const result = reading.compactState(local, guard);
  assert.equal(result.changed, true);
  assert.deepEqual(result.state, { focusMode: true, bookmarkIds: [] },
    'conversation clear removes only stale bookmarks while global focus preference survives');
}

{
  const local = storage({
    [reading.STORAGE_KEY]: JSON.stringify({
      focusMode: true,
      bookmarkIds: ['alpha-user', 'deleted-message', 'beta-assistant'],
      credential: 'must-not-survive'
    })
  });
  const snapshot = deleteApi.snapshotCompanionState({ HafizeReadingFocus: reading }, local, conversations);
  assert.deepEqual(snapshot.readingBookmarks, ['alpha-user', 'beta-assistant']);
  const serialized = JSON.stringify(snapshot);
  assert.equal(serialized.includes('credential'), false);
  assert.equal(serialized.includes('focusMode'), false,
    'focus mode is global preference and must not be rolled back with conversation history');
}

{
  const local = storage({
    [reading.STORAGE_KEY]: reading.serializeState({
      focusMode: false,
      bookmarkIds: ['beta-user']
    })
  });
  const snapshot = { readingBookmarks: ['alpha-user', 'stale', 'beta-user'] };
  assert.equal(deleteApi.restoreCompanionState(
    snapshot,
    { HafizeReadingFocus: reading },
    local,
    conversations
  ), 1);
  assert.deepEqual(JSON.parse(local.raw(reading.STORAGE_KEY)), {
    focusMode: false,
    bookmarkIds: ['beta-user', 'alpha-user']
  });
}

{
  const huge = 'x'.repeat(reading.MAX_STORAGE_CHARS + 1);
  const local = storage({ [reading.STORAGE_KEY]: huge });
  const snapshot = deleteApi.snapshotCompanionState({ HafizeReadingFocus: reading }, local, conversations);
  assert.equal(Object.hasOwn(snapshot, 'readingBookmarks'), false,
    'oversized raw bookmark state must not enter the RAM undo snapshot');
}

{
  // End-to-end: clear triggers canonical bookmark compaction, then session undo restores bookmarks before reload.
  const local = storage({
    [guard.STORAGE_KEY]: JSON.stringify(conversations),
    [reading.STORAGE_KEY]: reading.serializeState({
      focusMode: true,
      bookmarkIds: ['alpha-user', 'beta-assistant']
    })
  });
  const boundary = guard.installWriteBoundary(local);
  assert.ok(boundary);
  const clear = createButton();
  let reloads = 0;
  const rootRef = {
    localStorage: local,
    HafizeConversationStorageGuard: guard,
    HafizeReadingFocus: reading,
    confirm() { return false; },
    location: { reload() { reloads += 1; } }
  };
  const documentRef = {
    visibilityState: 'visible',
    addEventListener() {},
    removeEventListener() {},
    querySelector(selector) { return selector === '#messageInput' ? { value: '' } : null; }
  };
  const controller = deleteApi.createController({
    documentRef,
    rootRef,
    setTimeoutImpl() { return { unref() {} }; },
    clearTimeoutImpl() {}
  });
  clear.onSynthetic(() => {
    if (!controller.onCaptureClick(eventFor(clear))) return;
    if (!rootRef.confirm(deleteApi.CLEAR_HISTORY_PROMPT)) return;
    local.setItem(guard.STORAGE_KEY, '[]');
    const compacted = reading.compactState(local, guard);
    assert.equal(compacted.changed, true);
    assert.deepEqual(compacted.state, { focusMode: true, bookmarkIds: [] });
  });

  controller.onCaptureClick(eventFor(clear));
  controller.onCaptureClick(eventFor(clear));
  assert.equal(controller.snapshot().undoAvailable, true);
  assert.deepEqual(JSON.parse(local.raw(reading.STORAGE_KEY)), { focusMode: true, bookmarkIds: [] });

  assert.equal(controller.onCaptureClick(eventFor(clear)), true);
  assert.equal(reloads, 1);
  assert.deepEqual(JSON.parse(local.raw(reading.STORAGE_KEY)), {
    focusMode: true,
    bookmarkIds: ['alpha-user', 'beta-assistant']
  });
  assert.deepEqual(
    guard.sanitizeStoredValue(local.raw(guard.STORAGE_KEY)).value.map((item) => item.id),
    conversations.map((item) => item.id)
  );
}

console.log('reading bookmark lifecycle tests passed');
