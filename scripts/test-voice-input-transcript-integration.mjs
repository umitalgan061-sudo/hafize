import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const voice = require('../public/voice-input.js');

class FakeElement {
  constructor(id = '') {
    this.id = id;
    this.disabled = false;
    this.textContent = '';
    this.title = '';
    this.value = '';
    this.maxLength = 12000;
    this.attributes = new Map();
    this.listeners = new Map();
    this.classList = {
      values: new Set(['hidden']),
      add: (name) => this.classList.values.add(name),
      remove: (name) => this.classList.values.delete(name),
      contains: (name) => this.classList.values.has(name)
    };
  }
  hasAttribute(name) { return this.attributes.has(name); }
  getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  removeAttribute(name) { this.attributes.delete(name); }
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(listener);
  }
  removeEventListener(type, listener) {
    const entries = this.listeners.get(type) || [];
    this.listeners.set(type, entries.filter((entry) => entry !== listener));
  }
  dispatchEvent(event) {
    event.target = this;
    for (const listener of this.listeners.get(event.type) || []) listener(event);
    return true;
  }
  focus() { this.focused = true; }
}

function makeResult(text, isFinal = false) {
  const entry = [{ transcript: text }];
  entry.isFinal = isFinal;
  return entry;
}

function recognitionEvent(results, resultIndex) {
  return { results, resultIndex };
}

function fixture({ initialValue = '', maxLength = 12000 } = {}) {
  const mic = new FakeElement('micBtn');
  mic.textContent = 'mic';
  mic.title = 'baseline';
  mic.setAttribute('aria-label', 'baseline mic');
  const input = new FakeElement('messageInput');
  input.value = initialValue;
  input.maxLength = maxLength;
  const toast = new FakeElement('toast');
  toast.textContent = 'baseline toast';
  const documentListeners = new Map();
  const dispatched = [];
  const documentRef = {
    hidden: false,
    documentElement: { lang: 'tr-TR' },
    querySelector(selector) {
      if (selector === '#micBtn') return mic;
      if (selector === '#messageInput') return input;
      if (selector === '#toast') return toast;
      return null;
    },
    addEventListener(type, listener) {
      if (!documentListeners.has(type)) documentListeners.set(type, []);
      documentListeners.get(type).push(listener);
    },
    removeEventListener(type, listener) {
      const entries = documentListeners.get(type) || [];
      documentListeners.set(type, entries.filter((entry) => entry !== listener));
    },
    dispatchEvent(event) {
      dispatched.push(event);
      for (const listener of documentListeners.get(event.type) || []) listener(event);
      return true;
    }
  };

  const recognitionInstances = [];
  class FakeRecognition {
    constructor() {
      this.started = false;
      this.stopped = false;
      this.aborted = false;
      recognitionInstances.push(this);
    }
    start() { this.started = true; }
    stop() { this.stopped = true; }
    abort() { this.aborted = true; }
  }

  class FakeEvent {
    constructor(type, options = {}) {
      this.type = type;
      this.bubbles = Boolean(options.bubbles);
    }
  }
  class FakeCustomEvent extends FakeEvent {
    constructor(type, options = {}) {
      super(type);
      this.detail = options.detail;
    }
  }
  class FakeMutationObserver {
    constructor(callback) { this.callback = callback; }
    observe() { this.observing = true; }
    disconnect() { this.observing = false; }
  }

  const root = {
    SpeechRecognition: FakeRecognition,
    Event: FakeEvent,
    CustomEvent: FakeCustomEvent,
    MutationObserver: FakeMutationObserver,
    navigator: { language: 'tr-TR' },
    setTimeout(callback) { this.lastTimerCallback = callback; return 7; },
    clearTimeout() {}
  };

  return { mic, input, toast, documentRef, root, recognitionInstances, dispatched };
}

function clickMic(f) {
  const listeners = f.mic.listeners.get('click') || [];
  assert.equal(listeners.length, 1);
  listeners[0]({ preventDefault() {}, stopImmediatePropagation() {} });
}

function inputEvents(input) {
  return (input.listeners.get('input') || []).length;
}

