import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { copyFile, unlink } from 'node:fs/promises';

const source = new URL('../public/conversation-model-state.js', import.meta.url);
const copy = new URL('../public/conversation-model-state.test.cjs', import.meta.url);
await copyFile(source, copy);
const require = createRequire(import.meta.url);
const api = require(copy.pathname);
await unlink(copy);

class ClassList {
  constructor(...values) { this.values = new Set(values); }
  contains(value) { return this.values.has(value); }
  add(value) { this.values.add(value); }
  remove(value) { this.values.delete(value); }
}
class Target {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, fn) { this.listeners.set(type, [...(this.listeners.get(type) || []), fn]); }
  removeEventListener(type, fn) { this.listeners.set(type, (this.listeners.get(type) || []).filter((item) => item !== fn)); }
  dispatchEvent(event) { for (const fn of this.listeners.get(event.type) || []) fn(event); return true; }
}
class Observer {
  static instances = [];
  constructor(callback) { this.callback = callback; this.observed = []; this.disconnected = false; Observer.instances.push(this); }
  observe(node, options) { this.observed.push({ node, options }); }
  disconnect() { this.disconnected = true; }
  trigger() { this.callback([]); }
}
class Event { constructor(type) { this.type = type; } }

function storage(initial = []) {
  let raw = JSON.stringify(initial);
  return {
    getItem(key) { return key === api.STORAGE_KEY ? raw : null; },
    setItem(key, value) { if (key === api.STORAGE_KEY) raw = value; },
    value() { return JSON.parse(raw); }
  };
}
function harness({ conversations, activeIndex = 0, selected = 'nvidia/model-a', disabled = false }) {
  const select = new Target();
  select.options = [{ value: 'nvidia/model-a' }, { value: 'local:llama3' }, { value: '' }];
  select.value = selected;
  select.disabled = disabled;
  const send = new Target();
  send.classList = new ClassList();
  const rows = conversations.map((_, index) => ({ classList: new ClassList(...(index === activeIndex ? ['active'] : [])) }));
  const list = { querySelectorAll(value) { return value === '.conversation-row' ? rows : []; } };
  const documentRef = { querySelector(value) {
    if (value === '#modelSelect') return select;
    if (value === '#sendBtn') return send;
    if (value === '#conversationList') return list;
    return null;
  } };
  const store = storage(conversations);
  const queued = [];
  const controller = api.createController({ documentRef, storage: store, MutationObserverImpl: Observer, EventImpl: Event, queueMicrotaskImpl(fn) { queued.push(fn); } });
  return { controller, select, send, rows, store, queued };
}

assert.equal(api.normalizeModelId(' local:llama3 '), 'local:llama3');
assert.equal(api.normalizeModelId('bad\nmodel'), '');
assert.equal(api.normalizeModelId('x'.repeat(api.MAX_MODEL_ID_LENGTH + 1)), '');
assert.deepEqual([...api.modelIds({ options: [{ value: 'a' }, { value: 'a' }, { value: '' }] })], ['a']);

{
  const h = harness({ conversations: [{ id: 'a', modelId: 'local:llama3' }, { id: 'b', modelId: 'nvidia/model-a' }] });
  assert.equal(h.controller.mount(), true);
  assert.equal(h.select.value, 'local:llama3');
  assert.equal(Observer.instances.at(-1).observed.length, 3);
  h.rows[0].classList.remove('active'); h.rows[1].classList.add('active');
  Observer.instances.at(-1).trigger(); h.queued.shift()();
  assert.equal(h.select.value, 'nvidia/model-a');
  h.select.value = 'local:llama3'; h.select.dispatchEvent(new Event('change'));
  assert.equal(h.store.value()[1].modelId, 'local:llama3');
  h.send.classList.add('streaming'); Observer.instances.at(-1).trigger(); h.queued.shift()();
  assert.equal(h.select.disabled, true);
  h.select.value = 'nvidia/model-a'; h.select.dispatchEvent(new Event('change'));
  assert.equal(h.store.value()[1].modelId, 'local:llama3');
  h.send.classList.remove('streaming'); Observer.instances.at(-1).trigger(); h.queued.shift()();
  assert.equal(h.select.disabled, false);
  assert.equal(h.select.value, 'local:llama3');
  assert.equal(h.controller.destroy(), true);
  assert.equal(Observer.instances.at(-1).disconnected, true);
}
{
  const h = harness({ conversations: [{ id: 'legacy' }], selected: 'nvidia/model-a' });
  h.controller.mount();
  assert.equal(h.store.value()[0].modelId, 'nvidia/model-a');
}
{
  const h = harness({ conversations: [{ id: 'stale', modelId: 'removed/model' }], selected: 'local:llama3', disabled: true });
  h.controller.mount();
  assert.equal(h.store.value()[0].modelId, 'local:llama3');
  h.send.classList.add('streaming'); h.controller.syncRunLock();
  h.send.classList.remove('streaming'); h.controller.syncRunLock();
  assert.equal(h.select.disabled, true);
}
{
  const bad = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.deepEqual(api.readConversations(bad), []);
  assert.equal(api.writeConversations(bad, []), false);
}
console.log('conversation model state tests passed');
