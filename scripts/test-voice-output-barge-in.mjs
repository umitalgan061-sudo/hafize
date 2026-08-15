import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const voiceOutput = require('../public/voice-output.js');

assert.equal(voiceOutput.VOICE_INPUT_STATE_EVENT, 'hafize:voice-input-state');

class FakeTarget {
  constructor() {
    this.listeners = new Map();
  }

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
    for (const listener of [...(this.listeners.get(event.type) || [])]) listener(event);
  }
}

class FakeClassList {
  constructor() {
    this.values = new Set();
  }

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
    this.textContent = '';
    this.title = '';
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }
}

class FakeDocument extends FakeTarget {
  constructor(elements) {
    super();
    this.elements = elements;
    this.hidden = false;
  }

  querySelector(selector) {
    return this.elements.get(selector) || null;
  }
}

class FakeMutationObserver {
  constructor(callback) {
    this.callback = callback;
    this.disconnected = false;
  }

  observe() {}

  disconnect() {
    this.disconnected = true;
  }
}

class FakeUtterance {
  constructor(text) {
    this.text = text;
    this.lang = '';
    this.rate = 1;
    this.pitch = 1;
    this.voice = null;
    this.onend = null;
    this.onerror = null;
  }
}

const synth = {
  cancelCalls: 0,
  spoken: [],
  getVoices() {
    return [{ lang: 'tr-TR', name: 'Fake Turkish Voice' }];
  },
  speak(utterance) {
    this.spoken.push(utterance);
  },
  cancel() {
    this.cancelCalls += 1;
  }
};

const storage = new Map();
const localStorage = {
  getItem(key) {
    return storage.get(key) ?? null;
  },
  setItem(key, value) {
    storage.set(key, String(value));
  }
};

const toggle = new FakeElement();
const card = new FakeElement();
const mic = new FakeElement();
const input = new FakeElement();
const composer = new FakeElement();
const messages = new FakeElement();
messages.querySelectorAll = () => [];

const documentRef = new FakeDocument(new Map([
  ['#voiceOutputToggle', toggle],
  ['.voice-card', card],
  ['#micBtn', mic],
  ['#messageInput', input],
  ['#composer', composer],
  ['#messages', messages]
]));

const root = {
  speechSynthesis: synth,
  SpeechSynthesisUtterance: FakeUtterance,
  MutationObserver: FakeMutationObserver,
  localStorage
};

const api = voiceOutput.installVoiceOutput(documentRef, root);
assert.ok(api);
assert.equal(api.isSupported, true);
assert.equal(api.isEnabled(), false);

api.setEnabled(true);
assert.equal(api.isEnabled(), true);
assert.equal(api.speak('Hafize konuşuyor.'), true);
assert.equal(api.isSpeaking(), true);
assert.equal(synth.spoken.length, 1);
assert.equal(synth.cancelCalls, 1, 'starting a fresh response clears any stale speech first');

// Untrusted and inactive lifecycle states must not trigger barge-in.
documentRef.dispatchEvent({
  type: voiceOutput.VOICE_INPUT_STATE_EVENT,
  detail: { listening: true, source: 'other-component' }
});
assert.equal(synth.cancelCalls, 1);
assert.equal(api.isSpeaking(), true);

documentRef.dispatchEvent({
  type: voiceOutput.VOICE_INPUT_STATE_EVENT,
  detail: { listening: false, source: 'voice-input' }
});
assert.equal(synth.cancelCalls, 1);
assert.equal(api.isSpeaking(), true);

// The trusted microphone claim must cancel TTS synchronously, without waiting for MutationObserver.
documentRef.dispatchEvent({
  type: voiceOutput.VOICE_INPUT_STATE_EVENT,
  detail: { listening: true, source: 'voice-input' }
});
assert.equal(synth.cancelCalls, 2);
assert.equal(api.isSpeaking(), false);
assert.equal(card.classList.values.has('speaking'), false);

api.destroy();
assert.equal(synth.cancelCalls, 3, 'destroy performs one final cancellation');

documentRef.dispatchEvent({
  type: voiceOutput.VOICE_INPUT_STATE_EVENT,
  detail: { listening: true, source: 'voice-input' }
});
assert.equal(synth.cancelCalls, 3, 'destroy must remove the voice lifecycle listener');

console.log('voice output synchronous barge-in tests passed');