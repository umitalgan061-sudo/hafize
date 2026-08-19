import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const voiceOutput = require('../public/voice-output.js');

class FakeClassList {
  constructor(values = []) { this.values = new Set(values); }
  toggle(name, active) {
    if (active) this.values.add(name);
    else this.values.delete(name);
  }
  contains(name) { return this.values.has(name); }
}

class FakeNode {
  constructor({ textContent = '', title = '', disabled = false, hidden = false, value = '' } = {}) {
    this.textContent = textContent;
    this.title = title;
    this.disabled = disabled;
    this.hidden = hidden;
    this.value = value;
    this.attributes = new Map();
    this.listeners = new Map();
    this.classList = new FakeClassList();
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  removeAttribute(name) { this.attributes.delete(name); }
  addEventListener(type, callback) {
    const group = this.listeners.get(type) || new Set();
    group.add(callback);
    this.listeners.set(type, group);
  }
  removeEventListener(type, callback) { this.listeners.get(type)?.delete(callback); }
  dispatch(type, detail) {
    for (const callback of this.listeners.get(type) || []) callback({ type, detail, preventDefault() {} });
  }
  click() { this.dispatch('click'); }
}

class FakeDocument extends FakeNode {
  constructor(nodes) {
    super();
    this.nodes = nodes;
    this.hidden = false;
  }
  querySelector(selector) { return this.nodes[selector] || null; }
  dispatchEvent(event) { this.dispatch(event.type, event.detail); return true; }
}

class FakeCustomEvent {
  constructor(type, options = {}) { this.type = type; this.detail = options.detail; }
}

function buildHarness() {
  const toggle = new FakeNode({ textContent: 'Host ses düğmesi', title: 'Host title', disabled: true });
  toggle.setAttribute('aria-pressed', 'mixed');
  const card = new FakeNode();
  card.classList.toggle('speaking', true);
  card.classList.toggle('thinking', true);

  const pause = new FakeNode({ textContent: 'Host pause', title: 'Pause title', disabled: true, hidden: false });
  pause.setAttribute('aria-pressed', 'mixed');
  const status = new FakeNode({ textContent: 'Host status', title: 'Status title', hidden: true });
  const rateWrap = new FakeNode({ textContent: 'Host rate wrap', hidden: true });
  const rateSelect = new FakeNode({ value: '1.3', disabled: true });
  const playback = new FakeNode({ textContent: 'Host playback', hidden: true });
  const replay = new FakeNode({ textContent: 'Host replay', title: 'Replay title', disabled: true, hidden: true });
  const stop = new FakeNode({ textContent: 'Host stop', title: 'Stop title', disabled: true, hidden: false });
  const mic = new FakeNode();
  mic.setAttribute('aria-pressed', 'false');
  const input = new FakeNode();
  const composer = new FakeNode();
  const assistant = new FakeNode({ textContent: 'Bu yanıt seslendirilecek.' });
  const messages = new FakeNode();
  messages.querySelectorAll = () => [assistant];

  const documentRef = new FakeDocument({
    '#voiceOutputToggle': toggle,
    '.voice-card': card,
    '#voicePauseToggle': pause,
    '#voiceOutputStatus': status,
    '#voiceRateWrap': rateWrap,
    '#voiceRateSelect': rateSelect,
    '#voicePlaybackActions': playback,
    '#voiceReplayButton': replay,
    '#voiceStopButton': stop,
    '#micBtn': mic,
    '#messageInput': input,
    '#composer': composer,
    '#messages': messages
  });

  const observers = new Map();
  class FakeMutationObserver {
    constructor(callback) { this.callback = callback; this.disconnected = false; }
    observe(target) { observers.set(target, this); }
    disconnect() { this.disconnected = true; }
  }

  const spoken = [];
  let cancelCount = 0;
  const synth = {
    speak(utterance) { spoken.push(utterance); },
    cancel() { cancelCount += 1; },
    pause() {},
    resume() {},
    getVoices() { return [{ lang: 'tr-TR', name: 'Türkçe' }]; }
  };
  class FakeUtterance { constructor(text) { this.text = text; } }
  const storage = new Map([[voiceOutput.STORAGE_KEY, 'true']]);
  const root = {
    CustomEvent: FakeCustomEvent,
    MutationObserver: FakeMutationObserver,
    speechSynthesis: synth,
    SpeechSynthesisUtterance: FakeUtterance,
    localStorage: {
      getItem(key) { return storage.get(key) ?? null; },
      setItem(key, value) { storage.set(key, String(value)); }
    }
  };

  return {
    toggle, card, pause, status, rateWrap, rateSelect, playback, replay, stop,
    mic, input, composer, documentRef, observers, spoken, storage,
    getCancelCount: () => cancelCount,
    root
  };
}

const harness = buildHarness();
const controller = voiceOutput.installVoiceOutput(harness.documentRef, harness.root);
assert.ok(controller);
assert.equal(controller.isEnabled(), true);
assert.equal(harness.toggle.textContent, 'Sesli yanıt açık');
assert.equal(harness.toggle.disabled, false);
assert.equal(harness.toggle.getAttribute('aria-pressed'), 'true');
assert.equal(harness.card.classList.contains('speaking'), false, 'mount kendi transient speaking stateini render etmeli');
assert.equal(harness.card.classList.contains('thinking'), false, 'mount kendi transient thinking stateini render etmeli');
assert.equal(harness.rateSelect.value, String(voiceOutput.DEFAULT_SPEECH_RATE));

assert.equal(controller.speak('Lifecycle testi.'), true);
assert.equal(harness.spoken.length, 1);
assert.equal(controller.isSpeaking(), true);
const staleUtterance = harness.spoken[0];
const cancelBeforeDestroy = harness.getCancelCount();
controller.destroy();
assert.equal(harness.getCancelCount(), cancelBeforeDestroy + 1, 'destroy aktif speech synthesis işini iptal etmeli');

assert.equal(harness.toggle.textContent, 'Host ses düğmesi');
assert.equal(harness.toggle.title, 'Host title');
assert.equal(harness.toggle.disabled, true);
assert.equal(harness.toggle.getAttribute('aria-pressed'), 'mixed');
assert.equal(harness.card.classList.contains('speaking'), true, 'host speaking class geri yüklenmeli');
assert.equal(harness.card.classList.contains('thinking'), true, 'host thinking class geri yüklenmeli');
assert.equal(harness.card.classList.contains('paused'), false);
assert.equal(harness.pause.textContent, 'Host pause');
assert.equal(harness.pause.title, 'Pause title');
assert.equal(harness.pause.disabled, true);
assert.equal(harness.pause.hidden, false);
assert.equal(harness.pause.getAttribute('aria-pressed'), 'mixed');
assert.equal(harness.status.textContent, 'Host status');
assert.equal(harness.status.hidden, true);
assert.equal(harness.rateWrap.hidden, true);
assert.equal(harness.rateSelect.value, '1.3');
assert.equal(harness.rateSelect.disabled, true);
assert.equal(harness.playback.hidden, true);
assert.equal(harness.replay.textContent, 'Host replay');
assert.equal(harness.replay.hidden, true);
assert.equal(harness.stop.textContent, 'Host stop');
assert.equal(harness.stop.hidden, false);

assert.equal(controller.isEnabled(), false, 'destroy sonrası public state aktif owner gibi görünmemeli');
assert.equal(controller.isSpeaking(), false);
assert.equal(controller.setEnabled(true), false, 'destroy sonrası yeniden etkinleştirme inert olmalı');
assert.equal(controller.speak('Destroy sonrası konuşma.'), false, 'destroy sonrası TTS başlatılmamalı');
assert.equal(controller.togglePause(), false);
assert.equal(controller.replayLatest(), false);
assert.equal(controller.stopSpeech(), false);
assert.equal(controller.cancel(), false);
const speechRateAfterDestroy = controller.setSpeechRate(1.3);
assert.equal(speechRateAfterDestroy, voiceOutput.DEFAULT_SPEECH_RATE, 'destroy sonrası rate değişikliği uygulanmamalı');
assert.equal(harness.spoken.length, 1);
assert.equal(harness.toggle.textContent, 'Host ses düğmesi', 'destroy sonrası API host DOMu mutasyona uğratmamalı');

staleUtterance.onend?.();
staleUtterance.onerror?.();
assert.equal(harness.spoken.length, 1, 'stale utterance callbacks yeni generation başlatmamalı');
assert.equal(harness.toggle.textContent, 'Host ses düğmesi', 'stale callback host DOMu değiştirmemeli');

harness.input.disabled = true;
harness.observers.get(harness.input)?.callback();
harness.mic.setAttribute('aria-pressed', 'true');
harness.observers.get(harness.mic)?.callback();
harness.composer.dispatch('submit');
harness.documentRef.hidden = true;
harness.documentRef.dispatch('visibilitychange');
harness.documentRef.dispatch(voiceOutput.VOICE_INPUT_STATE_EVENT, { source: 'voice-input', listening: true });
assert.equal(harness.getCancelCount(), cancelBeforeDestroy + 1, 'destroy sonrası observer/event yolları cancellation side effect üretmemeli');
assert.equal(harness.toggle.textContent, 'Host ses düğmesi');

controller.destroy();
assert.equal(harness.getCancelCount(), cancelBeforeDestroy + 1, 'destroy idempotent olmalı');
assert.equal(harness.toggle.textContent, 'Host ses düğmesi');

console.log('Voice output lifecycle ownership OK: host state restoration, inert teardown and stale callback isolation');