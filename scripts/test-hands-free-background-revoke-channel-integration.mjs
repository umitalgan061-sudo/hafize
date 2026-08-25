import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { installHandsFree, HANDS_FREE_REVOKE_EVENT } = require('../public/hands-free.js');
const {
  installHandsFreeBackgroundGuard,
  REVOKED_ATTR
} = require('../public/hands-free-background-guard.js');

class FakeTarget {
  constructor() {
    this.listeners = new Map();
  }

  addEventListener(type, listener, capture = false) {
    const entries = this.listeners.get(type) || [];
    entries.push({ listener, capture: Boolean(capture) });
    this.listeners.set(type, entries);
  }

  removeEventListener(type, listener, capture = false) {
    const entries = this.listeners.get(type) || [];
    this.listeners.set(type, entries.filter((entry) => (
      entry.listener !== listener || entry.capture !== Boolean(capture)
    )));
  }

  dispatchEvent(event) {
    const entries = [...(this.listeners.get(event.type) || [])];
    for (const entry of entries.filter((item) => item.capture)) entry.listener(event);
    for (const entry of entries.filter((item) => !item.capture)) entry.listener(event);
    return true;
  }

  dispatch(type, detail = undefined) {
    return this.dispatchEvent({ type, detail });
  }

  listenerCount(type) {
    return (this.listeners.get(type) || []).length;
  }
}

class FakeClassList {
  constructor() { this.values = new Set(); }
  add(value) { this.values.add(value); }
  remove(value) { this.values.delete(value); }
  contains(value) { return this.values.has(value); }
}

function createElement(initial = {}) {
  const target = new FakeTarget();
  const attrs = new Map(Object.entries(initial.attrs || {}));
  return Object.assign(target, {
    attrs,
    classList: new FakeClassList(),
    disabled: Boolean(initial.disabled),
    hidden: Boolean(initial.hidden),
    textContent: initial.textContent || '',
    clickCount: 0,
    getAttribute(name) { return attrs.has(name) ? attrs.get(name) : null; },
    setAttribute(name, value) { attrs.set(name, String(value)); },
    removeAttribute(name) { attrs.delete(name); },
    hasAttribute(name) { return attrs.has(name); },
    click() {
      this.clickCount += 1;
      throw new Error('PROGRAMMATIC_TOGGLE_CLICK_FORBIDDEN');
    }
  });
}

function createHarness() {
  const documentRef = new FakeTarget();
  const root = new FakeTarget();
  const toggle = createElement({ attrs: { 'aria-pressed': 'false' } });
  const indicator = createElement({ hidden: true });
  const micButton = createElement();
  const input = createElement();
  const toast = createElement();
  toast.classList.add('hidden');

  documentRef.hidden = false;
  documentRef.documentElement = { lang: 'tr-TR' };
  documentRef.querySelector = (selector) => ({
    '#handsFreeToggle': toggle,
    '#handsFreeIndicator': indicator,
    '#micBtn': micButton,
    '#messageInput': input,
    '#toast': toast
  })[selector] || null;

  class FakeCustomEvent {
    constructor(type, options = {}) {
      this.type = type;
      this.detail = options.detail;
    }
  }
  root.CustomEvent = FakeCustomEvent;

  const recognitionInstances = [];
  class FakeRecognition {
    constructor() {
      this.aborted = false;
      recognitionInstances.push(this);
    }
    start() { this.onstart?.(); }
    abort() { this.aborted = true; }
    stop() {}
  }
  root.SpeechRecognition = FakeRecognition;
  root.navigator = { language: 'tr-TR' };
  root.MutationObserver = class {
    observe() {}
    disconnect() {}
  };

  const timers = new Map();
  let timerId = 0;
  root.setTimeout = (callback, delay) => {
    timerId += 1;
    timers.set(timerId, { callback, delay });
    return timerId;
  };
  root.clearTimeout = (id) => timers.delete(id);

  return {
    documentRef,
    root,
    toggle,
    indicator,
    toast,
    recognitionInstances,
    timers
  };
}

{
  const harness = createHarness();
  const runtime = installHandsFree(harness.documentRef, harness.root);
  const guard = installHandsFreeBackgroundGuard(harness.documentRef, harness.root);
  assert.ok(runtime && guard);
  assert.equal(harness.documentRef.listenerCount(HANDS_FREE_REVOKE_EVENT), 1);

  runtime.enable();
  assert.equal(runtime.isEnabled(), true);
  assert.equal(harness.recognitionInstances.length, 1);
  assert.equal(harness.toggle.clickCount, 0);

  harness.documentRef.hidden = true;
  harness.documentRef.dispatch('visibilitychange');

  assert.equal(runtime.isEnabled(), false);
  assert.equal(harness.recognitionInstances[0].aborted, true);
  assert.equal(harness.toggle.clickCount, 0, 'real DOM event path must not synthesize a toggle click');
  assert.equal(guard.getLastReason(), 'hidden');
  assert.equal(harness.toggle.getAttribute(REVOKED_ATTR), 'hidden');
  assert.equal(harness.timers.size, 0);

  harness.documentRef.hidden = false;
  harness.documentRef.dispatch('visibilitychange');
  assert.equal(runtime.isEnabled(), false, 'returning visible cannot re-enable microphone');
  assert.equal(harness.toggle.clickCount, 0);

  guard.destroy();
  runtime.destroy();
}

{
  const harness = createHarness();
  const runtime = installHandsFree(harness.documentRef, harness.root);
  const guard = installHandsFreeBackgroundGuard(harness.documentRef, harness.root);
  runtime.enable();

  harness.root.dispatch('blur');
  assert.equal(runtime.isEnabled(), false, 'desktop focus loss must revoke through runtime');
  assert.equal(guard.getLastReason(), 'window-blur');
  assert.equal(harness.toggle.clickCount, 0);

  harness.root.dispatch('focus');
  assert.equal(runtime.isEnabled(), false, 'focus restoration requires fresh explicit consent');
  assert.equal(harness.toast.classList.contains('hidden'), false, 'revocation notice becomes visible on return');

  guard.destroy();
  runtime.destroy();
}

{
  const harness = createHarness();
  const guard = installHandsFreeBackgroundGuard(harness.documentRef, harness.root);
  harness.toggle.setAttribute('aria-pressed', 'true');

  harness.root.dispatch('pagehide');
  assert.equal(guard.getLastReason(), 'revocation-failed', 'missing runtime listener must fail closed visibly');
  assert.equal(harness.toggle.getAttribute(REVOKED_ATTR), 'revocation-failed');
  assert.equal(harness.toggle.getAttribute('aria-pressed'), 'true', 'guard must not fake successful disable');
  assert.equal(harness.toggle.clickCount, 0, 'DOM path must not fall back to synthetic click after runtime failure');

  guard.destroy();
}

{
  const harness = createHarness();
  const runtime = installHandsFree(harness.documentRef, harness.root);
  const guard = installHandsFreeBackgroundGuard(harness.documentRef, harness.root);
  runtime.enable();

  harness.documentRef.dispatch('freeze');
  assert.equal(runtime.isEnabled(), false);
  assert.equal(guard.getLastReason(), 'freeze');
  assert.equal(harness.toggle.clickCount, 0);

  guard.destroy();
  runtime.destroy();
  assert.equal(harness.documentRef.listenerCount(HANDS_FREE_REVOKE_EVENT), 0);
}

console.log('hands-free background revoke channel integration tests passed');