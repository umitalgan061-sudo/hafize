import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const api = require('../public/hands-free.js');

assert.equal(api.normalizeSpeech(' HAFİZE!!! '), 'hafize');
assert.equal(api.containsWakePhrase('Merhaba Hafize nasılsın'), true);
assert.equal(api.containsWakePhrase('hafızaya kaydet'), false);

function element() {
  const listeners = new Map();
  return {
    hidden: false, disabled: false, textContent: '', value: '', attrs: {}, classList: { remove() {} },
    setAttribute(name, value) { this.attrs[name] = value; },
    addEventListener(type, fn) { listeners.set(type, fn); },
    removeEventListener(type) { listeners.delete(type); },
    click() { this.clicked = (this.clicked || 0) + 1; },
    fire(type) { listeners.get(type)?.({ preventDefault() {} }); }
  };
}

const toggle = element();
const indicator = element();
const mic = element();
const input = element();
const toast = element();
const docListeners = new Map();
const documentRef = {
  hidden: false,
  documentElement: { lang: 'tr' },
  querySelector(selector) {
    return ({ '#handsFreeToggle': toggle, '#handsFreeIndicator': indicator, '#micBtn': mic, '#messageInput': input, '#toast': toast })[selector] || null;
  },
  addEventListener(type, fn) { docListeners.set(type, fn); },
  removeEventListener(type) { docListeners.delete(type); }
};

const recognitions = [];
class Recognition {
  constructor() { recognitions.push(this); }
  start() { this.started = true; this.onstart?.(); }
  stop() { this.stopped = true; this.onend?.(); }
  abort() { this.aborted = true; this.onend?.(); }
}

const storage = new Map();
// Live timer table: a cleared timer disappears, so assertions can talk about
// what is still pending instead of how many were ever scheduled.
const timers = new Map();
let timerSequence = 0;
const pendingDelays = () => [...timers.values()].map((timer) => timer.delayMs);
function fireTimer(delayMs) {
  const entry = [...timers.entries()].find(([, timer]) => timer.delayMs === delayMs);
  assert.ok(entry, `no pending timer scheduled for ${delayMs} ms`);
  timers.delete(entry[0]);
  entry[1].run();
}
const root = {
  SpeechRecognition: Recognition,
  navigator: { language: 'tr-TR' },
  localStorage: {
    setItem(key, value) { storage.set(key, value); },
    removeItem(key) { storage.delete(key); }
  },
  setTimeout(fn, delayMs) { timers.set(++timerSequence, { run: fn, delayMs }); return timerSequence; },
  clearTimeout(id) { timers.delete(id); },
  MutationObserver: class { constructor(fn) { this.fn = fn; } observe() {} disconnect() {} }
};

const controller = api.installHandsFree(documentRef, root);
assert.equal(controller.isSupported, true);
assert.equal(controller.isEnabled(), false);
assert.equal(indicator.hidden, true);

toggle.fire('click');
assert.equal(controller.isEnabled(), true);
// Always-on listening is never remembered across loads: enabling it requires an
// explicit gesture in every session, so nothing is written to local storage.
assert.deepEqual([...storage.keys()], []);
assert.equal(recognitions.length, 1);
assert.equal(recognitions[0].continuous, true);
assert.equal(controller.isListening(), true);
assert.equal(indicator.hidden, false);
assert.match(indicator.textContent, /Hafize/);

recognitions[0].onresult?.({ resultIndex: 0, results: [[{ transcript: 'merhaba dünya' }]] });
assert.equal(mic.clicked || 0, 0);
recognitions[0].onresult?.({ resultIndex: 0, results: [[{ transcript: 'Hafize' }]] });
assert.equal(recognitions[0].stopped, true);
assert.equal(mic.clicked, 1);
assert.equal(controller.isListening(), false);
// Enabling arms the session limit; the wake-phrase handoff adds its own fallback
// until voice input actually takes over.
assert.deepEqual(pendingDelays(), [api.SESSION_LIMIT_MS, api.HANDOFF_TIMEOUT_MS]);

// A visibility event must not restart wake listening while the handoff is pending.
docListeners.get('visibilitychange')?.();
assert.deepEqual(pendingDelays(), [api.SESSION_LIMIT_MS, api.HANDOFF_TIMEOUT_MS]);

fireTimer(api.HANDOFF_TIMEOUT_MS);
assert.equal(controller.isListening(), false);
assert.deepEqual(pendingDelays(), [api.SESSION_LIMIT_MS, api.RESTART_DELAY_MS]);
fireTimer(api.RESTART_DELAY_MS);
assert.equal(recognitions.length, 2);
assert.equal(controller.isListening(), true);

documentRef.hidden = true;
docListeners.get('visibilitychange')?.();
assert.equal(recognitions[1].aborted, true);
assert.equal(controller.isListening(), false);

documentRef.hidden = false;
toggle.fire('click');
assert.equal(controller.isEnabled(), false);
// Disabling releases every pending timer and leaves nothing persisted.
assert.deepEqual(pendingDelays(), []);
assert.equal(storage.size, 0);

const unsupportedToggle = element();
const unsupportedDoc = {
  hidden: false,
  documentElement: { lang: 'tr' },
  querySelector(selector) {
    return ({ '#handsFreeToggle': unsupportedToggle, '#handsFreeIndicator': element(), '#micBtn': element(), '#messageInput': element(), '#toast': element() })[selector] || null;
  },
  addEventListener() {}, removeEventListener() {}
};
const unsupported = api.installHandsFree(unsupportedDoc, {});
assert.equal(unsupported.isSupported, false);
assert.equal(unsupportedToggle.disabled, true);

console.log('hands-free tests passed');