{
  const f = fixture({ initialValue: 'Önceden yazılmış taslak' });
  let composerInputEvents = 0;
  f.input.addEventListener('input', () => { composerInputEvents += 1; });
  const controller = voice.installVoiceInput(f.documentRef, f.root);
  assert.ok(controller);
  clickMic(f);

  const recognition = f.recognitionInstances[0];
  assert.ok(recognition.started);
  recognition.onstart();
  assert.equal(controller.isListening(), true);
  assert.equal(f.mic.getAttribute('aria-pressed'), 'true');

  recognition.onresult(recognitionEvent([makeResult('Merhaba', false)], 0));
  assert.equal(f.input.value, 'Önceden yazılmış taslak Merhaba');

  recognition.onresult(recognitionEvent([
    makeResult('Merhaba', true),
    makeResult('nasılsın', false)
  ], 0));
  assert.equal(f.input.value, 'Önceden yazılmış taslak Merhaba nasılsın');

  recognition.onresult(recognitionEvent([
    makeResult('Merhaba', true),
    makeResult('nasılsın bugün', false)
  ], 1));
  assert.equal(
    f.input.value,
    'Önceden yazılmış taslak Merhaba nasılsın bugün',
    'finalized earlier result remains when resultIndex advances'
  );

  recognition.onresult(recognitionEvent([
    makeResult('Merhaba', true),
    makeResult('nasılsın bugün', true),
    makeResult('Ankara', false)
  ], 1));
  assert.equal(f.input.value, 'Önceden yazılmış taslak Merhaba nasılsın bugün Ankara');
  assert.equal(composerInputEvents, 4, 'each meaningful recognition update emits one composer input event');

  recognition.onend();
  assert.equal(controller.isListening(), false);
  assert.equal(f.input.value, 'Önceden yazılmış taslak Merhaba nasılsın bugün Ankara');
  assert.equal(f.input.focused, true);
  controller.destroy();
}

{
  const f = fixture({ initialValue: 'abc', maxLength: 10 });
  const controller = voice.installVoiceInput(f.documentRef, f.root);
  clickMic(f);
  const recognition = f.recognitionInstances[0];
  recognition.onresult(recognitionEvent([makeResult('123456789', false)], 0));
  assert.equal(f.input.value.length, 10);
  assert.equal(f.input.value, 'abc 123456');
  controller.destroy();
}

{
  const f = fixture();
  const controller = voice.installVoiceInput(f.documentRef, f.root);
  clickMic(f);
  const first = f.recognitionInstances[0];
  first.onresult(recognitionEvent([makeResult('ilk oturum', true)], 0));
  first.onend();

  clickMic(f);
  const second = f.recognitionInstances[1];
  second.onresult(recognitionEvent([makeResult('ikinci oturum', false)], 0));
  assert.equal(f.input.value, 'ilk oturum ikinci oturum', 'new recognition session uses current composer as prefix');
  second.onend();
  controller.destroy();
}

{
  const f = fixture();
  const controller = voice.installVoiceInput(f.documentRef, f.root);
  clickMic(f);
  const recognition = f.recognitionInstances[0];
  recognition.onresult(recognitionEvent([makeResult('korunmalı', true), makeResult('geçici', false)], 0));
  recognition.onresult(recognitionEvent([makeResult('korunmalı', true)], 1));
  assert.equal(f.input.value, 'korunmalı', 'shrinking browser results remove stale interim tail');
  controller.destroy();
}

{
  const f = fixture({ initialValue: 'taslak' });
  const controller = voice.installVoiceInput(f.documentRef, f.root);
  clickMic(f);
  const recognition = f.recognitionInstances[0];
  recognition.onresult({ results: null, resultIndex: 0 });
  assert.equal(f.input.value, 'taslak', 'malformed recognition result cannot erase composer');
  controller.destroy();
  assert.equal(recognition.aborted, true);
  assert.equal(controller.isListening(), false);
}

assert.equal(inputEvents(new FakeElement()), 0);
console.log('voice input transcript integration tests passed');
