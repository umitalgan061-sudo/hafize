import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const handsFree = require('../public/hands-free.js');
const backgroundGuard = require('../public/hands-free-background-guard.js');

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

  dispatch(type, event = {}) {
    return this.dispatchEvent({ type, ...event });
  }

  dispatchEvent(event) {
    const entries = [...(this.listeners.get(event?.type) || [])];
    for (const entry of entries.filter((item) => item.capture)) entry.listener(event);
    for (const entry of entries.filter((item) => !item.capture)) entry.listener(event);
    return true;
  }
}

function createElement() {
  const target = new FakeTarget();
  const attrs = new Map();
  return Object.assign(target, {
    hidden: false,
    disabled: false,
    textContent: '',
    value: '',
    classList: {
      values: new Set(),
      add(value) { this.values.add(value); },
      remove(value) { this.values.delete(value); },
      contains(value) { return this.values.has(value); }
    },
    getAttribute(name) { return attrs.has(name) ? attrs.get(name) : null; },
    setAttribute(name, value) { attrs.set(name, String(value)); },
    removeAttribute(name) { attrs.delete(name); },
    hasAttribute(name) { return attrs.has(name); },
    click() { target.dispatch('click', { preventDefault() {} }); }
  });
}

function createHarness() {
  const toggle = createElement();
  toggle.setAttribute('aria-pressed', 'false');
  const indicator = createElement();
  indicator.hidden = true;
  const mic = createElement();
  const input = createElement();
  const toast = createElement();
  const documentRef = new FakeTarget();
  documentRef.hidden = false;
  documentRef.documentElement = { lang: 'tr' };
  documentRef.querySelector = (selector) => ({
    '#handsFreeToggle': toggle,
    '#handsFreeIndicator': indicator,
    '#micBtn': mic,
    '#messageInput': input,
    '#toast': toast
  })[selector] || null;

  const root = new FakeTarget();
  root.navigator = { language: 'tr-TR' };
  const recognitions = [];
  class Recognition {
    constructor() { recognitions.push(this); }
    start() { this.started = true; this.onstart?.(); }
    stop() { this.stopped = true; this.onend?.(); }
    abort() { this.aborted = true; this.onend?.(); }
  }
  root.SpeechRecognition = Recognition;

  const timers = [];
  let nextTimerId = 1;
  root.setTimeout = (fn, ms) => {
    const timer = { id: nextTimerId++, fn, ms, cleared: false };
    timers.push(timer);
    return timer.id;
  };
  root.clearTimeout = (id) => {
    const timer = timers.find((item) => item.id === id);
    if (timer) timer.cleared = true;
  };
  root.MutationObserver = class {
    observe() {}
    disconnect() {}
  };

  return {
    toggle,
    indicator,
    input,
    toast,
    documentRef,
    root,
    recognitions,
    timers,
    pendingTimers(ms) {
      return timers.filter((timer) => !timer.cleared && (ms === undefined || timer.ms === ms));
    }
  };
}

{
  const harness = createHarness();
  const runtime = handsFree.installHandsFree(harness.documentRef, harness.root);
  const guard = backgroundGuard.installHandsFreeBackgroundGuard(harness.documentRef, harness.root);

  harness.toggle.click();
  assert.equal(runtime.isEnabled(), true);
  assert.equal(runtime.isListening(), true);
  assert.equal(harness.recognitions.length, 1);
  assert.equal(harness.indicator.hidden, false);

  harness.documentRef.hidden = true;
  harness.documentRef.dispatch('visibilitychange');
  assert.equal(guard.getLastReason(), 'hidden');
  assert.equal(runtime.isEnabled(), false, 'capture guard must disable before runtime visibility handler can preserve the session');
  assert.equal(runtime.isListening(), false);
  assert.equal(harness.recognitions[0].aborted, true);
  assert.equal(harness.pendingTimers(handsFree.RESTART_DELAY_MS).length, 0);

  harness.documentRef.hidden = false;
  harness.documentRef.dispatch('visibilitychange');
  assert.equal(runtime.isEnabled(), false);
  assert.equal(harness.pendingTimers(handsFree.RESTART_DELAY_MS).length, 0, 'visible return must not silently restart wake listening');
  assert.equal(harness.recognitions.length, 1);

  guard.destroy();
  runtime.destroy();
}

{
  const harness = createHarness();
  const runtime = handsFree.installHandsFree(harness.documentRef, harness.root);
  const guard = backgroundGuard.installHandsFreeBackgroundGuard(harness.documentRef, harness.root);
  harness.toggle.click();
  assert.equal(runtime.isEnabled(), true);

  harness.root.dispatch('pagehide');
  assert.equal(guard.getLastReason(), 'pagehide');
  assert.equal(runtime.isEnabled(), false);
  assert.equal(runtime.isListening(), false);
  assert.equal(harness.pendingTimers(handsFree.RESTART_DELAY_MS).length, 0);

  guard.destroy();
  runtime.destroy();
}

{
  const harness = createHarness();
  const runtime = handsFree.installHandsFree(harness.documentRef, harness.root);
  const guard = backgroundGuard.installHandsFreeBackgroundGuard(harness.documentRef, harness.root);
  harness.toggle.click();
  assert.equal(runtime.isEnabled(), true);

  harness.documentRef.dispatch('freeze');
  assert.equal(guard.getLastReason(), 'freeze');
  assert.equal(runtime.isEnabled(), false);
  assert.equal(runtime.isListening(), false);
  assert.equal(harness.pendingTimers(handsFree.RESTART_DELAY_MS).length, 0);

  guard.destroy();
  runtime.destroy();
}

console.log('hands-free background integration tests passed');
