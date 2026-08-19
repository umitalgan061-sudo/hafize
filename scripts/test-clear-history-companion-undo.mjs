import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const deleteApi = require('../public/conversation-delete-confirm.js');
const guard = require('../public/conversation-storage-guard.js');
const organize = require('../public/conversation-organize.js');
const modelState = require('../public/conversation-model-state.js');
const lineage = require('../public/conversation-branch-lineage.js');

const MODEL_A = 'nvidia/meta/llama-3.1-70b-instruct';
const MODEL_B = 'local:qwen2.5:7b';

function conversation(id, minute, messages = []) {
  const stamp = `2026-08-18T21:${String(minute).padStart(2, '0')}:00.000Z`;
  return {
    id,
    title: `Sohbet ${id}`,
    agentId: 'minimal-engineer',
    toolsEnabled: false,
    createdAt: stamp,
    updatedAt: stamp,
    messages
  };
}

function message(id, role, minute) {
  const stamp = `2026-08-18T21:${String(minute).padStart(2, '0')}:00.000Z`;
  return { id, role, content: `${role}-${id}`, at: stamp };
}

function memoryStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem(key) { return map.has(key) ? map.get(key) : null; },
    setItem(key, value) { map.set(String(key), String(value)); },
    raw(key) { return map.get(key); }
  };
}

