import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const api = require('../public/voice-output.js');

assert.equal(api.normalizeVoiceInputState({ source: 'voice-input', listening: true }), true);
assert.equal(api.normalizeVoiceInputState({ source: 'voice-input', listening: false }), false);
assert.equal(api.normalizeVoiceInputState({ source: 'other', listening: true }), null);
assert.equal(api.normalizeVoiceInputState({ source: 'voice-input', listening: 'true' }), null);
assert.equal(api.normalizeVoiceInputState(null), null);

class FakeClassList {
  constructor() { this.values = new Set(); }
  contains(value) { return this.values.has(value); }
  toggle(value, force) {
    if (force) this.values.add(value);
    else this.values.delete(value);
  }
}

class FakeNode {
  constructor(id = '') {
    this.id = id;
    this.attributes = new Map();
    this.listeners = new Map();
    this.classList = new FakeClassList();
    this.disabled = false;
    this.hidden = false;
    this.value = '';
    this.textContent = '';
    this.title = '';
  }
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(listener);
  }
  removeEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    this.listeners.set(type, listeners.filter((entry) => entry !== listener));
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
  removeAttribute(name) { this.attributes.delete(name); }
}

function makeFixture({ micListening = false } = {}) {
  const toggle = new FakeNode('voiceOutputToggle');
  const card = new FakeNode('voiceCard');
  const mic = new FakeNode('micBtn');
  mic.setAttribute('aria-pressed', String(micListening));
  const input = new FakeNode('messageInput');
  const composer = new FakeNode('composer');
  const messages = new FakeNode('messages');
  const content = new FakeNode();
  content.textContent = 'Son Hafize yanıtı.';
  messages.querySelectorAll = (selector) => selector === '.message.assistant .content' ? [content] : [];

  const pause = new FakeNode('voicePauseToggle');
  const status = new FakeNode('voiceOutputStatus');
  const rateWrap = new FakeNode('voiceRateWrap');
  const rate = new FakeNode('voiceRateSelect');
  rate.value = '0.98';
  const playback = new FakeNode('voicePlaybackActions');
  const replay = new FakeNode('voiceReplayButton');
  const stop = new FakeNode('voiceStopButton');

  const bySelector = new Map([
    ['#voiceOutputToggle', toggle], ['.voice-card', card], ['#micBtn', mic],
    ['#messageInput', input], ['#composer', composer], ['#messages', messages],
    ['#voicePauseToggle', pause], ['#voiceOutputStatus', status], ['#voiceRateWrap', rateWrap],
    ['#voiceRateSelect', rate], ['#voicePlaybackActions', playback],
    ['#voiceReplayButton', replay], ['#voiceStopButton', stop]
  ]);
  const documentListeners = new Map();
  const stateEvents = [];
  const documentRef = {
    hidden: false,
    querySelector(selector) { return bySelector.get(selector) || null; },
    addEventListener(type, listener) {
      if (!documentListeners.has(type)) documentListeners.set(type, []);
      documentListeners.get(type).push(listener);
    },
    removeEventListener(type, listener) {
      const listeners = documentListeners.get(type) || [];
      documentListeners.set(type, listeners.filter((entry) => entry !== listener));
    },
    dispatchEvent(event) {
      if (event.type === api.VOICE_OUTPUT_STATE_EVENT) stateEvents.push(event.detail);
      for (const listener of documentListeners.get(event.type) || []) listener(event);
      return true;
    }
  };

  const observers = [];
  class FakeMutationObserver {
    constructor(callback) { this.callback = callback; this.target = null; observers.push(this); }
    observe(target, options) { this.target = target; this.options = options; }
    disconnect() { this.disconnected = true; }
  }
  class FakeCustomEvent {
    constructor(type, options) { this.type = type; this.detail = options?.detail; }
  }
  class FakeUtterance {
    constructor(text) { this.text = text; }
  }
  const spoken = [];
  let cancelCount = 0;
  const synth = {
    speak(utterance) { spoken.push(utterance); },
    cancel() { cancelCount += 1; },
    pause() {},
    resume() {},
    getVoices() { return []; }
  };
  const root = {
    speechSynthesis: synth,
    SpeechSynthesisUtterance: FakeUtterance,
    MutationObserver: FakeMutationObserver,
    CustomEvent: FakeCustomEvent,
    localStorage: {
      getItem(key) { assert.equal(key, api.STORAGE_KEY); return 'true'; },
      setItem() {}
    }
  };

  function voiceState(listening, source = 'voice-input') {
    documentRef.dispatchEvent(new FakeCustomEvent(api.VOICE_INPUT_STATE_EVENT, {
      detail: { source, listening }
    }));
  }
  function micObserver() {
    return observers.find((observer) => observer.target === mic);
  }

  return {
    toggle, card, mic, input, composer, messages, content, pause, status, rate,
    playback, replay, stop, documentRef, root, spoken, stateEvents, observers,
    voiceState, micObserver, cancelCount: () => cancelCount
  };
}

