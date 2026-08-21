import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const voice = require('../public/voice-input.js');

class Element {
  constructor() {
    this.disabled = false;
    this.textContent = '';
    this.title = '';
    this.value = '';
    this.maxLength = 12000;
    this.attributes = new Map();
    this.listeners = new Map();
    this.classList = { add() {}, remove() {} };
  }
  hasAttribute(name) { return this.attributes.has(name); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  removeAttribute(name) { this.attributes.delete(name); }
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(listener);
  }
  removeEventListener(type, listener) {
    this.listeners.set(type, (this.listeners.get(type) || []).filter((entry) => entry !== listener));
  }
  dispatchEvent() { return true; }
  focus() {}
}

function result(text, isFinal = false) {
  const entry = [{ transcript: text }];
  entry.isFinal = isFinal;
  return entry;
}

function fixture({ startThrows = false, supported = true } = {}) {
  const mic = new Element();
  mic.textContent = 'baseline mic';
  mic.title = 'baseline title';
  mic.setAttribute('aria-label', 'baseline label');
  const input = new Element();
  const toast = new Element();
  const documentRef = {
    hidden: false,
    documentElement: { lang: 'tr-TR' },
    listeners: new Map(),
    querySelector(selector) {
      if (selector === '#micBtn') return mic;
      if (selector === '#messageInput') return input;
      if (selector === '#toast') return toast;
      return null;
    },
    addEventListener(type, listener) {
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      this.listeners.get(type).push(listener);
    },
    removeEventListener(type, listener) {
      this.listeners.set(type, (this.listeners.get(type) || []).filter((entry) => entry !== listener));
    },
    dispatchEvent() { return true; }
  };
  const instances = [];
  class Recognition {
    constructor() { instances.push(this); }
    start() {
      if (startThrows) throw new Error('start failed');
      this.started = true;
    }
    stop() { this.stopped = true; }
    abort() { this.aborted = true; }
  }
  class EventCtor { constructor(type) { this.type = type; } }
  class CustomEventCtor extends EventCtor { constructor(type, options = {}) { super(type); this.detail = options.detail; } }
  class MutationObserver { constructor(callback) { this.callback = callback; } observe() {} disconnect() {} }
  const root = {
    Event: EventCtor,
    CustomEvent: CustomEventCtor,
    MutationObserver,
    setTimeout() { return 1; },
    clearTimeout() {},
    navigator: { language: 'tr-TR' },
    ...(supported ? { SpeechRecognition: Recognition } : {})
  };
  return { mic, input, toast, documentRef, root, instances };
}

function click(f) {
  const listener = f.mic.listeners.get('click')?.[0];
  assert.equal(typeof listener, 'function');
  listener({ preventDefault() {}, stopImmediatePropagation() {} });
}

{
  const f = fixture();
  const first = voice.installVoiceInput(f.documentRef, f.root);
  assert.throws(() => voice.installVoiceInput(f.documentRef, f.root), /VOICE_INPUT_ALREADY_INSTALLED/);
  first.destroy();
  const second = voice.installVoiceInput(f.documentRef, f.root);
  assert.ok(second, 'destroy releases ownership for clean remount');
  second.destroy();
}

{
  const f = fixture();
  const controller = voice.installVoiceInput(f.documentRef, f.root);
  click(f);
  const old = f.instances[0];
  old.onresult({ results: [result('eski', true)], resultIndex: 0 });
  controller.stop();
  click(f);
  const current = f.instances[1];
  current.onresult({ results: [result('yeni', false)], resultIndex: 0 });
  assert.equal(f.input.value, 'eski yeni');

  old.onresult({ results: [result('bozmamalı', true)], resultIndex: 0 });
  old.onend();
  assert.equal(f.input.value, 'eski yeni', 'released old session cannot overwrite current composer');
  assert.equal(controller.isListening(), true, 'stale old onend cannot stop newer session');

  current.onend();
  assert.equal(controller.isListening(), false);
  controller.destroy();
}

{
  const f = fixture({ startThrows: true });
  const controller = voice.installVoiceInput(f.documentRef, f.root);
  click(f);
  assert.equal(controller.isListening(), false);
  assert.equal(f.instances.length, 1);
  click(f);
  assert.equal(f.instances.length, 2, 'failed start does not retain stale recognition ownership');
  controller.destroy();
}

{
  const f = fixture({ supported: false });
  const controller = voice.installVoiceInput(f.documentRef, f.root);
  assert.equal(controller.isSupported, false);
  click(f);
  assert.equal(f.instances.length, 0);
  assert.match(f.toast.textContent, /desteklenmiyor/i);
  controller.destroy();
  assert.equal(f.mic.textContent, 'baseline mic');
  assert.equal(f.mic.title, 'baseline title');
  assert.equal(f.mic.getAttribute('aria-label'), 'baseline label');
}

console.log('voice input session isolation tests passed');
