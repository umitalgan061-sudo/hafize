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
    getItem(key) { return storage.has(key) ? storage.get(key) : null; },
    removeItem(key) { storage.delete(key); }
  },
  setTimeout(fn) { timers.push(fn); return timers.length; },
  clearTimeout() {},
  MutationObserver: class { constructor(fn) { this.fn = fn; } observe() {} disconnect() {} }
};

const controller = api.installHandsFree(documentRef, root);
assert.equal(controller.isSupported, true);
assert.equal(controller.isEnabled(), false);
assert.equal(indicator.hidden, true);

toggle.fire('click');
assert.equal(controller.isEnabled(), true);
// Continuous listening is never persisted: after a reload the user has to
// re-enable it from the visible control (docs/HANDS_FREE_MICROPHONE_DEVICE_CONTRACT.md).
assert.equal(storage.size, 0, 'hands-free state must not be written to storage');
assert.equal(api.STORAGE_KEY, undefined, 'hands-free must not expose a persistence key');
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
// The wake phrase hands off to voice input; wake-word listening is paused
// while the handoff fallback is armed.
assert.equal(controller.isHandoffWaiting(), true);

// Voice input never starts, so the fallback returns to wake-word listening
// instead of leaving the session stuck.
timers.pop()();
assert.equal(controller.isHandoffWaiting(), false);
assert.equal(controller.isEnabled(), true);
timers.pop()();
assert.equal(recognitions.length, 2);
assert.equal(controller.isListening(), true);

documentRef.hidden = true;
docListeners.get('visibilitychange')?.();
assert.equal(recognitions[1].aborted, true);
assert.equal(controller.isListening(), false);

documentRef.hidden = false;
toggle.fire('click');
assert.equal(controller.isEnabled(), false);
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
