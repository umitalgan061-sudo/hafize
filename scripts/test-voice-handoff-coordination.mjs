import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const voiceInput = require('../public/voice-input.js');
const handsFree = require('../public/hands-free.js');

assert.equal(voiceInput.VOICE_INPUT_STATE_EVENT, 'hafize:voice-input-state');
assert.equal(handsFree.VOICE_INPUT_STATE_EVENT, voiceInput.VOICE_INPUT_STATE_EVENT);

class FakeClassList {
  constructor() { this.values = new Set(); }
  add(value) { this.values.add(value); }
  remove(value) { this.values.delete(value); }
  toggle(value, force) {
    if (force === true) this.values.add(value);
    else if (force === false) this.values.delete(value);
    else if (this.values.has(value)) this.values.delete(value);
    else this.values.add(value);
    return this.values.has(value);
  }
}

class FakeTarget {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }
  removeEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    this.listeners.set(type, listeners.filter((item) => item !== listener));
  }
  dispatchEvent(event) {
    event.target ??= this;
    event.currentTarget = this;
    event.preventDefault ??= () => { event.defaultPrevented = true; };
    event.stopImmediatePropagation ??= () => { event.immediateStopped = true; };
    for (const listener of [...(this.listeners.get(event.type) || [])]) {
      listener(event);
      if (event.immediateStopped) break;
    }
    return !event.defaultPrevented;
  }
}

class FakeElement extends FakeTarget {
  constructor(id = '') {
    super();
    this.id = id;
    this.attributes = new Map();
    this.classList = new FakeClassList();
    this.disabled = false;
    this.hidden = false;
    this.maxLength = 12000;
    this.textContent = '';
    this.title = '';
    this.value = '';
    this.focusCount = 0;
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  focus() { this.focusCount += 1; }
  click() { this.dispatchEvent({ type: 'click' }); }
}

class FakeDocument extends FakeTarget {
  constructor(elements) {
    super();
    this.elements = elements;
    this.hidden = false;
    this.documentElement = { lang: 'tr-TR' };
  }
  querySelector(selector) { return this.elements.get(selector) || null; }
}

class FakeCustomEvent {
  constructor(type, init = {}) {
    this.type = type;
    this.detail = init.detail;
  }
}

class FakeEvent {
  constructor(type) { this.type = type; }
}

const recognitionInstances = [];
class FakeRecognition {
  constructor() {
    this.abortCalls = 0;
    this.stopCalls = 0;
    this.started = false;
    recognitionInstances.push(this);
  }
  start() {
    this.started = true;
    this.onstart?.();
  }
  stop() {
    this.stopCalls += 1;
    this.onend?.();
  }
  abort() {
    this.abortCalls += 1;
    this.onend?.();
  }
  emitTranscript(transcript) {
    const result = [{ transcript }];
    result.isFinal = true;
    this.onresult?.({ resultIndex: 0, results: [result] });
  }
}

const timers = new Map();
let timerNo = 0;
function setTimeoutFake(callback) {
  const id = ++timerNo;
  timers.set(id, callback);
  return id;
}
function clearTimeoutFake(id) { timers.delete(id); }
function runTimers() {
  const queued = [...timers.entries()];
  timers.clear();
  for (const [, callback] of queued) callback();
}

const storage = new Map();
const localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key)
};

class FakeMutationObserver {
  constructor(callback) { this.callback = callback; }
  observe() {}
  disconnect() {}
}

const mic = new FakeElement('micBtn');
const input = new FakeElement('messageInput');
const toggle = new FakeElement('handsFreeToggle');
const indicator = new FakeElement('handsFreeIndicator');
const toast = new FakeElement('toast');
const elements = new Map([
  ['#micBtn', mic],
  ['#messageInput', input],
  ['#handsFreeToggle', toggle],
  ['#handsFreeIndicator', indicator],
  ['#toast', toast]
]);
const documentRef = new FakeDocument(elements);
const root = {
  SpeechRecognition: FakeRecognition,
  CustomEvent: FakeCustomEvent,
  Event: FakeEvent,
  MutationObserver: FakeMutationObserver,
  navigator: { language: 'tr-TR' },
  localStorage,
  setTimeout: setTimeoutFake,
  clearTimeout: clearTimeoutFake
};

