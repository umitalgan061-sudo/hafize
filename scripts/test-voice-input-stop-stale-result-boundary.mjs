import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const voice = require('../public/voice-input.js');

class NodeLike {
  constructor(id = '') {
    this.id = id;
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
  dispatchEvent(event) {
    for (const listener of this.listeners.get(event.type) || []) listener(event);
    return true;
  }
  focus() { this.focused = true; }
}

function makeResult(text, isFinal = false) {
  const value = [{ transcript: text }];
  value.isFinal = isFinal;
  return value;
}

function fixture() {
  const mic = new NodeLike('micBtn');
  const input = new NodeLike('messageInput');
  const toast = new NodeLike('toast');
  const docListeners = new Map();
  const stateEvents = [];
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
      if (!docListeners.has(type)) docListeners.set(type, []);
      docListeners.get(type).push(listener);
    },
    removeEventListener(type, listener) {
      docListeners.set(type, (docListeners.get(type) || []).filter((entry) => entry !== listener));
    },
    dispatchEvent(event) {
      stateEvents.push(event);
      for (const listener of docListeners.get(event.type) || []) listener(event);
      return true;
    }
  };

  const instances = [];
  class Recognition {
    constructor() {
      this.stopCalls = 0;
      this.abortCalls = 0;
      instances.push(this);
    }
    start() { this.started = true; }
    stop() { this.stopCalls += 1; }
    abort() { this.abortCalls += 1; }
  }
  class EventCtor {
    constructor(type, options = {}) { this.type = type; this.bubbles = Boolean(options.bubbles); }
  }
  class CustomEventCtor extends EventCtor {
    constructor(type, options = {}) { super(type); this.detail = options.detail; }
  }
  class MutationObserver {
    constructor(callback) { this.callback = callback; }
    observe() { this.active = true; }
    disconnect() { this.active = false; }
  }
  const root = {
    SpeechRecognition: Recognition,
    Event: EventCtor,
    CustomEvent: CustomEventCtor,
    MutationObserver,
    navigator: { language: 'tr-TR' },
    setTimeout() { return 1; },
    clearTimeout() {}
  };
  return { mic, input, toast, documentRef, root, instances, stateEvents, docListeners };
}

function click(f) {
  const listener = f.mic.listeners.get('click')?.[0];
  assert.equal(typeof listener, 'function');
  listener({ preventDefault() {}, stopImmediatePropagation() {} });
}

function voiceStates(f) {
  return f.stateEvents
    .filter((event) => event.type === voice.VOICE_INPUT_STATE_EVENT)
    .map((event) => event.detail?.listening);
}

{
  const f = fixture();
  const controller = voice.installVoiceInput(f.documentRef, f.root);
  click(f);
  const first = f.instances[0];
  first.onstart();
  first.onresult({ results: [makeResult('ilk', false)], resultIndex: 0 });
  assert.equal(f.input.value, 'ilk');
  assert.equal(controller.isListening(), true);

  click(f);
  assert.equal(first.stopCalls, 1);
  assert.equal(controller.isListening(), false, 'stop publishes inactive state immediately');
  assert.deepEqual(voiceStates(f), [true, false]);

  first.onresult({ results: [makeResult('gecikmiş', true)], resultIndex: 0 });
  assert.equal(f.input.value, 'ilk', 'late onresult after stop is quarantined');
  first.onerror({ error: 'network' });
  assert.notEqual(f.toast.textContent, 'Tarayıcının ses tanıma servisine ulaşılamadı.', 'late error from released recognition is ignored');

  first.onend();
  assert.equal(controller.isListening(), false);
  assert.deepEqual(voiceStates(f), [true, false], 'stale onend cannot emit duplicate state');

  click(f);
  const second = f.instances[1];
  assert.ok(second, 'new session can start before old browser onend arrives');
  second.onresult({ results: [makeResult('yeni', false)], resultIndex: 0 });
  assert.equal(f.input.value, 'ilk yeni');
  controller.destroy();
}

{
  const f = fixture();
  const controller = voice.installVoiceInput(f.documentRef, f.root);
  click(f);
  const active = f.instances[0];
  active.onstart();
  active.onresult({ results: [makeResult('görünürlük', false)], resultIndex: 0 });
  f.documentRef.hidden = true;
  const visibility = f.docListeners.get('visibilitychange')?.[0];
  visibility();
  assert.equal(active.abortCalls, 1);
  assert.equal(controller.isListening(), false);
  active.onresult({ results: [makeResult('arka plan', true)], resultIndex: 0 });
  assert.equal(f.input.value, 'görünürlük', 'background abort quarantines late transcript');
  controller.destroy();
}

{
  const f = fixture();
  const controller = voice.installVoiceInput(f.documentRef, f.root);
  click(f);
  const active = f.instances[0];
  active.onstart();
  f.input.disabled = true;
  const observer = controller;
  // The controller does not expose its observer; the click-stop path still proves
  // released recognitions cannot mutate after the composer becomes unavailable.
  controller.stop();
  active.onresult({ results: [makeResult('disabled stale', true)], resultIndex: 0 });
  assert.equal(f.input.value, '');
  assert.equal(controller.isListening(), false);
  assert.ok(observer);
  controller.destroy();
}

{
  const f = fixture();
  const controller = voice.installVoiceInput(f.documentRef, f.root);
  click(f);
  const active = f.instances[0];
  active.onstart();
  controller.destroy();
  assert.equal(active.abortCalls, 1);
  active.onresult({ results: [makeResult('destroy stale', true)], resultIndex: 0 });
  active.onend();
  assert.equal(f.input.value, '');
  assert.equal(controller.isListening(), false);
}

console.log('voice input stale result boundary tests passed');
