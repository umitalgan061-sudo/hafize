import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const voiceInput = require('../public/voice-input.js');
const voiceOutput = require('../public/voice-output.js');

assert.equal(voiceInput.VOICE_INPUT_STATE_EVENT, voiceOutput.VOICE_INPUT_STATE_EVENT);

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
    event.preventDefault ??= () => {};
    event.stopImmediatePropagation ??= () => { event.stopped = true; };
    for (const listener of [...(this.listeners.get(event.type) || [])]) {
      listener(event);
      if (event.stopped) break;
    }
  }
}

class FakeClassList {
  constructor() { this.values = new Set(); }
  add(value) { this.values.add(value); }
  remove(value) { this.values.delete(value); }
  toggle(value, force) {
    if (force) this.values.add(value);
    else this.values.delete(value);
  }
}

class FakeElement extends FakeTarget {
  constructor() {
    super();
    this.attributes = new Map();
    this.classList = new FakeClassList();
    this.disabled = false;
    this.maxLength = 12000;
    this.textContent = '';
    this.title = '';
    this.value = '';
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  focus() {}
  click() { this.dispatchEvent({ type: 'click' }); }
}

class FakeDocument extends FakeTarget {
  constructor(elements) {
    super();
    this.elements = elements;
    this.documentElement = { lang: 'tr-TR' };
    this.hidden = false;
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

class FakeMutationObserver {
  constructor(callback) { this.callback = callback; }
  observe() {}
  disconnect() {}
}

let beforeRecognitionStart = null;
class FakeRecognition {
  start() {
    beforeRecognitionStart?.();
    beforeRecognitionStart = null;
    this.onstart?.();
  }
  stop() { this.onend?.(); }
  abort() { this.onend?.(); }
}

class FakeUtterance {
  constructor(text) { this.text = text; }
}

const synth = {
  cancelCalls: 0,
  spoken: [],
  getVoices: () => [{ lang: 'tr-TR' }],
  speak(utterance) { this.spoken.push(utterance); },
  cancel() { this.cancelCalls += 1; }
};

const storage = new Map();
const localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value))
};

const mic = new FakeElement();
const input = new FakeElement();
const toast = new FakeElement();
const voiceToggle = new FakeElement();
const voiceCard = new FakeElement();
const composer = new FakeElement();
const messages = new FakeElement();
messages.querySelectorAll = () => [];

const documentRef = new FakeDocument(new Map([
  ['#micBtn', mic],
  ['#messageInput', input],
  ['#toast', toast],
  ['#voiceOutputToggle', voiceToggle],
  ['.voice-card', voiceCard],
  ['#composer', composer],
  ['#messages', messages]
]));

const root = {
  SpeechRecognition: FakeRecognition,
  SpeechSynthesisUtterance: FakeUtterance,
  speechSynthesis: synth,
  MutationObserver: FakeMutationObserver,
  CustomEvent: FakeCustomEvent,
  Event: FakeEvent,
  localStorage,
  navigator: { language: 'tr-TR' },
  setTimeout: () => 1,
  clearTimeout: () => {}
};

const inputApi = voiceInput.installVoiceInput(documentRef, root);
const outputApi = voiceOutput.installVoiceOutput(documentRef, root);
assert.ok(inputApi);
assert.ok(outputApi);

outputApi.setEnabled(true);
assert.equal(outputApi.speak('Hafize cevap veriyor.'), true);
assert.equal(outputApi.isSpeaking(), true);
assert.equal(synth.spoken.length, 1);
assert.equal(synth.cancelCalls, 1);

beforeRecognitionStart = () => {
  assert.equal(inputApi.isListening(), true, 'voice input must own the microphone before browser start');
  assert.equal(outputApi.isSpeaking(), false, 'voice claim must synchronously cancel TTS before browser start');
  assert.equal(synth.cancelCalls, 2, 'barge-in must cancel synthesis exactly once before recognition starts');
};

mic.click();
assert.equal(beforeRecognitionStart, null, 'push-to-talk must reach browser recognition start');
assert.equal(inputApi.isListening(), true);
assert.equal(outputApi.isSpeaking(), false);
assert.equal(synth.cancelCalls, 2);

inputApi.stop();
assert.equal(inputApi.isListening(), false);

inputApi.destroy();
outputApi.destroy();
assert.equal(synth.cancelCalls, 3);

console.log('voice input/output integration tests passed');