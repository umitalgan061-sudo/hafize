import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const api = require('../public/scroll-to-latest.js');

class Target {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, handler) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(handler);
    this.listeners.set(type, listeners);
  }
  removeEventListener(type, handler) {
    this.listeners.set(type, (this.listeners.get(type) || []).filter((item) => item !== handler));
  }
  emit(type, event = {}) {
    for (const handler of [...(this.listeners.get(type) || [])]) handler(event);
  }
  listenerCount(type) { return (this.listeners.get(type) || []).length; }
}

class Element extends Target {
  constructor(tag = 'div') {
    super();
    this.tagName = tag.toUpperCase();
    this.id = '';
    this.type = '';
    this.className = '';
    this.hidden = false;
    this.dataset = {};
    this.textContent = '';
    this.attributes = new Map();
    this.removeCalls = 0;
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  remove() { this.removeCalls += 1; }
}

class Observer {
  constructor(callback) {
    this.callback = callback;
    this.disconnected = false;
  }
  observe() {}
  disconnect() { this.disconnected = true; }
  trigger() { this.callback([]); }
}

function createHarness({ preexisting = false, cancelRemovesFrame = true } = {}) {
  const messages = new Element('div');
  messages.id = 'messages';
  const body = new Element('body');
  body.scrollHeight = 1400;
  body.nodes = [];
  body.append = (node) => body.nodes.push(node);
  const head = { nodes: [], append(node) { this.nodes.push(node); } };
  const existing = preexisting ? new Element('button') : null;
  if (existing) {
    existing.id = api.BUTTON_ID;
    existing.dataset.state = 'host';
    existing.textContent = 'Host control';
    body.nodes.push(existing);
  }

  const documentRef = {
    head,
    body,
    documentElement: { scrollHeight: 1400 },
    querySelector(selector) {
      if (selector === '#messages') return messages;
      if (selector === `#${api.BUTTON_ID}`) {
        return body.nodes.find((node) => node.id === api.BUTTON_ID && node.removeCalls === 0) || null;
      }
      if (selector === `#${api.STYLE_ID}`) return head.nodes.find((node) => node.id === api.STYLE_ID) || null;
      return null;
    },
    createElement(tag) { return new Element(tag); }
  };

  const windowRef = new Target();
  windowRef.scrollY = 200;
  windowRef.innerHeight = 400;
  windowRef.scrollCalls = [];
  windowRef.scrollTo = (options) => {
    windowRef.scrollCalls.push(options);
    windowRef.scrollY = options.top;
  };

  let nextFrame = 1;
  const frames = new Map();
  const cancelled = [];
  function requestAnimationFrameImpl(callback) {
    const id = nextFrame++;
    frames.set(id, callback);
    return id;
  }
  function cancelAnimationFrameImpl(id) {
    cancelled.push(id);
    if (cancelRemovesFrame) frames.delete(id);
  }
  function runFrame(id) {
    const callback = frames.get(id);
    if (!callback) return false;
    frames.delete(id);
    callback();
    return true;
  }
  function runAllFrames() {
    for (const id of [...frames.keys()]) runFrame(id);
  }

  const controller = api.createController({
    documentRef,
    windowRef,
    MutationObserverImpl: Observer,
    requestAnimationFrameImpl,
    cancelAnimationFrameImpl,
    matchMediaImpl: () => ({ matches: false })
  });

  return {
    controller,
    existing,
    body,
    messages,
    windowRef,
    frames,
    cancelled,
    runFrame,
    runAllFrames,
    button() { return body.nodes.find((node) => node.id === api.BUTTON_ID && node.removeCalls === 0) || existing; }
  };
}

{
  const h = createHarness({ preexisting: true });
  assert.equal(h.controller.scrollToBottom(), false, 'unmounted controller must not scroll');
  assert.equal(h.controller.handleScroll(), false);
  assert.equal(h.controller.handleMutation(), false);
  assert.equal(h.controller.scheduleMeasure(), false);
  assert.equal(h.frames.size, 0);

  assert.equal(h.controller.mount(), true);
  assert.equal(h.controller.snapshot().mounted, true);
  assert.equal(h.controller.snapshot().buttonOwned, false);
  assert.equal(h.controller.snapshot().generation, 1);
  assert.equal(h.existing.listenerCount('click'), 1);
  assert.equal(h.windowRef.listenerCount('scroll'), 1);
  assert.equal(h.frames.size, 1, 'mount queues one measurement');
  h.runAllFrames();

  h.existing.emit('click');
  assert.equal(h.windowRef.scrollCalls.length, 1);
  assert.equal(h.windowRef.scrollCalls[0].behavior, 'smooth');
  assert.equal(h.frames.size, 1);
  const pendingFrame = [...h.frames.keys()][0];

  assert.equal(h.controller.destroy(), true);
  assert.equal(h.controller.snapshot().mounted, false);
  assert.equal(h.controller.snapshot().buttonOwned, false);
  assert.equal(h.controller.snapshot().generation, 2);
  assert.equal(h.controller.snapshot().framePending, false);
  assert.equal(h.existing.removeCalls, 0, 'preexisting host control must survive controller teardown');
  assert.equal(h.existing.listenerCount('click'), 0, 'only the controller click listener is removed');
  assert.equal(h.windowRef.listenerCount('scroll'), 0);
  assert.deepEqual(h.cancelled, [pendingFrame]);
  assert.equal(h.controller.destroy(), false, 'double destroy is a no-op');

  const callsAfterDestroy = h.windowRef.scrollCalls.length;
  assert.equal(h.controller.handleScroll(), false);
  assert.equal(h.controller.handleMutation(), false);
  assert.equal(h.controller.scrollToBottom({ smooth: true }), false);
  assert.equal(h.controller.scheduleMeasure(), false);
  h.existing.emit('click');
  assert.equal(h.windowRef.scrollCalls.length, callsAfterDestroy);
  assert.equal(h.frames.size, 0, 'post-destroy public handlers must not reactivate RAF work');

  assert.equal(h.controller.mount(), true);
  assert.equal(h.controller.snapshot().generation, 3);
  assert.equal(h.existing.listenerCount('click'), 1, 'remount must not accumulate click listeners');
  h.runAllFrames();
  assert.equal(h.controller.destroy(), true);
  assert.equal(h.existing.listenerCount('click'), 0);
  assert.equal(h.existing.removeCalls, 0);
}

{
  const h = createHarness({ preexisting: false });
  assert.equal(h.controller.mount(), true);
  const owned = h.button();
  assert.ok(owned);
  assert.equal(h.controller.snapshot().buttonOwned, true);
  assert.equal(owned.listenerCount('click'), 1);
  h.runAllFrames();
  assert.equal(h.controller.destroy(), true);
  assert.equal(owned.listenerCount('click'), 0);
  assert.equal(owned.removeCalls, 1, 'controller-owned control is removed on teardown');
}

{
  const h = createHarness({ preexisting: true, cancelRemovesFrame: false });
  assert.equal(h.controller.mount(), true);
  const staleFrame = [...h.frames.keys()][0];
  assert.ok(staleFrame);
  assert.equal(h.controller.destroy(), true);
  assert.equal(h.frames.has(staleFrame), true, 'test harness intentionally keeps a cancelled callback alive');

  assert.equal(h.controller.mount(), true);
  const currentFrame = [...h.frames.keys()].find((id) => id !== staleFrame);
  assert.ok(currentFrame);
  assert.equal(h.controller.snapshot().framePending, true);
  const textBeforeStale = h.existing.textContent;
  assert.equal(h.runFrame(staleFrame), true);
  assert.equal(h.existing.textContent, textBeforeStale, 'old generation RAF must not mutate the remounted control');
  assert.equal(h.controller.snapshot().framePending, true, 'old RAF must not clear the current generation frame');
  assert.equal(h.frames.has(currentFrame), true);
  h.runFrame(currentFrame);
  assert.equal(h.controller.snapshot().framePending, false);
  assert.equal(h.controller.destroy(), true);
}

console.log('scroll-to-latest lifecycle tests passed');