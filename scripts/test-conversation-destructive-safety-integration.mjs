import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function load(file) {
  const source = fs.readFileSync(new URL(file, import.meta.url), 'utf8');
  const module = { exports: {} };
  vm.runInNewContext(source, {
    module,
    exports: module.exports,
    globalThis: {},
    Map,
    Set,
    WeakMap,
    Object,
    Array,
    Date,
    JSON,
    String,
    Number,
    RegExp
  });
  return { api: module.exports, source };
}

const storageModule = load('../public/conversation-storage-guard.js');
const deleteModule = load('../public/conversation-delete-confirm.js');
const storageApi = storageModule.api;
const deleteApi = deleteModule.api;

const at = (minute) => `2026-08-18T20:${String(minute).padStart(2, '0')}:00.000Z`;
const message = (id, content, minute) => ({ id, role: 'user', content, at: at(minute) });
const conversation = (minute, messages) => ({
  id: 'conversation-1',
  title: 'Gizli proje başlığı',
  agentId: 'minimal-engineer',
  toolsEnabled: false,
  createdAt: at(0),
  updatedAt: at(minute),
  messages
});

{
  const base = [conversation(0, [message('m1', 'başlangıç', 0)])];
  const remote = [conversation(1, [message('m1', 'başlangıç', 0), message('remote', 'uzak gizli içerik', 1)])];
  const local = [conversation(2, [message('m1', 'başlangıç', 0), message('local', 'yerel gizli içerik', 2)])];
  const store = new Map([[storageApi.STORAGE_KEY, JSON.stringify(base)]]);
  const events = [];
  function CustomEvent(type, options) {
    this.type = type;
    this.detail = options?.detail;
  }
  const storage = {
    getItem(key) { return store.has(key) ? store.get(key) : null; },
    setItem(key, value) { store.set(key, String(value)); }
  };
  const rawSet = storage.setItem;
  const rootRef = {
    CustomEvent,
    dispatchEvent(event) { events.push(event); }
  };
  const writer = storageApi.createConflictAwareWriter({
    storage,
    originalSetItem: rawSet,
    originalGetItem: storage.getItem,
    initialSerialized: JSON.stringify(base),
    onMerge: storageApi.createMergeNotifier(rootRef)
  });

  rawSet.call(storage, storageApi.STORAGE_KEY, JSON.stringify(remote));
  writer.write(storageApi.STORAGE_KEY, JSON.stringify(local));

  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'hafize:conversation-storage-merged');
  assert.deepEqual(Object.keys(events[0].detail).sort(), ['conflicts', 'remoteChangesPreserved']);
  const eventWire = JSON.stringify(events[0]);
  assert.doesNotMatch(eventWire, /Gizli proje başlığı|uzak gizli içerik|yerel gizli içerik|conversation-1/);
  const persisted = JSON.parse(store.get(storageApi.STORAGE_KEY));
  assert.deepEqual(persisted[0].messages.map((item) => item.id), ['m1', 'remote', 'local']);
}

{
  let deleteCalls = 0;
  const attrs = new Map([['aria-label', 'Gizli proje başlığı sohbetini sil']]);
  const row = {
    classList: { contains: () => false },
    querySelector: (selector) => selector === '.conversation-open' ? { textContent: 'Gizli proje başlığı' } : null
  };
  const button = {
    textContent: '×',
    closest: (selector) => selector === '.conversation-row' ? row : null,
    setAttribute(name, value) { attrs.set(name, String(value)); },
    getAttribute(name) { return attrs.has(name) ? attrs.get(name) : null; },
    removeAttribute(name) { attrs.delete(name); },
    focus() {}
  };
  const listeners = new Map();
  const documentRef = {
    visibilityState: 'visible',
    addEventListener(type, fn, capture) { listeners.set(`${type}:${Boolean(capture)}`, fn); },
    removeEventListener() {},
    querySelector: () => ({ value: '' })
  };
  const timers = new Map();
  let timerId = 0;
  const controller = deleteApi.createController({
    documentRef,
    setTimeoutImpl(fn, ms) { timers.set(++timerId, { fn, ms }); return timerId; },
    clearTimeoutImpl(id) { timers.delete(id); }
  });
  controller.mount();

  const first = {
    target: { closest: (selector) => selector === '.conversation-delete' ? button : null },
    defaultPrevented: false,
    preventDefault() { this.defaultPrevented = true; },
    stopImmediatePropagation() { deleteCalls += 0; }
  };
  const firstAllowed = listeners.get('click:true')(first);
  if (firstAllowed) deleteCalls += 1;
  assert.equal(deleteCalls, 0, 'first destructive action must never reach app delete handler');
  assert.equal(first.defaultPrevented, true);
  assert.equal(button.textContent, 'Sil?');
  assert.equal([...timers.values()][0].ms, 8_000);

  const second = {
    target: first.target,
    defaultPrevented: false,
    preventDefault() { this.defaultPrevented = true; },
    stopImmediatePropagation() {}
  };
  const secondAllowed = listeners.get('click:true')(second);
  if (secondAllowed) deleteCalls += 1;
  assert.equal(deleteCalls, 1, 'only the second explicit action reaches the existing delete handler');
  assert.equal(second.defaultPrevented, false);
}

const sw = fs.readFileSync(new URL('../public/sw-policy.js', import.meta.url), 'utf8');
const loader = fs.readFileSync(new URL('../public/chat-run-controller.js', import.meta.url), 'utf8');
assert.match(sw, /const CURRENT_CACHE = `\$\{CACHE_PREFIX\}v\d+`;/);
assert.match(sw, /\/conversation-delete-confirm\.js/);
assert.match(sw, /\/conversation-storage-guard\.js/);
assert.match(sw, /pathname\.startsWith\('\/api\/'\).*network-only/s);
assert.match(loader, /HafizeConversationDeleteConfirm/);
assert.doesNotMatch(deleteModule.source, /confirm\s*\(/);
assert.doesNotMatch(storageModule.source, /fetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon/);

console.log('conversation destructive safety integration tests passed');