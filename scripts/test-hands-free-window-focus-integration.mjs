import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const handsFree = require('../public/hands-free.js');
const guardApi = require('../public/hands-free-background-guard.js');

class Target {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, fn, capture = false) {
    const list = this.listeners.get(type) || [];
    list.push({ fn, capture: Boolean(capture) });
    this.listeners.set(type, list);
  }
  removeEventListener(type, fn, capture = false) {
    const list = this.listeners.get(type) || [];
    this.listeners.set(type, list.filter((item) => item.fn !== fn || item.capture !== Boolean(capture)));
  }
  fire(type, event = {}) {
    const list = [...(this.listeners.get(type) || [])];
    for (const item of list.filter((entry) => entry.capture)) item.fn({ type, ...event });
    for (const item of list.filter((entry) => !entry.capture)) item.fn({ type, ...event });
  }
}

function element() {
  const target = new Target();
  const attrs = new Map();
  target.hidden = false;
  target.disabled = false;
  target.textContent = '';
  target.value = '';
  target.classList = {
    values: new Set(),
    add(value) { this.values.add(value); },
    remove(value) { this.values.delete(value); },
    contains(value) { return this.values.has(value); }
  };
  target.getAttribute = (name) => attrs.get(name) ?? null;
  target.setAttribute = (name, value) => attrs.set(name, String(value));
  target.removeAttribute = (name) => attrs.delete(name);
  target.hasAttribute = (name) => attrs.has(name);
  target.click = () => target.fire('click', { preventDefault() {} });
  return target;
}

function createHarness() {
  const toggle = element();
  toggle.setAttribute('aria-pressed', 'false');
  const indicator = element();
  indicator.hidden = true;
  const mic = element();
  const input = element();
  const toast = element();
  toast.classList.add('hidden');

  const documentRef = new Target();
  documentRef.hidden = false;
  documentRef.documentElement = { lang: 'tr' };
  documentRef.querySelector = (selector) => ({
    '#handsFreeToggle': toggle,
    '#handsFreeIndicator': indicator,
    '#micBtn': mic,
    '#messageInput': input,
    '#toast': toast
  })[selector] || null;

  const root = new Target();
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
  root.MutationObserver = class { observe() {} disconnect() {} };

  return {
    toggle,
    indicator,
    toast,
    documentRef,
    root,
    recognitions,
    pendingTimers(ms) {
      return timers.filter((timer) => !timer.cleared && (ms === undefined || timer.ms === ms));
    }
  };
}

const h = createHarness();
const runtime = handsFree.installHandsFree(h.documentRef, h.root);
const guard = guardApi.installHandsFreeBackgroundGuard(h.documentRef, h.root);

h.toggle.click();
assert.equal(runtime.isEnabled(), true);
assert.equal(runtime.isListening(), true);
assert.equal(h.recognitions.length, 1);

h.root.fire('blur');
assert.equal(guard.getLastReason(), 'window-blur');
assert.equal(runtime.isEnabled(), false, 'window focus loss must disable the canonical hands-free runtime');
assert.equal(runtime.isListening(), false);
assert.equal(h.recognitions[0].aborted, true);
assert.equal(h.pendingTimers(handsFree.RESTART_DELAY_MS).length, 0);

h.root.fire('focus');
assert.equal(runtime.isEnabled(), false, 'window focus return must not silently re-enable listening');
assert.equal(h.pendingTimers(handsFree.RESTART_DELAY_MS).length, 0);
assert.equal(h.recognitions.length, 1);
assert.equal(h.toast.textContent, guardApi.REVOCATION_NOTICE);
assert.equal(h.toast.classList.contains('hidden'), false);

h.toggle.click();
assert.equal(runtime.isEnabled(), true, 'fresh explicit toggle path remains available after revocation');
assert.equal(h.recognitions.length, 2);

guard.destroy();
runtime.destroy();
console.log('hands-free window focus integration tests passed');