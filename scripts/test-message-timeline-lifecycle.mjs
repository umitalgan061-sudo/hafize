import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const api = require('../public/message-timeline.js');

class Observer {
  static instances = [];
  constructor(callback) {
    this.callback = callback;
    this.disconnected = false;
    this.observed = [];
    Observer.instances.push(this);
  }
  observe(node, options) { this.observed.push({ node, options }); }
  disconnect() { this.disconnected = true; }
  trigger() { this.callback([]); }
}

function classList(active = false) {
  return { contains(name) { return name === 'active' && active; } };
}

const conversation = {
  id: 'conversation-1',
  messages: [{ id: 'message-1', at: '2026-08-19T07:00:00.000Z' }]
};
let storageReads = 0;
const storage = {
  getItem(key) {
    assert.equal(key, api.STORAGE_KEY);
    storageReads += 1;
    return JSON.stringify([conversation]);
  }
};

const messages = {
  querySelectorAll() { return []; },
  insertBefore() {}
};
const list = {
  querySelectorAll(selector) {
    if (selector !== '.conversation-row') return [];
    return [{
      classList: classList(true),
      dataset: { conversationOrganizeId: 'conversation-1' }
    }];
  }
};
const head = { append() {} };
const documentRef = {
  head,
  querySelector(selector) {
    if (selector === '#messages') return messages;
    if (selector === '#conversationList') return list;
    if (selector === `#${api.STYLE_ID}`) return null;
    return null;
  },
  querySelectorAll(selector) {
    return selector === '#conversationList .conversation-row' ? list.querySelectorAll('.conversation-row') : [];
  },
  createElement(tag) {
    if (tag === 'style') return { id: '', textContent: '' };
    return {
      className: '',
      dataset: {},
      append() {},
      setAttribute() {},
      querySelector() { return null; }
    };
  }
};

const listeners = new Map();
const windowRef = {
  addEventListener(type, fn) { listeners.set(type, fn); },
  removeEventListener(type, fn) { if (listeners.get(type) === fn) listeners.delete(type); }
};
const queued = [];
const controller = api.createController({
  documentRef,
  storage,
  windowRef,
  MutationObserverImpl: Observer,
  queueMicrotaskImpl(fn) { queued.push(fn); }
});

assert.equal(controller.scheduleRender(), false, 'unmounted controllers must not queue work');
assert.equal(queued.length, 0);
assert.equal(controller.mount(), true);
assert.equal(storageReads, 1, 'mount performs one initial render');
assert.equal(controller.snapshot().mounted, true);
assert.equal(controller.snapshot().generation, 1);
assert.equal(listeners.has('storage'), true);
assert.equal(Observer.instances.length, 2, 'messages and sidebar identity are both observed');

assert.equal(controller.scheduleRender(), true);
assert.equal(controller.scheduleRender(), false, 'only one render may be queued per generation');
assert.equal(queued.length, 1);
assert.equal(controller.snapshot().scheduled, true);
const firstQueued = queued.shift();
const readsBeforeDestroy = storageReads;
assert.equal(controller.destroy(), true);
assert.equal(controller.snapshot().mounted, false);
assert.equal(controller.snapshot().scheduled, false);
assert.equal(controller.snapshot().generation, 2);
assert.equal(listeners.has('storage'), false);
assert.equal(Observer.instances.every((observer) => observer.disconnected), true);
firstQueued();
assert.equal(storageReads, readsBeforeDestroy, 'queued work must be inert after destroy');
assert.equal(controller.destroy(), false, 'double destroy is a no-op');

assert.equal(controller.mount(), true);
assert.equal(controller.snapshot().generation, 3);
const readsAfterRemount = storageReads;
assert.equal(controller.scheduleRender(), true);
const staleGenerationCallback = queued.shift();
assert.equal(controller.destroy(), true);
assert.equal(controller.mount(), true);
assert.equal(controller.snapshot().generation, 5);
assert.equal(storageReads, readsAfterRemount + 1, 'new mount performs its own render');
const readsBeforeStaleCallback = storageReads;
staleGenerationCallback();
assert.equal(storageReads, readsBeforeStaleCallback, 'an old generation callback must not render into a remounted controller');

const currentObserver = Observer.instances.at(-2);
assert.ok(currentObserver);
currentObserver.trigger();
assert.equal(queued.length, 1, 'current generation observer may queue one render');
queued.shift()();
assert.equal(storageReads, readsBeforeStaleCallback + 1);

const readsBeforeFinalDestroy = storageReads;
assert.equal(controller.destroy(), true);
controller.onStorage({ key: api.STORAGE_KEY });
assert.equal(queued.length, 0, 'manual storage callback after destroy must remain inert');
assert.equal(storageReads, readsBeforeFinalDestroy);

console.log('message timeline lifecycle tests passed');