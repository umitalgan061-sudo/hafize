import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const voiceOutput = require('../public/voice-output.js');

class FakeClassList {
  constructor() { this.values = new Set(); }
  toggle(name, active) { if (active) this.values.add(name); else this.values.delete(name); }
  contains(name) { return this.values.has(name); }
}

class FakeNode {
  constructor() {
    this.disabled = false;
    this.hidden = false;
    this.textContent = '';
    this.title = '';
    this.attributes = new Map();
    this.listeners = new Map();
    this.classList = new FakeClassList();
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  addEventListener(type, callback) { this.listeners.set(type, callback); }
  removeEventListener(type) { this.listeners.delete(type); }
  click() { this.listeners.get('click')?.({ preventDefault() {} }); }
}

class FakeEventTarget {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, callback) {
    const group = this.listeners.get(type) || new Set();
    group.add(callback);
    this.listeners.set(type, group);
  }
  removeEventListener(type, callback) { this.listeners.get(type)?.delete(callback); }
  dispatchEvent(event) {
    for (const callback of this.listeners.get(event.type) || []) callback(event);
    return true;
  }
}

class FakeCustomEvent {
  constructor(type, options = {}) { this.type = type; this.detail = options.detail; }
}

const toggle = new FakeNode();
const pause = new FakeNode();
const status = new FakeNode();
const card = new FakeNode();
const mic = new FakeNode();
const input = new FakeNode();
const composer = new FakeNode();
const messages = new FakeNode();
messages.querySelectorAll = () => [];
mic.setAttribute('aria-pressed', 'false');

const documentRef = new FakeEventTarget();
documentRef.hidden = false;
documentRef.querySelector = (selector) => ({
  '#voiceOutputToggle': toggle,
  '#voicePauseToggle': pause,
  '#voiceOutputStatus': status,
  '.voice-card': card,
  '#micBtn': mic,
  '#messageInput': input,
  '#composer': composer,
  '#messages': messages
})[selector] || null;

let pauseCalls = 0;
let resumeCalls = 0;
let cancelCalls = 0;
const spoken = [];
const synth = {
  speak(utterance) { spoken.push(utterance); },
  cancel() { cancelCalls += 1; },
  pause() { pauseCalls += 1; },
  resume() { resumeCalls += 1; },
  getVoices() { return [{ lang: 'tr-TR', name: 'Türkçe' }]; }
};
class FakeUtterance {
  constructor(text) { this.text = text; }
}

const storage = new Map([[voiceOutput.STORAGE_KEY, 'true']]);
const root = new FakeEventTarget();
root.CustomEvent = FakeCustomEvent;
root.speechSynthesis = synth;
root.SpeechSynthesisUtterance = FakeUtterance;
root.localStorage = {
  getItem(key) { return storage.get(key) ?? null; },
  setItem(key, value) { storage.set(key, String(value)); }
};
root.observers = new Map();
root.MutationObserver = class {
  constructor(callback) { this.callback = callback; }
  observe(target) { root.observers.set(target, this); }
  disconnect() {}
};

const states = [];
documentRef.addEventListener(voiceOutput.VOICE_OUTPUT_STATE_EVENT, (event) => states.push(event.detail));

const controller = voiceOutput.installVoiceOutput(documentRef, root);
assert.ok(controller);
assert.equal(controller.isPauseSupported, true);
assert.equal(controller.isEnabled(), true);
assert.equal(controller.isPaused(), false);
assert.equal(pause.hidden, true, 'pause control stays hidden while no utterance is active');
assert.equal(status.textContent, 'Sesli yanıt hazır.');

assert.equal(controller.speak('Duraklatılabilir bir Hafize yanıtı.'), true);
assert.equal(spoken.length, 1);
assert.equal(controller.isSpeaking(), true);
assert.equal(pause.hidden, false);
assert.equal(pause.disabled, false);
assert.equal(pause.getAttribute('aria-pressed'), 'false');
assert.equal(status.textContent, 'Hafize konuşuyor.');

pause.click();
assert.equal(pauseCalls, 1);
assert.equal(controller.isPaused(), true);
assert.equal(controller.isSpeaking(), true, 'paused utterance remains an active speech session');
assert.equal(pause.getAttribute('aria-pressed'), 'true');
assert.equal(pause.textContent, 'Sesli yanıtı sürdür');
assert.equal(card.classList.contains('speaking'), false, 'orb speaking animation stops while paused');
assert.equal(card.classList.contains('paused'), true);
assert.equal(status.textContent, 'Sesli yanıt duraklatıldı.');
assert.deepEqual(states.at(-1), {
  source: 'voice-output',
  state: 'paused',
  speaking: true,
  thinking: false,
  enabled: true,
  supported: true,
  voiceInputListening: false,
  error: false
});

pause.click();
assert.equal(resumeCalls, 1);
assert.equal(controller.isPaused(), false);
assert.equal(card.classList.contains('speaking'), true);
assert.equal(card.classList.contains('paused'), false);
assert.equal(status.textContent, 'Hafize konuşuyor.');

pause.click();
assert.equal(controller.isPaused(), true);
controller.cancel();
assert.equal(controller.isSpeaking(), false);
assert.equal(controller.isPaused(), false, 'cancel must clear pause state');
assert.equal(pause.hidden, true);
assert.equal(status.textContent, 'Sesli yanıt hazır.');
assert.ok(cancelCalls >= 2, 'starting and cancelling speech use the existing generation-safe cancellation');

const unsupportedPause = new FakeNode();
const unsupportedDocument = new FakeEventTarget();
unsupportedDocument.hidden = false;
unsupportedDocument.querySelector = (selector) => ({
  '#voiceOutputToggle': new FakeNode(),
  '#voicePauseToggle': unsupportedPause,
  '#voiceOutputStatus': new FakeNode(),
  '.voice-card': new FakeNode()
})[selector] || null;
const unsupportedRoot = {
  speechSynthesis: { speak() {}, cancel() {}, getVoices() { return []; } },
  SpeechSynthesisUtterance: FakeUtterance,
  localStorage: { getItem() { return 'true'; }, setItem() {} }
};
const noPauseController = voiceOutput.installVoiceOutput(unsupportedDocument, unsupportedRoot);
assert.equal(noPauseController.isSupported, true);
assert.equal(noPauseController.isPauseSupported, false);
assert.equal(noPauseController.togglePause(), false);
assert.equal(unsupportedPause.hidden, true, 'unsupported pause/resume APIs fail closed without exposing a dead control');

controller.destroy();

console.log('voice output pause/resume tests passed');
