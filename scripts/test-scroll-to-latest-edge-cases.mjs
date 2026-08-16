import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const api = require('../public/scroll-to-latest.js');

class Target {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, handler) { this.listeners.set(type, handler); }
  removeEventListener(type, handler) {
    if (this.listeners.get(type) === handler) this.listeners.delete(type);
  }
  emit(type) { this.listeners.get(type)?.({}); }
}

function fixture({ reducedMotion = true, withMessages = true } = {}) {
  const messages = withMessages ? {} : null;
  const bodyNodes = [];
  const body = { scrollHeight: 1000, append(node) { bodyNodes.push(node); } };
  const head = { append() {} };
  const documentRef = {
    body,
    head,
    documentElement: { scrollHeight: 1000 },
    querySelector(selector) {
      if (selector === '#messages') return messages;
      if (selector === `#${api.BUTTON_ID}`) return bodyNodes.find((node) => node.id === api.BUTTON_ID && !node.removed) || null;
      return null;
    },
    createElement() {
      const node = new Target();
      node.dataset = {};
      node.hidden = false;
      node.setAttribute = () => {};
      node.remove = () => { node.removed = true; };
      return node;
    }
  };
  const windowRef = new Target();
  windowRef.scrollY = 100;
  windowRef.innerHeight = 400;
  windowRef.calls = [];
  windowRef.scrollTo = (options) => { windowRef.calls.push(options); windowRef.scrollY = options.top; };

  let mutation = null;
  class Observer {
    constructor(callback) { mutation = callback; }
    observe() {}
    disconnect() {}
  }
  const frames = [];
  const controller = api.createController({
    documentRef,
    windowRef,
    MutationObserverImpl: Observer,
    requestAnimationFrameImpl(callback) { frames.push(callback); return frames.length; },
    cancelAnimationFrameImpl() {},
    matchMediaImpl() { return { matches: reducedMotion }; }
  });
  return {
    controller,
    windowRef,
    bodyNodes,
    mutation: () => mutation?.(),
    flush() { while (frames.length) frames.shift()(); }
  };
}

const reduced = fixture({ reducedMotion: true });
assert.equal(reduced.controller.mount(), true);
assert.equal(reduced.controller.mount(), true, 'same controller mount must be idempotent');
reduced.flush();
assert.equal(reduced.bodyNodes.length, 1, 'duplicate mount must not create duplicate button');
const button = reduced.bodyNodes[0];
assert.equal(button.hidden, false, 'user away from bottom should see navigation control');
button.emit('click');
reduced.flush();
assert.equal(reduced.windowRef.calls.at(-1).behavior, 'auto', 'reduced-motion users must not receive smooth scrolling');

const normal = fixture({ reducedMotion: false });
assert.equal(normal.controller.mount(), true);
normal.flush();
normal.bodyNodes[0].emit('click');
normal.flush();
assert.equal(normal.windowRef.calls.at(-1).behavior, 'smooth');
normal.controller.destroy();
normal.controller.destroy();

const missing = fixture({ withMessages: false });
assert.equal(missing.controller.mount(), false, 'missing chat DOM must fail closed without creating controls');
assert.equal(missing.bodyNodes.length, 0);

assert.equal(api.distanceToBottom(), 0);
assert.equal(api.distanceToBottom({ scrollY: Infinity, innerHeight: NaN, scrollHeight: -10 }), 0);
assert.equal(api.isNearBottom({ scrollY: 0, innerHeight: 0, scrollHeight: 97 }), false);
assert.equal(api.isNearBottom({ scrollY: 0, innerHeight: 0, scrollHeight: 96 }), true);

console.log('scroll-to-latest accessibility edge-case tests passed');
