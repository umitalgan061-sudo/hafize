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
  // Delays are recorded so the assertions can name which timer they fire: the session
  // limit, the voice handoff fallback and the recognition restart all coexist.
  setTimeout(fn, delay) { timers.push({ fn, delay }); return timers.length; },
  clearTimeout(handle) { if (Number.isInteger(handle) && timers[handle - 1]) timers[handle - 1].cleared = true; },
  MutationObserver: class { constructor(fn) { this.fn = fn; } observe() {} disconnect() {} }
};

function pendingTimers(delay) {
  return timers.filter((timer) => !timer.cleared && (delay === undefined || timer.delay === delay));
}

function fireTimer(delay) {
  const timer = pendingTimers(delay)[0];
  assert.ok(timer, `expected a pending timer with delay ${delay}`);
  timer.cleared = true;
  timer.fn();
}

const controller = api.installHandsFree(documentRef, root);
assert.equal(controller.isSupported, true);
assert.equal(controller.isEnabled(), false);
assert.equal(indicator.hidden, true);

toggle.fire('click');
assert.equal(controller.isEnabled(), true);
// Hands-free controller state must never reach the storage surface
// (docs/HANDS_FREE_MICROPHONE_DEVICE_CONTRACT.md), so enabling persists nothing.
assert.equal(storage.size, 0, 'hands-free state must not be persisted client-side');
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
// Enabling arms the 30 minute session limit; the wake phrase adds the handoff fallback.
assert.equal(pendingTimers(api.SESSION_LIMIT_MS).length, 1);
assert.equal(pendingTimers(api.HANDOFF_TIMEOUT_MS).length, 1);

// While the handoff to voice input is pending, nothing may restart wake-word listening.
docListeners.get('visibilitychange')?.();
assert.equal(pendingTimers(api.RESTART_DELAY_MS).length, 0, 'restart must wait for the handoff to settle');

// The handoff fallback releases the wait and schedules the restart instead.
fireTimer(api.HANDOFF_TIMEOUT_MS);
assert.equal(pendingTimers(api.RESTART_DELAY_MS).length, 1);
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
assert.equal(storage.size, 0, 'disabling must not leave any persisted trace either');

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
