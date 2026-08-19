import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const voiceOutput = require('../public/voice-output.js');

class FakeClassList {
  constructor(values = []) { this.values = new Set(values); }
  toggle(name, active) { if (active) this.values.add(name); else this.values.delete(name); }
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
}

class FakeDocument extends FakeNode {
  constructor(nodes) { super(); this.nodes = nodes; this.hidden = false; }
  querySelector(selector) { return this.nodes[selector] || null; }
  dispatchEvent(event) { this.dispatch(event.type, event.detail); return true; }
}

class FakeCustomEvent {
  constructor(type, options = {}) { this.type = type; this.detail = options.detail; }
}

function buildHarness({ throwOnSpeak = false } = {}) {
  const toggle = new FakeNode({ textContent: 'Host toggle' });
  const card = new FakeNode();
  card.classList.toggle('error', true);
  const pause = new FakeNode({ hidden: true });
  const status = new FakeNode({ textContent: 'Host status' });
  const rateWrap = new FakeNode();
  const rateSelect = new FakeNode({ value: '0.98' });
  const playback = new FakeNode();
  const replay = new FakeNode({ hidden: true });
  const stop = new FakeNode({ hidden: true });
  const mic = new FakeNode();
  mic.setAttribute('aria-pressed', 'false');
  const input = new FakeNode();
  const composer = new FakeNode();
  const assistant = new FakeNode({ textContent: 'Tekrar denenebilir yanıt.' });
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

  class FakeMutationObserver {
    constructor(callback) { this.callback = callback; }
    observe() {}
    disconnect() {}
  }

  const spoken = [];
  const synth = {
    speak(utterance) {
      if (throwOnSpeak) throw new Error('platform speech failure');
      spoken.push(utterance);
    },
    cancel() {}, pause() {}, resume() {},
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

  const states = [];
  documentRef.addEventListener(voiceOutput.VOICE_OUTPUT_STATE_EVENT, (event) => states.push(event.detail));
  return { toggle, card, status, input, documentRef, root, spoken, states };
}

const harness = buildHarness();
const controller = voiceOutput.installVoiceOutput(harness.documentRef, harness.root);
assert.ok(controller);
assert.equal(harness.card.classList.contains('error'), false, 'mount transient error classını sahiplenmeli');
assert.equal(controller.hasError(), false);
assert.equal(controller.getErrorCode(), '');

assert.equal(controller.speak('İlk deneme.'), true);
assert.equal(harness.spoken.length, 1);
const failedUtterance = harness.spoken[0];
failedUtterance.onerror?.({ error: 'synthesis-failed' });
assert.equal(controller.isSpeaking(), false);
assert.equal(controller.hasError(), true);
assert.equal(controller.getErrorCode(), 'SPEECH_SYNTHESIS_FAILED');
assert.equal(harness.card.classList.contains('error'), true);
assert.equal(harness.status.textContent, 'Sesli yanıt oynatılamadı. Tekrar deneyebilirsin.');
assert.equal(harness.states.at(-1)?.state, 'error');
assert.equal(harness.states.at(-1)?.error, true);
assert.equal('errorCode' in harness.states.at(-1), false, 'teknik hata kodu DOM event detail içine taşınmamalı');

assert.equal(controller.replayLatest(), true, 'kullanıcı aynı yanıtı açıkça yeniden deneyebilmeli');
assert.equal(harness.spoken.length, 2);
assert.equal(controller.hasError(), false, 'yeni speech generation önceki recoverable error stateini temizlemeli');
assert.equal(harness.card.classList.contains('error'), false);
assert.equal(harness.states.at(-1)?.state, 'speaking');

failedUtterance.onerror?.({ error: 'late-error' });
assert.equal(controller.hasError(), false, 'önceki generationdan stale error callback yeni playbacki bozmamalı');
assert.equal(harness.spoken.length, 2);

harness.spoken[1].onend?.();
assert.equal(controller.isSpeaking(), false);
assert.equal(controller.hasError(), false);
assert.equal(harness.states.at(-1)?.state, 'idle');

assert.equal(controller.speak('Yeni deneme.'), true);
assert.equal(harness.spoken.length, 3);
harness.input.disabled = true;
controller.syncStreamState();
assert.equal(controller.hasError(), false);
assert.equal(harness.states.at(-1)?.state, 'thinking', 'yeni stream activity stale error stateini taşımamalı');

controller.destroy();
assert.equal(harness.card.classList.contains('error'), true, 'destroy host-owned error classını exact restore etmeli');
assert.equal(controller.hasError(), false);
assert.equal(controller.getErrorCode(), '');

const thrown = buildHarness({ throwOnSpeak: true });
const thrownController = voiceOutput.installVoiceOutput(thrown.documentRef, thrown.root);
assert.equal(thrownController.speak('Platform exception testi.'), true, 'API çağrısı kabul edilen speech denemesini raporlar');
assert.equal(thrownController.isSpeaking(), false);
assert.equal(thrownController.hasError(), true, 'speechSynthesis.speak exception recoverable error stateine dönmeli');
assert.equal(thrown.status.textContent, 'Sesli yanıt oynatılamadı. Tekrar deneyebilirsin.');
assert.equal(thrown.states.at(-1)?.state, 'error');
thrownController.setEnabled(false);
assert.equal(thrownController.hasError(), false, 'kapatma error stateini temizlemeli');
thrownController.destroy();

console.log('Voice output error state OK: visible recoverable failure, stale callback isolation and host ownership restoration');