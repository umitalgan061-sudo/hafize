import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const api = require('../public/scroll-to-latest.js');

class Target {
  constructor({ throwOnAdd = null } = {}) {
    this.listeners = new Map();
    this.throwOnAdd = throwOnAdd;
  }
  addEventListener(type, handler) {
    if (this.throwOnAdd === type) throw new Error(`add listener failed:${type}`);
    const list = this.listeners.get(type) || [];
    list.push(handler);
    this.listeners.set(type, list);
  }
  removeEventListener(type, handler) {
    this.listeners.set(type, (this.listeners.get(type) || []).filter((value) => value !== handler));
  }
  emit(type, event = {}) {
    for (const handler of [...(this.listeners.get(type) || [])]) handler(event);
  }
  count(type) { return (this.listeners.get(type) || []).length; }
}

class Element extends Target {
  constructor(tag = 'div', options = {}) {
    super(options);
    this.tagName = tag.toUpperCase();
    this.id = '';
    this.type = '';
    this.className = '';
    this.hidden = false;
    this.dataset = {};
    this.textContent = '';
    this.attributes = new Map();
    this.children = [];
    this.parentNode = null;
  }
  append(...nodes) {
    for (const node of nodes) {
      node.parentNode = this;
      this.children.push(node);
    }
  }
  remove() {
    if (!this.parentNode) return;
    this.parentNode.children = this.parentNode.children.filter((node) => node !== this);
    this.parentNode = null;
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
  removeAttribute(name) { this.attributes.delete(name); }
}

function makeFixture({
  hostButton = null,
  throwButtonClickListener = false,
  throwWindowScrollListener = false,
  observerConstructorThrows = false,
  observerObserveThrows = false,
  rafThrows = false
} = {}) {
  const messages = new Element('main');
  messages.id = 'messages';
  const head = new Element('head');
  const body = new Element('body');
  body.scrollHeight = 1000;
  body.append(messages);
  if (hostButton) body.append(hostButton);

  const documentRef = {
    head,
    body,
    documentElement: { scrollHeight: 1000 },
    querySelector(selector) {
      if (selector === '#messages') return messages;
      if (selector === `#${api.BUTTON_ID}`) return body.children.find((node) => node.id === api.BUTTON_ID) || null;
      if (selector === `#${api.STYLE_ID}`) return head.children.find((node) => node.id === api.STYLE_ID) || null;
      return null;
    },
    createElement(tag) {
      if (tag === 'button' && throwButtonClickListener) return new Element(tag, { throwOnAdd: 'click' });
      return new Element(tag);
    }
  };

  const windowRef = new Target({ throwOnAdd: throwWindowScrollListener ? 'scroll' : null });
  windowRef.scrollY = 500;
  windowRef.innerHeight = 500;
  windowRef.scrollCalls = [];
  windowRef.scrollTo = (options) => windowRef.scrollCalls.push(options);

  let observer = null;
  class Observer {
    constructor(callback) {
      if (observerConstructorThrows) throw new Error('observer constructor failed');
      this.callback = callback;
      this.disconnected = false;
      observer = this;
    }
    observe() {
      if (observerObserveThrows) throw new Error('observer observe failed');
      this.observing = true;
    }
    disconnect() { this.disconnected = true; }
  }

  const frames = new Map();
  let nextFrame = 1;
  function requestAnimationFrameImpl(callback) {
    if (rafThrows) throw new Error('raf failed');
    const id = nextFrame++;
    frames.set(id, callback);
    return id;
  }
  function cancelAnimationFrameImpl(id) { frames.delete(id); }
  function flush() {
    for (const [id, callback] of [...frames]) {
      frames.delete(id);
      callback();
    }
  }

  return {
    body,
    head,
    messages,
    documentRef,
    windowRef,
    frames,
    flush,
    observer: () => observer,
    options: {
      documentRef,
      windowRef,
      MutationObserverImpl: Observer,
      requestAnimationFrameImpl,
      cancelAnimationFrameImpl,
      matchMediaImpl: () => ({ matches: false })
    }
  };
}

{
  const f = makeFixture();
  const first = api.createController(f.options);
  const second = api.createController(f.options);
  assert.equal(first.mount(), true);
  assert.equal(second.mount(), false, 'document ownership blocks duplicate controller');
  assert.equal(f.windowRef.count('scroll'), 1);
  assert.equal(f.documentRef.querySelector(`#${api.BUTTON_ID}`).count('click'), 1);
  first.destroy();
  assert.equal(f.windowRef.count('scroll'), 0);
  assert.equal(second.mount(), true, 'ownership is released after first controller teardown');
  second.destroy();
}

for (const scenario of [
  { name: 'button listener', options: { throwButtonClickListener: true } },
  { name: 'window listener', options: { throwWindowScrollListener: true } },
  { name: 'observer constructor', options: { observerConstructorThrows: true } },
  { name: 'observer observe', options: { observerObserveThrows: true } },
  { name: 'animation frame', options: { rafThrows: true } }
]) {
  const f = makeFixture(scenario.options);
  const controller = api.createController(f.options);
  assert.equal(controller.mount(), false, `${scenario.name} failure must fail closed`);
  assert.equal(controller.snapshot().mounted, false);
  assert.equal(controller.snapshot().ownsDocument, false, `${scenario.name} failure releases ownership`);
  assert.equal(f.windowRef.count('scroll'), 0, `${scenario.name} failure rolls back scroll listener`);
  assert.equal(f.documentRef.querySelector(`#${api.BUTTON_ID}`), null, `${scenario.name} failure removes owned button`);
  assert.equal(f.documentRef.querySelector(`#${api.STYLE_ID}`), null, `${scenario.name} failure removes owned style`);
  assert.equal(f.frames.size, 0, `${scenario.name} failure leaves no RAF`);

  const retry = api.createController(makeFixture().options);
  assert.equal(retry.mount(), true, `${scenario.name} failure must not poison future independent mount`);
  retry.destroy();
}

{
  const host = new Element('button');
  host.id = api.BUTTON_ID;
  host.hidden = true;
  host.textContent = 'Host-owned';
  host.setAttribute('aria-label', 'Host aria');
  const f = makeFixture({ hostButton: host, observerObserveThrows: true });
  const controller = api.createController(f.options);
  assert.equal(controller.mount(), false);
  assert.equal(host.parentNode, f.body, 'failed mount never removes host button');
  assert.equal(host.hidden, true);
  assert.equal(host.textContent, 'Host-owned');
  assert.equal(host.getAttribute('aria-label'), 'Host aria');
  assert.equal(Object.prototype.hasOwnProperty.call(host.dataset, 'state'), false, 'absent host dataset state is restored as absent');
  assert.equal(host.count('click'), 0);
}

{
  const f = makeFixture();
  const controller = api.createController(f.options);
  assert.equal(controller.mount(), true);
  const button = f.documentRef.querySelector(`#${api.BUTTON_ID}`);
  const staleObserver = f.observer();
  const staleScroll = f.windowRef.listeners.get('scroll')[0];
  const staleClick = button.listeners.get('click')[0];
  assert.ok(staleObserver);
  assert.equal(controller.destroy(), true);
  const before = f.windowRef.scrollCalls.length;
  staleObserver.callback();
  staleScroll();
  staleClick();
  assert.equal(f.windowRef.scrollCalls.length, before, 'callbacks captured before teardown remain inert');
  assert.equal(controller.scheduleMeasure(), false);
  assert.equal(controller.handleMutation(), false);
  assert.equal(controller.handleScroll(), false);
  assert.equal(controller.handleButtonClick(), false);
  assert.equal(controller.scrollToBottom(), false);
}

{
  const f = makeFixture();
  const controller = api.createController(f.options);
  assert.equal(controller.mount(), true);
  const initialGeneration = controller.snapshot().generation;
  const pendingFrame = [...f.frames.values()][0];
  assert.equal(typeof pendingFrame, 'function');
  controller.destroy();
  const afterDestroy = controller.snapshot();
  assert.ok(afterDestroy.generation > initialGeneration);
  pendingFrame();
  assert.equal(controller.snapshot().framePending, false);
  assert.equal(f.windowRef.scrollCalls.length, 0, 'stale frame does not scroll after teardown');
}

assert.throws(() => api.createController({ documentRef: null }), /INVALID_SCROLL_TO_LATEST_DOCUMENT/);
assert.throws(() => api.createController({
  documentRef: { querySelector() {}, createElement() {} },
  windowRef: null,
  requestAnimationFrameImpl() {},
  cancelAnimationFrameImpl() {}
}), /INVALID_SCROLL_TO_LATEST_WINDOW/);
assert.throws(() => api.createController({
  documentRef: { querySelector() {}, createElement() {} },
  windowRef: { addEventListener() {}, removeEventListener() {}, scrollTo() {} },
  requestAnimationFrameImpl: null,
  cancelAnimationFrameImpl() {}
}), /INVALID_SCROLL_TO_LATEST_FRAME/);

console.log('scroll-to-latest installation lifecycle tests passed');
