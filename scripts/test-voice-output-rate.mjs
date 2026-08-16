import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const voiceOutput = require('../public/voice-output.js');

assert.equal(voiceOutput.DEFAULT_SPEECH_RATE, 0.98);
assert.deepEqual([...voiceOutput.SPEECH_RATE_OPTIONS], [0.85, 0.98, 1.15, 1.3]);
assert.equal(voiceOutput.normalizeSpeechRate('1.15'), 1.15);
assert.equal(voiceOutput.normalizeSpeechRate(0.85), 0.85);
assert.equal(voiceOutput.normalizeSpeechRate(9), 0.98);
assert.equal(voiceOutput.normalizeSpeechRate('not-a-rate'), 0.98);

class FakeClassList {
  toggle() {}
}
class FakeNode {
  constructor() {
    this.disabled = false;
    this.hidden = false;
    this.value = '';
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
  dispatch(type) { this.listeners.get(type)?.({ target: this }); }
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

const toggle = new FakeNode();
const pause = new FakeNode();
const status = new FakeNode();
const rateWrap = new FakeNode();
const rateSelect = new FakeNode();
const card = new FakeNode();
const input = new FakeNode();
const messages = new FakeNode();
messages.querySelectorAll = () => [];

const documentRef = new FakeEventTarget();
documentRef.hidden = false;
documentRef.querySelector = (selector) => ({
  '#voiceOutputToggle': toggle,
  '#voicePauseToggle': pause,
  '#voiceOutputStatus': status,
  '#voiceRateWrap': rateWrap,
  '#voiceRateSelect': rateSelect,
  '.voice-card': card,
  '#messageInput': input,
  '#messages': messages
})[selector] || null;

const spoken = [];
const synth = {
  speak(utterance) { spoken.push(utterance); },
  cancel() {},
  pause() {},
  resume() {},
  getVoices() { return []; }
};
class FakeUtterance {
  constructor(text) { this.text = text; }
}

const root = {
  speechSynthesis: synth,
  SpeechSynthesisUtterance: FakeUtterance,
  localStorage: { getItem() { return 'true'; }, setItem() {} }
};

const controller = voiceOutput.installVoiceOutput(documentRef, root);
assert.ok(controller);
assert.equal(controller.isEnabled(), true);
assert.equal(controller.getSpeechRate(), 0.98);
assert.equal(rateWrap.hidden, false);
assert.equal(rateSelect.disabled, false);
assert.equal(rateSelect.value, '0.98');

rateSelect.value = '1.15';
rateSelect.dispatch('change');
assert.equal(controller.getSpeechRate(), 1.15);
assert.equal(controller.speak('Bu yanıt hızlı okunacak.'), true);
assert.equal(spoken.at(-1).rate, 1.15);
assert.equal(rateSelect.disabled, true, 'active utterance locks the rate selector');

assert.equal(controller.setSpeechRate(0.85), 1.15, 'active speech rate must not mutate mid-utterance');
assert.equal(controller.getSpeechRate(), 1.15);
spoken.at(-1).onend?.();
assert.equal(controller.isSpeaking(), false);
assert.equal(rateSelect.disabled, false);

rateSelect.value = 'invalid';
rateSelect.dispatch('change');
assert.equal(controller.getSpeechRate(), 0.98, 'unexpected option falls back to bounded default');
assert.equal(rateSelect.value, '0.98');

controller.setEnabled(false);
assert.equal(rateWrap.hidden, true);
controller.setEnabled(true);
assert.equal(controller.getSpeechRate(), 0.98, 'rate remains session-only and stable across enable toggles');

controller.destroy();

console.log('voice output speech-rate tests passed');
