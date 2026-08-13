import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const voice = require(path.join(ROOT, 'public/voice-input.js'));

assert.equal(voice.normalizeTranscript('  merhaba   dünya  '), 'merhaba dünya');
assert.equal(voice.normalizeTranscript(null), '');
assert.equal(voice.mergeTranscript('Hazır metin', ' yeni   sözler '), 'Hazır metin yeni sözler');
assert.equal(voice.mergeTranscript('', 'tek başına'), 'tek başına');
assert.equal(voice.mergeTranscript('12345', '67890', 8), '12345 67');
assert.equal(voice.mapSpeechError('not-allowed').includes('Mikrofon izni'), true);
assert.equal(voice.mapSpeechError('audio-capture').includes('mikrofon'), true);
assert.equal(voice.mapSpeechError('aborted'), '');

const resultEvent = {
  resultIndex: 1,
  results: [
    [{ transcript: 'yok say' }],
    [{ transcript: ' merhaba ' }],
    [{ transcript: ' dünya ' }]
  ]
};
assert.equal(voice.readRecognitionText(resultEvent), 'merhaba dünya');

class FakeClassList {
  constructor(initial = []) { this.values = new Set(initial); }
  add(value) { this.values.add(value); }
  remove(value) { this.values.delete(value); }
  contains(value) { return this.values.has(value); }
}

class FakeElement {
  constructor({ value = '', maxLength = 12000, classes = [] } = {}) {
    this.value = value;
    this.maxLength = maxLength;
    this.disabled = false;
    this.textContent = '';
    this.title = '';
    this.attributes = new Map();
    this.classList = new FakeClassList(classes);
    this.listeners = new Map();
    this.focusCount = 0;
    this.dispatched = [];
  }

  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name); }
  addEventListener(type, listener, capture = false) {
    const key = `${type}:${Boolean(capture)}`;
    const list = this.listeners.get(key) || [];
    list.push(listener);
    this.listeners.set(key, list);
  }
  removeEventListener(type, listener, capture = false) {
    const key = `${type}:${Boolean(capture)}`;
    const list = this.listeners.get(key) || [];
    this.listeners.set(key, list.filter((item) => item !== listener));
  }
  dispatchEvent(event) {
    this.dispatched.push(event);
    return true;
  }
  focus() { this.focusCount += 1; }
  clickCapture() {
    const state = { prevented: false, stopped: false };
    const event = {
      preventDefault: () => { state.prevented = true; },
      stopImmediatePropagation: () => { state.stopped = true; }
    };
    for (const listener of this.listeners.get('click:true') || []) listener(event);
    return state;
  }
}

class FakeMutationObserver {
  static instances = [];
  constructor(callback) {
    this.callback = callback;
    this.disconnected = false;
    FakeMutationObserver.instances.push(this);
  }
  observe(target, options) { this.target = target; this.options = options; }
  disconnect() { this.disconnected = true; }
  trigger() { this.callback([{ type: 'attributes', attributeName: 'disabled' }]); }
}

class FakeRecognition {
  static instances = [];
  constructor() {
    this.started = false;
    this.stopped = false;
    this.aborted = false;
    FakeRecognition.instances.push(this);
  }
  start() {
    this.started = true;
    this.onstart?.();
  }
  stop() {
    this.stopped = true;
    this.onend?.();
  }
  abort() {
    this.aborted = true;
    this.onend?.();
  }
  emitResult(text) {
    this.onresult?.({ resultIndex: 0, results: [[{ transcript: text }]] });
  }
  emitError(error) { this.onerror?.({ error }); }
  end() { this.onend?.(); }
}

class FakeEvent {
  constructor(type, options = {}) { this.type = type; Object.assign(this, options); }
}

function createHarness({ supported = true, initialValue = 'Önceki', maxLength = 12000 } = {}) {
  FakeRecognition.instances = [];
  FakeMutationObserver.instances = [];
  const mic = new FakeElement();
  const input = new FakeElement({ value: initialValue, maxLength });
  const toast = new FakeElement({ classes: ['hidden'] });
  const documentRef = {
    documentElement: { lang: 'tr' },
    querySelector(selector) {
      if (selector === '#micBtn') return mic;
      if (selector === '#messageInput') return input;
      if (selector === '#toast') return toast;
      return null;
    }
  };
  let timerId = 0;
  const root = {
    navigator: { language: 'tr-TR' },
    MutationObserver: FakeMutationObserver,
    Event: FakeEvent,
    setTimeout() { timerId += 1; return timerId; },
    clearTimeout() {}
  };
  if (supported) root.SpeechRecognition = FakeRecognition;
  const controller = voice.installVoiceInput(documentRef, root);
  return { controller, documentRef, input, mic, root, toast };
}

{
  const { controller, mic, input, toast } = createHarness();
  assert.equal(controller.isSupported, true);
  assert.equal(mic.disabled, false);
  assert.equal(mic.getAttribute('aria-pressed'), 'false');
  assert.equal(mic.textContent, '◉');

  const click = mic.clickCapture();
  assert.deepEqual(click, { prevented: true, stopped: true });
  const recognition = FakeRecognition.instances.at(-1);
  assert.ok(recognition);
  assert.equal(recognition.started, true);
  assert.equal(recognition.lang, 'tr');
  assert.equal(recognition.interimResults, true);
  assert.equal(controller.isListening(), true);
  assert.equal(mic.getAttribute('aria-pressed'), 'true');
  assert.equal(mic.textContent, '●');
  assert.equal(toast.textContent.includes('otomatik gönderilmez'), true);

  recognition.emitResult(' yeni   cümle ');
  assert.equal(input.value, 'Önceki yeni cümle');
  assert.equal(input.dispatched.at(-1)?.type, 'input');

  mic.clickCapture();
  assert.equal(recognition.stopped, true);
  assert.equal(controller.isListening(), false);
  assert.equal(input.focusCount, 1);

  controller.destroy();
  assert.equal(FakeMutationObserver.instances[0].disconnected, true);
}

{
  const { controller, mic, input } = createHarness({ initialValue: '12345', maxLength: 8 });
  mic.clickCapture();
  const recognition = FakeRecognition.instances.at(-1);
  recognition.emitResult('67890');
  assert.equal(input.value, '12345 67');

  input.disabled = true;
  FakeMutationObserver.instances[0].trigger();
  assert.equal(mic.disabled, true);
  assert.equal(controller.isListening(), false);
}

{
  const { controller, mic, toast } = createHarness({ supported: false });
  assert.equal(controller.isSupported, false);
  assert.equal(mic.disabled, true);
  assert.equal(mic.title.includes('desteklemiyor'), true);
  const click = mic.clickCapture();
  assert.equal(click.stopped, true);
  assert.equal(toast.textContent.includes('desteklemiyor'), true);
}

{
  const { mic, toast } = createHarness();
  mic.clickCapture();
  const recognition = FakeRecognition.instances.at(-1);
  recognition.emitError('not-allowed');
  assert.equal(toast.textContent.includes('Mikrofon izni'), true);
  recognition.end();
}

assert.equal(voice.getSpeechRecognitionConstructor({ webkitSpeechRecognition: FakeRecognition }), FakeRecognition);
assert.equal(voice.getSpeechRecognitionConstructor({}), null);

console.log('Voice input OK: explicit start, transcript-only composer fill, no auto-submit, streaming disable, privacy/error UX, and unsupported fallback verified');