function createButton() {
  const attrs = new Map();
  const synthetic = [];
  return {
    id: 'clearHistoryBtn',
    textContent: 'Temizle',
    getAttribute(name) { return attrs.has(name) ? attrs.get(name) : null; },
    setAttribute(name, value) { attrs.set(name, String(value)); },
    removeAttribute(name) { attrs.delete(name); },
    focus() {},
    closest(selector) { return selector === '#clearHistoryBtn' ? this : null; },
    click() { for (const listener of synthetic) listener(); },
    onSynthetic(listener) { synthetic.push(listener); }
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

function timers() {
  return {
    setTimeoutImpl() { return { unref() {} }; },
    clearTimeoutImpl() {}
  };
}

const parent = conversation('parent', 1, [message('parent-user', 'user', 1)]);
const child = conversation('child', 2, [
  message('child-user', 'user', 2),
  message('child-assistant', 'assistant', 3)
]);
const originals = [child, parent];
const lineageEntry = {
  childConversationId: 'child',
  parentConversationId: 'parent',
  sourceMessageId: 'parent-user',
  mode: 'fork',
  createdAt: '2026-08-18T21:02:00.000Z'
};

assert.equal(deleteApi.COMPANION_MAX_RAW_CHARS, 96 * 1024);

{
  const storage = memoryStorage({
    [guard.STORAGE_KEY]: JSON.stringify(originals),
    [organize.STORAGE_KEY]: JSON.stringify([
      { id: 'parent', title: 'Özel kaynak', pinned: true },
      { id: 'stale', title: 'Silinmiş', pinned: true }
    ]),
    [modelState.MODEL_STORAGE_KEY]: JSON.stringify([
      { conversationId: 'child', modelId: MODEL_B, token: 'must-not-survive' },
      { conversationId: 'stale', modelId: MODEL_A }
    ]),
    [lineage.STORAGE_KEY]: JSON.stringify([
      { ...lineageEntry, ownerId: 'must-not-survive' }
    ])
  });
  const rootRef = {
    HafizeConversationOrganize: organize,
    HafizeConversationModelState: modelState,
    HafizeConversationBranchLineage: lineage
  };

  const snapshot = deleteApi.snapshotCompanionState(rootRef, storage, originals);
  assert.deepEqual(snapshot.organize, [{ id: 'parent', title: 'Özel kaynak', pinned: true }]);
  assert.deepEqual(snapshot.models, [{ conversationId: 'child', modelId: MODEL_B }]);
  assert.deepEqual(snapshot.lineage, [lineageEntry]);
  const serialized = JSON.stringify(snapshot);
  assert.equal(serialized.includes('token'), false);
  assert.equal(serialized.includes('ownerId'), false);

  // Same-tab clear renderers may prune their stores before the user presses undo.
  storage.setItem(organize.STORAGE_KEY, '[]');
  storage.setItem(modelState.MODEL_STORAGE_KEY, '[]');
  storage.setItem(lineage.STORAGE_KEY, '[]');

  assert.equal(deleteApi.restoreCompanionState(snapshot, rootRef, storage, originals), 3);
  assert.deepEqual(JSON.parse(storage.raw(organize.STORAGE_KEY)), [
    { id: 'parent', title: 'Özel kaynak', pinned: true }
  ]);
  assert.deepEqual(JSON.parse(storage.raw(modelState.MODEL_STORAGE_KEY)), [
    { conversationId: 'child', modelId: MODEL_B }
  ]);
  assert.deepEqual(JSON.parse(storage.raw(lineage.STORAGE_KEY)), [lineageEntry]);
}

{
  // Current metadata wins for the same conversation, while snapshot-only metadata returns.
  const remoteParent = conversation('remote-parent', 4, [message('remote-source', 'user', 4)]);
  const remoteChild = conversation('remote-child', 5, [message('remote-user', 'user', 5)]);
  const finalConversations = [remoteChild, remoteParent, ...originals];
  const remoteLineage = {
    childConversationId: 'remote-child',
    parentConversationId: 'remote-parent',
    sourceMessageId: 'remote-source',
    mode: 'edit',
    createdAt: '2026-08-18T21:05:00.000Z'
  };
  const storage = memoryStorage({
    [organize.STORAGE_KEY]: JSON.stringify([
      { id: 'parent', title: 'Daha yeni başlık', pinned: false },
      { id: 'remote-parent', title: 'Uzak', pinned: true }
    ]),
    [modelState.MODEL_STORAGE_KEY]: JSON.stringify([
      { conversationId: 'child', modelId: MODEL_A },
      { conversationId: 'remote-child', modelId: MODEL_B }
    ]),
    [lineage.STORAGE_KEY]: JSON.stringify([remoteLineage])
  });
  const snapshot = {
    organize: [{ id: 'parent', title: 'Eski başlık', pinned: true }],
    models: [{ conversationId: 'child', modelId: MODEL_B }],
    lineage: [lineageEntry]
  };
  const rootRef = {
    HafizeConversationOrganize: organize,
    HafizeConversationModelState: modelState,
    HafizeConversationBranchLineage: lineage
  };

  assert.equal(deleteApi.restoreCompanionState(snapshot, rootRef, storage, finalConversations), 3);
  const organized = JSON.parse(storage.raw(organize.STORAGE_KEY));
  assert.deepEqual(organized, [
    { id: 'parent', title: 'Daha yeni başlık', pinned: false },
    { id: 'remote-parent', title: 'Uzak', pinned: true }
  ]);
  const models = JSON.parse(storage.raw(modelState.MODEL_STORAGE_KEY));
  assert.deepEqual(models, [
    { conversationId: 'child', modelId: MODEL_A },
    { conversationId: 'remote-child', modelId: MODEL_B }
  ]);
  const branches = JSON.parse(storage.raw(lineage.STORAGE_KEY));
  assert.equal(branches.some((entry) => entry.childConversationId === 'remote-child'), true);
  assert.equal(branches.some((entry) => entry.childConversationId === 'child'), true);
}

{
  const huge = 'x'.repeat(deleteApi.COMPANION_MAX_RAW_CHARS + 1);
  const storage = memoryStorage({
    [organize.STORAGE_KEY]: huge,
    [modelState.MODEL_STORAGE_KEY]: huge,
    [lineage.STORAGE_KEY]: huge
  });
  const snapshot = deleteApi.snapshotCompanionState({
    HafizeConversationOrganize: organize,
    HafizeConversationModelState: modelState,
    HafizeConversationBranchLineage: lineage
  }, storage, originals);
  assert.equal(Object.hasOwn(snapshot, 'organize'), false);
  assert.equal(Object.hasOwn(snapshot, 'models'), false);
  assert.equal(Object.hasOwn(snapshot, 'lineage'), false);
}

{
  // Full clear -> prune -> undo path restores the companion state before reload.
  const storage = memoryStorage({
    [guard.STORAGE_KEY]: JSON.stringify(originals),
    [organize.STORAGE_KEY]: JSON.stringify([{ id: 'parent', title: 'Kaynak sabit', pinned: true }]),
    [modelState.MODEL_STORAGE_KEY]: JSON.stringify([{ conversationId: 'child', modelId: MODEL_B }]),
    [lineage.STORAGE_KEY]: JSON.stringify([lineageEntry])
  });
  const boundary = guard.installWriteBoundary(storage);
  assert.ok(boundary);
  const button = createButton();
  let reloads = 0;
  const rootRef = {
    localStorage: storage,
    HafizeConversationStorageGuard: guard,
    HafizeConversationOrganize: organize,
    HafizeConversationModelState: modelState,
    HafizeConversationBranchLineage: lineage,
    confirm() { return false; },
    location: { reload() { reloads += 1; } }
  };
  const documentRef = {
    visibilityState: 'visible',
    addEventListener() {},
    removeEventListener() {},
    querySelector(selector) { return selector === '#messageInput' ? { value: '' } : null; }
  };
  const controller = deleteApi.createController({ documentRef, rootRef, ...timers() });
  button.onSynthetic(() => {
    if (!controller.onCaptureClick(eventFor(button))) return;
    if (!rootRef.confirm(deleteApi.CLEAR_HISTORY_PROMPT)) return;
    storage.setItem(guard.STORAGE_KEY, '[]');
    storage.setItem(organize.STORAGE_KEY, '[]');
    storage.setItem(modelState.MODEL_STORAGE_KEY, '[]');
    storage.setItem(lineage.STORAGE_KEY, '[]');
  });

  controller.onCaptureClick(eventFor(button));
  controller.onCaptureClick(eventFor(button));
  assert.equal(controller.snapshot().undoAvailable, true);
  assert.equal(storage.raw(guard.STORAGE_KEY), '[]');
  assert.equal(controller.onCaptureClick(eventFor(button)), true);
  assert.equal(reloads, 1);
  assert.deepEqual(
    guard.sanitizeStoredValue(storage.raw(guard.STORAGE_KEY)).value.map((item) => item.id),
    ['child', 'parent']
  );
  assert.deepEqual(JSON.parse(storage.raw(organize.STORAGE_KEY)), [
    { id: 'parent', title: 'Kaynak sabit', pinned: true }
  ]);
  assert.deepEqual(JSON.parse(storage.raw(modelState.MODEL_STORAGE_KEY)), [
    { conversationId: 'child', modelId: MODEL_B }
  ]);
  assert.deepEqual(JSON.parse(storage.raw(lineage.STORAGE_KEY)), [lineageEntry]);
}

console.log('clear history companion undo tests passed');
