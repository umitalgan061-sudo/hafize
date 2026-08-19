import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const api = require('../public/hands-free.js');

function createElement({ hidden = false, disabled = false, textContent = '', attrs = {} } = {}) {
  const listeners = new Map();
  return {
    hidden,
    disabled,
    textContent,
    attrs: { ...attrs },
    classList: { remove() {} },
    getAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attrs, name) ? this.attrs[name] : null; },
    setAttribute(name, value) { this.attrs[name] = String(value); },
    removeAttribute(name) { delete this.attrs[name]; },
    addEventListener(type, handler) {
      if (listeners.has(type)) throw new Error(`duplicate-listener:${type}`);
      listeners.set(type, handler);
    },
    removeEventListener(type, handler) {
      if (listeners.get(type) === handler) listeners.delete(type);
    },
    fire(type, event = {}) { listeners.get(type)?.(event); },
    listenerCount() { return listeners.size; }
  };
}

function createHarness({ observerThrows = false } = {}) {
  const toggle = createElement({
    disabled: true,
    textContent: 'Host hands-free',
    attrs: { 'aria-pressed': 'mixed' }
  });
  const indicator = createElement({
    hidden: false,
    textContent: 'Host indicator',
    attrs: {
      'data-listening': 'host-listening',
      'data-network-retry': 'host-retry'
    }
  });
  const mic = createElement();
  const input = createElement();
  const toast = createElement({ hidden: true });
  const documentListeners = new Map();
  const observers = [];
  const recognitions = [];

  const documentRef = {
    hidden: false,
    documentElement: { lang: 'tr' },
    querySelector(selector) {
      return ({
        '#handsFreeToggle': toggle,
        '#handsFreeIndicator': indicator,
        '#micBtn': mic,
        '#messageInput': input,
        '#toast': toast
      })[selector] || null;
    },
    addEventListener(type, handler) {
      if (documentListeners.has(type)) throw new Error(`duplicate-document-listener:${type}`);
      documentListeners.set(type, handler);
    },
    removeEventListener(type, handler) {
      if (documentListeners.get(type) === handler) documentListeners.delete(type);
    }
  };

  class Recognition {
    constructor() { recognitions.push(this); }
    start() { this.started = true; this.onstart?.(); }
    stop() { this.stopped = true; this.onend?.(); }
    abort() { this.aborted = true; this.onend?.(); }
  }

  class MutationObserver {
    constructor(handler) {
      this.handler = handler;
      this.disconnected = false;
      observers.push(this);
    }
    observe() {
      if (observerThrows) throw new Error('observer-install-failed');
      this.observing = true;
    }
    disconnect() { this.disconnected = true; }
  }

  const timers = new Map();
  let timerId = 0;
  const root = {
    SpeechRecognition: Recognition,
    MutationObserver,
    navigator: { language: 'tr-TR' },
    setTimeout(handler, ms) {
      const id = ++timerId;
      timers.set(id, { handler, ms });
      return id;
    },
    clearTimeout(id) { timers.delete(id); }
  };

  return {
    toggle,
    indicator,
    input,
    documentRef,
    documentListeners,
    observers,
    recognitions,
    root
  };
}

{
  const harness = createHarness();
  const controller = api.installHandsFree(harness.documentRef, harness.root);

  assert.equal(harness.toggle.disabled, false, 'controller may render its supported state while mounted');
  assert.equal(harness.toggle.textContent, 'Eller serbest kapalı');
  assert.equal(harness.indicator.hidden, true);
  assert.throws(
    () => api.installHandsFree(harness.documentRef, harness.root),
    /HANDS_FREE_ALREADY_INSTALLED/,
    'same toggle must have one active owner'
  );

  controller.enable();
  assert.equal(controller.isEnabled(), true);
  assert.equal(harness.recognitions.length, 1);
  const staleRecognition = harness.recognitions[0];

  controller.destroy();
  assert.equal(harness.toggle.disabled, true);
  assert.equal(harness.toggle.textContent, 'Host hands-free');
  assert.equal(harness.toggle.getAttribute('aria-pressed'), 'mixed');
  assert.equal(harness.indicator.hidden, false);
  assert.equal(harness.indicator.textContent, 'Host indicator');
  assert.equal(harness.indicator.getAttribute('data-listening'), 'host-listening');
  assert.equal(harness.indicator.getAttribute('data-network-retry'), 'host-retry');
  assert.equal(harness.indicator.getAttribute('data-handoff-waiting'), null);
  assert.equal(harness.documentListeners.size, 0);
  assert.equal(harness.observers[0].disconnected, true);

  staleRecognition.onstart?.();
  staleRecognition.onresult?.({ resultIndex: 0, results: [[{ transcript: 'Hafize' }]] });
  staleRecognition.onend?.();
  assert.equal(controller.isListening(), false, 'stale callbacks after destroy must be inert');

  const remounted = api.installHandsFree(harness.documentRef, harness.root);
  assert.ok(remounted, 'destroy must release ownership for a clean remount');
  remounted.destroy();
}

{
  const harness = createHarness({ observerThrows: true });
  assert.throws(
    () => api.installHandsFree(harness.documentRef, harness.root),
    /observer-install-failed/,
    'partial install failure must surface the original setup error'
  );
  assert.equal(harness.toggle.disabled, true);
  assert.equal(harness.toggle.textContent, 'Host hands-free');
  assert.equal(harness.toggle.getAttribute('aria-pressed'), 'mixed');
  assert.equal(harness.indicator.hidden, false);
  assert.equal(harness.indicator.textContent, 'Host indicator');
  assert.equal(harness.documentListeners.size, 0, 'partial install must remove document listeners');
  assert.equal(harness.toggle.listenerCount(), 0, 'partial install must remove toggle listener');
  assert.equal(harness.observers[0].disconnected, true);

  harness.root.MutationObserver = class {
    constructor() {}
    observe() {}
    disconnect() {}
  };
  const retry = api.installHandsFree(harness.documentRef, harness.root);
  assert.ok(retry, 'failed installation must not retain ownership');
  retry.destroy();
}

console.log('hands-free installation ownership tests passed');
