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
const timers = [];
const root = {
  SpeechRecognition: Recognition,
  navigator: { language: 'tr-TR' },
  localStorage: {
    setItem(key, value) { storage.set(key, value); },
    removeItem(key) { storage.delete(key); }
  },
  setTimeout(fn, delay) { timers.push({ fn, delay, id: timers.length + 1 }); return timers.length; },
  clearTimeout(id) {
    const index = timers.findIndex((timer) => timer.id === id);
    if (index >= 0) timers.splice(index, 1);
  },
  MutationObserver: class { constructor(fn) { this.fn = fn; } observe() {} disconnect() {} }
};

function pendingDelays() {
  return timers.map((timer) => timer.delay).sort((a, b) => a - b);
}

function fireTimer(delay) {
  const index = timers.findIndex((timer) => timer.delay === delay);
  assert.ok(index >= 0, `no pending timer scheduled at ${delay}ms`);
  const [timer] = timers.splice(index, 1);
  timer.fn();
}

const controller = api.installHandsFree(documentRef, root);
assert.equal(controller.isSupported, true);
assert.equal(controller.isEnabled(), false);
assert.equal(indicator.hidden, true);

toggle.fire('click');
assert.equal(controller.isEnabled(), true);
// Hands-free is a per-session opt-in: enabling it never writes a persisted flag that
// could resume microphone listening on the next load without a fresh user gesture.
assert.equal(storage.size, 0);
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
// Enabling arms the session expiry; the wake phrase adds the voice-input handoff fallback.
assert.deepEqual(pendingDelays(), [api.HANDOFF_TIMEOUT_MS, api.SESSION_LIMIT_MS]);

// When voice input never takes over, the fallback returns to wake-phrase listening.
fireTimer(api.HANDOFF_TIMEOUT_MS);
fireTimer(api.RESTART_DELAY_MS);
assert.equal(recognitions.length, 2);
assert.equal(controller.isListening(), true);
assert.deepEqual(pendingDelays(), [api.SESSION_LIMIT_MS]);

documentRef.hidden = true;
docListeners.get('visibilitychange')?.();
assert.equal(recognitions[1].aborted, true);
assert.equal(controller.isListening(), false);

documentRef.hidden = false;
toggle.fire('click');
assert.equal(controller.isEnabled(), false);
assert.equal(storage.size, 0);
// Disabling clears the session expiry so a stale timer cannot fire on a closed session.
assert.deepEqual(pendingDelays(), []);

// The 30-minute session limit stops listening on its own, without a user gesture.
toggle.fire('click');
assert.equal(controller.isEnabled(), true);
const sessionRecognition = recognitions.at(-1);
assert.equal(controller.isListening(), true);
fireTimer(api.SESSION_LIMIT_MS);
assert.equal(controller.isEnabled(), false);
assert.equal(controller.isListening(), false);
assert.equal(sessionRecognition.aborted, true);
assert.deepEqual(pendingDelays(), []);

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