const states = [];
documentRef.addEventListener(voiceInput.VOICE_INPUT_STATE_EVENT, (event) => states.push(event.detail));

const voice = voiceInput.installVoiceInput(documentRef, root);
const wake = handsFree.installHandsFree(documentRef, root);
assert.ok(voice);
assert.ok(wake);
assert.equal(voice.isListening(), false);
assert.equal(wake.isEnabled(), false);

// Manual push-to-talk must publish state and suspend the wake recognizer.
wake.enable();
assert.equal(wake.isEnabled(), true);
assert.equal(recognitionInstances.length, 1);
const wakeRecognition = recognitionInstances[0];
assert.equal(wakeRecognition.started, true);
assert.equal(wake.isListening(), true);

mic.click();
assert.equal(recognitionInstances.length, 2);
const manualVoiceRecognition = recognitionInstances[1];
assert.equal(voice.isListening(), true);
assert.equal(wake.isVoiceInputListening(), true);
assert.equal(wakeRecognition.abortCalls, 1, 'wake recognition must abort while push-to-talk owns the microphone');
assert.deepEqual(states.at(-1), { listening: true, source: 'voice-input' });
assert.equal(indicator.textContent, '○ Sesli giriş etkin');

manualVoiceRecognition.emitTranscript('bugün plan yapalım');
assert.equal(input.value, 'bugün plan yapalım');
manualVoiceRecognition.onend?.();
assert.equal(voice.isListening(), false);
assert.equal(wake.isVoiceInputListening(), false);
assert.deepEqual(states.at(-1), { listening: false, source: 'voice-input' });
assert.equal(timers.size, 1, 'wake recognition should be scheduled after voice input ends');
runTimers();
assert.equal(recognitionInstances.length, 3);
assert.equal(wake.isListening(), true);

// Wake phrase handoff should start push-to-talk, then return to wake listening.
const resumedWakeRecognition = recognitionInstances[2];
resumedWakeRecognition.emitTranscript('hey hafize');
assert.equal(recognitionInstances.length, 4, 'wake phrase should hand off to voice input');
const wakeTriggeredVoiceRecognition = recognitionInstances[3];
assert.equal(voice.isListening(), true);
assert.equal(wake.isVoiceInputListening(), true);
assert.equal(timers.size, 0, 'wake listener must not restart over active voice input');

wakeTriggeredVoiceRecognition.emitTranscript('yarın için görev ekle');
assert.equal(input.value, 'bugün plan yapalım yarın için görev ekle');
wakeTriggeredVoiceRecognition.onend?.();
assert.equal(timers.size, 1);
runTimers();
assert.equal(recognitionInstances.length, 5);
assert.equal(wake.isListening(), true);

// Malformed/unrelated lifecycle events must not change microphone ownership.
const currentWakeRecognition = recognitionInstances[4];
documentRef.dispatchEvent(new FakeCustomEvent(voiceInput.VOICE_INPUT_STATE_EVENT, {
  detail: { listening: true, source: 'untrusted-component' }
}));
assert.equal(currentWakeRecognition.abortCalls, 0);
assert.equal(wake.isVoiceInputListening(), false);

documentRef.hidden = true;
documentRef.dispatchEvent({ type: 'visibilitychange' });
assert.equal(currentWakeRecognition.abortCalls, 1);
assert.equal(wake.isListening(), false);
assert.equal(timers.size, 0, 'hidden document must not restart microphone listening');

voice.destroy();
wake.destroy();
assert.equal(voice.isListening(), false);
assert.equal(wake.isListening(), false);

console.log('voice handoff coordination tests passed');