{
  const f = makeFixture();
  const controller = api.installVoiceOutput(f.documentRef, f.root);
  assert.ok(controller);
  assert.equal(controller.isEnabled(), true);
  assert.equal(controller.isVoiceInputListening(), false);
  assert.equal(controller.speak('İlk sesli yanıt.'), true);
  assert.equal(f.spoken.length, 1);
  assert.equal(controller.isSpeaking(), true);

  const beforeCancel = f.cancelCount();
  f.voiceState(true);
  assert.equal(controller.isVoiceInputListening(), true);
  assert.equal(controller.isSpeaking(), false);
  assert.ok(f.cancelCount() > beforeCancel, 'microphone activation cancels current TTS');
  assert.match(f.status.textContent, /Mikrofon dinliyor/i);
  assert.equal(controller.speak('Mikrofon açıkken okunmamalı.'), false);
  assert.equal(controller.replayLatest(), false);
  assert.equal(f.spoken.length, 1, 'no TTS egress while microphone is listening');

  f.input.disabled = true;
  controller.syncStreamState();
  f.content.textContent = 'Dinleme sırasında tamamlanan yeni yanıt.';
  f.input.disabled = false;
  controller.syncStreamState();
  assert.equal(f.spoken.length, 1, 'stream completion cannot restart TTS into a live microphone');

  f.voiceState(false);
  assert.equal(controller.isVoiceInputListening(), false);
  assert.equal(f.spoken.length, 1, 'ending microphone capture does not auto-play the skipped response');
  assert.equal(controller.replayLatest(), true, 'user may explicitly replay after microphone closes');
  assert.equal(f.spoken.length, 2);
  assert.equal(f.spoken[1].text, 'Dinleme sırasında tamamlanan yeni yanıt.');

  const latestOutputState = f.stateEvents.at(-1);
  assert.equal(latestOutputState.source, 'voice-output');
  assert.equal(typeof latestOutputState.voiceInputListening, 'boolean');

  controller.destroy();
  f.voiceState(true);
  assert.equal(controller.isVoiceInputListening(), false, 'destroyed controller is inert');
  const remount = api.installVoiceOutput(f.documentRef, f.root);
  assert.ok(remount, 'destroy releases installation ownership');
  remount.destroy();
}

{
  const f = makeFixture({ micListening: true });
  const controller = api.installVoiceOutput(f.documentRef, f.root);
  assert.equal(controller.isVoiceInputListening(), true, 'initial aria-pressed state is fail-closed');
  assert.equal(controller.speak('Başlangıçta mikrofon açık.'), false);
  assert.equal(f.spoken.length, 0);

  f.voiceState(false, 'untrusted-source');
  assert.equal(controller.isVoiceInputListening(), true, 'foreign state events cannot lower the microphone guard');

  f.mic.setAttribute('aria-pressed', 'false');
  const observer = f.micObserver();
  assert.ok(observer);
  observer.callback();
  assert.equal(controller.isVoiceInputListening(), false, 'ARIA observer recovers state if the custom event is missed');
  assert.equal(controller.speak('Mikrofon kapandıktan sonra kullanıcı isteği.'), true);
  assert.equal(f.spoken.length, 1);
  controller.destroy();
}

{
  const f = makeFixture();
  const controller = api.installVoiceOutput(f.documentRef, f.root);
  const longText = `${'Birinci bölüm '.repeat(20)}. ${'İkinci bölüm '.repeat(20)}.`;
  assert.equal(controller.speak(longText), true);
  assert.equal(f.spoken.length, 1);
  const firstUtterance = f.spoken[0];

  f.voiceState(true);
  const afterBargeIn = f.spoken.length;
  firstUtterance.onend?.();
  assert.equal(f.spoken.length, afterBargeIn, 'stale utterance end cannot continue queued chunks after barge-in');
  assert.equal(controller.isSpeaking(), false);
  controller.destroy();
}

console.log('voice output barge-in lifecycle tests passed');
