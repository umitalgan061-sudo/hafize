import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  HANDS_FREE_REVOKE_EVENT,
  installHandsFree
} = require('../public/hands-free.js');

class FakeTarget {
  constructor() {
    this.listeners = new Map();
  }

  addEventListener(type, listener) {
    const entries = this.listeners.get(type) || [];
    entries.push(listener);
    this.listeners.set(type, entries);
  }

  removeEventListener(type, listener) {
    const entries = this.listeners.get(type) || [];
    this.listeners.set(type, entries.filter((entry) => entry !== listener));
  }

  dispatchEvent(event) {
    if (!event || typeof event.type !== 'string') throw new Error('INVALID_EVENT');
    for (const listener of [...(this.listeners.get(event.type) || [])]) listener(event);
    return true;
  }

  listenerCount(type) {
    return (this.listeners.get(type) || []).length;
  }
}

class FakeClassList {
  constructor() {
    this.values = new Set();
  }

  add(value) { this.values.add(value); }
  remove(value) { this.values.delete(value); }
  contains(value) { return this.values.has(value); }
}

function createElement(initial = {}) {
  const attrs = new Map(Object.entries(initial.attrs || {}));
  const target = new FakeTarget();
  return Object.assign(target, {
    attrs,
    classList: new FakeClassList(),
    disabled: Boolean(initial.disabled),
    hidden: Boolean(initial.hidden),
    textContent: initial.textContent || '',
    clickCount: 0,
    getAttribute(name) {
      return attrs.has(name) ? attrs.get(name) : null;
    },
    setAttribute(name, value) {
      attrs.set(name, String(value));
    },
    removeAttribute(name) {
      attrs.delete(name);
    },
    hasAttribute(name) {
      return attrs.has(name);
    },
    click() {
      this.clickCount += 1;
      this.dispatchEvent({ type: 'click' });
    }
  });
}

function createHarness() {
  const documentRef = new FakeTarget();
  const toggle = createElement({ attrs: { 'aria-pressed': 'false' }, textContent: 'host-toggle' });
  const indicator = createElement({ hidden: true, textContent: 'host-indicator' });
  const micButton = createElement();
  const input = createElement();
  const toast = createElement({ textContent: 'host-toast' });
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

  const timers = new Map();
  let timerId = 0;
  const recognitionInstances = [];

  class FakeRecognition {
    constructor() {
      this.started = false;
      this.aborted = false;
      this.stopped = false;
      recognitionInstances.push(this);
    }

    start() {
      this.started = true;
      this.onstart?.();
    }

    abort() {
      this.aborted = true;
    }

    stop() {
      this.stopped = true;
    }
  }

  class FakeMutationObserver {
    constructor(callback) { this.callback = callback; }
    observe() {}
    disconnect() { this.disconnected = true; }
  }

  const root = {
    SpeechRecognition: FakeRecognition,
    MutationObserver: FakeMutationObserver,
    navigator: { language: 'tr-TR' },
    setTimeout(callback, delay) {
      timerId += 1;
      timers.set(timerId, { callback, delay });
      return timerId;
    },
    clearTimeout(id) {
      timers.delete(id);
    }
  };

  return {
    documentRef,
    root,
    toggle,
    indicator,
    input,
    toast,
    timers,
    recognitionInstances
  };
}

{
  const harness = createHarness();
  const controller = installHandsFree(harness.documentRef, harness.root);
  assert.ok(controller);
  assert.equal(harness.documentRef.listenerCount(HANDS_FREE_REVOKE_EVENT), 1);

  controller.enable();
  assert.equal(controller.isEnabled(), true);
  assert.equal(harness.toggle.getAttribute('aria-pressed'), 'true');
  assert.equal(harness.recognitionInstances.length, 1);
  assert.equal(harness.recognitionInstances[0].started, true);
  assert.ok(harness.timers.size >= 1, 'enabled session must own at least its session timeout');

  harness.documentRef.dispatchEvent({
    type: HANDS_FREE_REVOKE_EVENT,
    detail: { source: 'test', reason: 'background', enable: true }
  });

  assert.equal(controller.isEnabled(), false, 'revoke channel must only move toward disabled');
  assert.equal(harness.toggle.getAttribute('aria-pressed'), 'false');
  assert.equal(harness.recognitionInstances[0].aborted, true, 'active recognizer must be aborted');
  assert.equal(harness.timers.size, 0, 'revoke must clear session/restart timers');

  harness.documentRef.dispatchEvent({
    type: HANDS_FREE_REVOKE_EVENT,
    detail: { source: 'untrusted-page-script', requestedState: 'enabled' }
  });
  assert.equal(controller.isEnabled(), false, 'event payload cannot request re-enable');

  controller.destroy();
  assert.equal(harness.documentRef.listenerCount(HANDS_FREE_REVOKE_EVENT), 0);
}

{
  const harness = createHarness();
  const controller = installHandsFree(harness.documentRef, harness.root);

  harness.documentRef.dispatchEvent({ type: HANDS_FREE_REVOKE_EVENT, detail: null });
  assert.equal(controller.isEnabled(), false, 'revoke while disabled is a safe no-op');
  assert.equal(harness.recognitionInstances.length, 0);

  controller.enable();
  assert.equal(controller.isEnabled(), true);
  controller.disable();
  assert.equal(controller.isEnabled(), false);
  harness.documentRef.dispatchEvent({ type: HANDS_FREE_REVOKE_EVENT, detail: { enable: true } });
  assert.equal(controller.isEnabled(), false);

  controller.destroy();
}

{
  const harness = createHarness();
  harness.toggle.setAttribute('aria-pressed', 'host-value');
  harness.indicator.setAttribute('data-listening', 'host-listening');
  const controller = installHandsFree(harness.documentRef, harness.root);
  controller.enable();
  controller.destroy();

  assert.equal(harness.toggle.getAttribute('aria-pressed'), 'host-value', 'destroy restores host state');
  assert.equal(harness.indicator.getAttribute('data-listening'), 'host-listening');
  assert.equal(harness.documentRef.listenerCount(HANDS_FREE_REVOKE_EVENT), 0);

  harness.documentRef.dispatchEvent({ type: HANDS_FREE_REVOKE_EVENT });
  assert.equal(harness.toggle.getAttribute('aria-pressed'), 'host-value', 'destroyed runtime ignores later revoke events');
}

{
  const harness = createHarness();
  const first = installHandsFree(harness.documentRef, harness.root);
  assert.throws(
    () => installHandsFree(harness.documentRef, harness.root),
    /HANDS_FREE_ALREADY_INSTALLED/
  );
  first.destroy();
  const second = installHandsFree(harness.documentRef, harness.root);
  assert.ok(second, 'destroy releases canonical installation ownership');
  second.destroy();
}

console.log('hands-free revoke channel tests passed');