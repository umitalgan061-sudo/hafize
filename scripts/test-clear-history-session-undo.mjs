import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const deleteApi = require('../public/conversation-delete-confirm.js');
const guard = require('../public/conversation-storage-guard.js');

function conversation(id, minute) {
  const stamp = `2026-08-18T20:${String(minute).padStart(2, '0')}:00.000Z`;
  return {
    id,
    title: `Sohbet ${id}`,
    agentId: 'minimal-engineer',
    toolsEnabled: false,
    createdAt: stamp,
    updatedAt: stamp,
    messages: [{ id: `${id}-m1`, role: 'user', content: `mesaj-${id}`, at: stamp }]
  };
}

function createStorage(initial) {
  const map = new Map([[guard.STORAGE_KEY, initial]]);
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

function createTimers() {
  const timers = [];
  return {
    setTimeoutImpl(callback, delay) {
      timers.push({ callback, delay, active: true });
      return { unref() {} };
    },
    clearTimeoutImpl() {},
    delays() { return timers.map((timer) => timer.delay); },
    fire(delay) {
      const timer = timers.find((item) => item.active && item.delay === delay);
      if (timer) { timer.active = false; timer.callback(); }
    }
  };
}

function makeController({ initial, remoteAfterClear = null } = {}) {
  const storage = createStorage(JSON.stringify(initial));
  const boundary = guard.installWriteBoundary(storage);
  assert.ok(boundary, 'conversation storage guard must be installed before undo');
  const button = createButton();
  const timers = createTimers();
  let reloads = 0;
  const rootRef = {
    localStorage: storage,
    HafizeConversationStorageGuard: guard,
    confirm() { return false; },
    location: { reload() { reloads += 1; } }
  };
  const documentRef = {
    visibilityState: 'visible',
    addEventListener() {},
    removeEventListener() {},
    querySelector(selector) { return selector === '#messageInput' ? { value: '' } : null; }
  };
  const controller = deleteApi.createController({ documentRef, rootRef, ...timers });
  button.onSynthetic(() => {
    const synthetic = eventFor(button);
    if (!controller.onCaptureClick(synthetic)) return;
    if (!rootRef.confirm(deleteApi.CLEAR_HISTORY_PROMPT)) return;
    storage.setItem(guard.STORAGE_KEY, '[]');
    if (remoteAfterClear) boundary.originalSetItem(guard.STORAGE_KEY, JSON.stringify(remoteAfterClear));
  });
  return { storage, boundary, button, timers, rootRef, documentRef, controller, reloads: () => reloads };
}

assert.equal(deleteApi.UNDO_WINDOW_MS, 12_000);
assert.equal(deleteApi.UNDO_TEXT, 'Geri al');

{
  const fixture = makeController({ initial: [conversation('a', 1), conversation('b', 2)] });
  fixture.controller.onCaptureClick(eventFor(fixture.button));
  fixture.controller.onCaptureClick(eventFor(fixture.button));
  assert.equal(fixture.storage.raw(guard.STORAGE_KEY), '[]');
  assert.equal(fixture.controller.snapshot().undoAvailable, true);
  assert.equal(fixture.button.textContent, 'Geri al');
  assert.equal(fixture.button.getAttribute('data-clear-history-undo'), 'true');
  assert.ok(fixture.timers.delays().includes(deleteApi.UNDO_WINDOW_MS));

  const undo = eventFor(fixture.button);
  assert.equal(fixture.controller.onCaptureClick(undo), true);
  const restored = guard.sanitizeStoredValue(fixture.storage.raw(guard.STORAGE_KEY)).value;
  assert.deepEqual(restored.map((item) => item.id).sort(), ['a', 'b']);
  assert.equal(fixture.reloads(), 1);
  assert.equal(fixture.controller.snapshot().undoAvailable, false);
  assert.equal(fixture.button.textContent, 'Temizle');
}

{
  const remote = [conversation('remote', 9)];
  const fixture = makeController({ initial: [conversation('local', 3)], remoteAfterClear: remote });
  fixture.controller.onCaptureClick(eventFor(fixture.button));
  fixture.controller.onCaptureClick(eventFor(fixture.button));
  assert.equal(fixture.controller.snapshot().undoAvailable, false,
    'undo is not armed when clear no longer owns the current empty snapshot');
  const current = guard.sanitizeStoredValue(fixture.storage.raw(guard.STORAGE_KEY)).value;
  assert.deepEqual(current.map((item) => item.id), ['remote']);
  assert.equal(fixture.reloads(), 0);
}

{
  const fixture = makeController({ initial: [conversation('timeout', 4)] });
  fixture.controller.onCaptureClick(eventFor(fixture.button));
  fixture.controller.onCaptureClick(eventFor(fixture.button));
  assert.equal(fixture.controller.snapshot().undoAvailable, true);
  fixture.timers.fire(deleteApi.UNDO_WINDOW_MS);
  assert.equal(fixture.controller.snapshot().undoAvailable, false);
  assert.equal(fixture.button.textContent, 'Temizle');
  assert.equal(fixture.storage.raw(guard.STORAGE_KEY), '[]');
}

{
  const fixture = makeController({ initial: [conversation('hidden', 5)] });
  fixture.controller.onCaptureClick(eventFor(fixture.button));
  fixture.controller.onCaptureClick(eventFor(fixture.button));
  fixture.documentRef.visibilityState = 'hidden';
  fixture.controller.onVisibilityChange();
  assert.equal(fixture.controller.snapshot().undoAvailable, false);
  assert.equal(fixture.storage.raw(guard.STORAGE_KEY), '[]');
}

console.log('clear history session-only undo tests passed');