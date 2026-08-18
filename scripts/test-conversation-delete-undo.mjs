import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const guard = require('../public/conversation-storage-guard.js');
const undo = require('../public/conversation-delete-undo.js');

class MemoryStorage {
  constructor(entries = {}) {
    this.values = new Map(Object.entries(entries));
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.values.set(String(key), String(value));
  }

  removeItem(key) {
    this.values.delete(String(key));
  }
}

function classList() {
  const values = new Set();
  return {
    add: (...tokens) => tokens.forEach((token) => values.add(token)),
    remove: (...tokens) => tokens.forEach((token) => values.delete(token)),
    contains: (token) => values.has(token)
  };
}

class FakeElement {
  constructor(tag) {
    this.tagName = tag.toUpperCase();
    this.className = '';
    this.classList = classList();
    this.children = [];
    this.listeners = new Map();
    this.attributes = new Map();
    this.textContent = '';
    this.type = '';
    this.removed = false;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  append(...children) {
    this.children.push(...children);
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }

  click() {
    for (const listener of this.listeners.get('click') || []) listener({ preventDefault() {} });
  }

  remove() {
    this.removed = true;
  }
}

class FakeDocument {
  constructor() {
    this.body = new FakeElement('body');
    this.listeners = new Map();
    this.input = { value: '' };
  }

  createElement(tag) {
    return new FakeElement(tag);
  }

  querySelector(selector) {
    return selector === '#messageInput' ? this.input : null;
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }

  keydown(key) {
    for (const listener of this.listeners.get('keydown') || []) listener({ key });
  }
}

function conversation(id, title = `Sohbet ${id}`, content = `mesaj ${id}`, updatedAt = '2026-08-18T19:00:00.000Z') {
  return {
    id,
    title,
    agentId: 'minimal-engineer',
    toolsEnabled: false,
    createdAt: '2026-08-18T18:00:00.000Z',
    updatedAt,
    messages: [{ id: `m-${id}`, role: 'user', content, at: updatedAt }]
  };
}

function createTimerHarness() {
  let nextId = 0;
  const timers = new Map();
  return {
    setTimeoutImpl(callback, delay) {
      const id = ++nextId;
      timers.set(id, { callback, delay });
      return id;
    },
    clearTimeoutImpl(id) {
      timers.delete(id);
    },
    fire(delay) {
      for (const [id, timer] of [...timers]) {
        if (timer.delay === delay) {
          timers.delete(id);
          timer.callback();
        }
      }
    },
    size: () => timers.size
  };
}

function createFixture(values) {
  const storage = new MemoryStorage({ [guard.STORAGE_KEY]: JSON.stringify(values) });
  const boundary = guard.installWriteBoundary(storage);
  assert.ok(boundary, 'conversation guard must install before undo wrapper');
  const documentRef = new FakeDocument();
  const timers = createTimerHarness();
  let reloads = 0;
  const rootRef = { location: { reload: () => { reloads += 1; } } };
  const controller = undo.createController({
    rootRef,
    documentRef,
    storage,
    guardApi: guard,
    setTimeoutImpl: timers.setTimeoutImpl,
    clearTimeoutImpl: timers.clearTimeoutImpl
  });
  return { storage, boundary, documentRef, timers, controller, reloads: () => reloads };
}

{
  assert.equal(undo.normalizeConversationId('abc-123'), 'abc-123');
  assert.equal(undo.normalizeConversationId('../bad'), null);
  assert.equal(undo.normalizeConversationId('x'.repeat(121)), null);
  assert.equal(undo.normalizeTitle('  A\n B  '), 'A B');
  assert.equal(undo.normalizeTitle('\u0000'), 'Bu sohbet');
  const a = conversation('a');
  const b = conversation('b');
  assert.equal(undo.findSingleDeletion([a, b], [b])?.id, 'a');
  assert.equal(undo.findSingleDeletion([a, b], []), null, 'bulk clear must not become undoable single-delete');
  assert.equal(undo.findSingleDeletion([a], [a]), null);
}

{
  const a = conversation('a', 'Önemli sohbet');
  const b = conversation('b');
  const fixture = createFixture([a, b]);
  fixture.storage.setItem(guard.STORAGE_KEY, JSON.stringify([b]));
  assert.deepEqual(fixture.controller.snapshot(), { pending: true, pendingId: 'a', wrapperMode: 'instance' });
  assert.equal(fixture.timers.size(), 1);
  assert.equal(fixture.controller.restore(), true);
  const restored = guard.sanitizeStoredValue(fixture.storage.getItem(guard.STORAGE_KEY)).value;
  assert.equal(restored.some((item) => item.id === 'a'), true);
  assert.equal(fixture.reloads(), 1, 'empty composer can reload to reflect restored conversation');
  assert.equal(fixture.controller.snapshot().pending, false);
  fixture.controller.destroy();
}

{
  const a = conversation('a');
  const b = conversation('b');
  const fixture = createFixture([a, b]);
  fixture.storage.setItem(guard.STORAGE_KEY, JSON.stringify([b]));
  fixture.documentRef.input.value = 'Gönderilmemiş taslak';
  assert.equal(fixture.controller.restore(), true);
  assert.equal(fixture.reloads(), 0, 'undo must not reload over an unsent draft');
  assert.equal(fixture.documentRef.body.children[0].classList.contains('hidden'), false);
  fixture.timers.fire(4_000);
  assert.equal(fixture.documentRef.body.children[0].classList.contains('hidden'), true);
  fixture.controller.destroy();
}

{
  const a = conversation('a');
  const b = conversation('b');
  const fixture = createFixture([a, b]);
  fixture.storage.setItem(guard.STORAGE_KEY, JSON.stringify([b]));
  fixture.timers.fire(undo.UNDO_WINDOW_MS);
  assert.equal(fixture.controller.snapshot().pending, false, 'deleted content must leave memory after bounded window');
  assert.equal(fixture.controller.restore(), false);
  fixture.controller.destroy();
}

{
  const a = conversation('a');
  const b = conversation('b');
  const fixture = createFixture([a, b]);
  fixture.storage.setItem(guard.STORAGE_KEY, JSON.stringify([]));
  assert.equal(fixture.controller.snapshot().pending, false, 'clear history must not retain multiple conversations in undo memory');
  fixture.controller.destroy();
}

{
  const a = conversation('a');
  const b = conversation('b');
  const fixture = createFixture([a, b]);
  const remoteA = conversation('a', 'Uzak sekmede güncellendi', 'yeni içerik', '2026-08-18T20:00:00.000Z');
  fixture.boundary.originalSetItem(guard.STORAGE_KEY, JSON.stringify([remoteA, b]));
  fixture.storage.setItem(guard.STORAGE_KEY, JSON.stringify([b]));
  const persisted = guard.sanitizeStoredValue(fixture.storage.getItem(guard.STORAGE_KEY)).value;
  assert.equal(persisted.some((item) => item.id === 'a'), true, 'cross-tab remote update must win over stale local delete');
  assert.equal(fixture.controller.snapshot().pending, false, 'undo must not arm when conflict guard preserved the conversation');
  fixture.controller.destroy();
}

{
  const fixture = createFixture([conversation('a')]);
  fixture.storage.setItem('other.key', 'untouched');
  assert.equal(fixture.storage.getItem('other.key'), 'untouched');
  fixture.controller.destroy();
  fixture.storage.setItem(guard.STORAGE_KEY, '[]');
  assert.equal(fixture.controller.snapshot().pending, false, 'destroyed controller must stay inert');
}

console.log('conversation delete undo tests passed');
