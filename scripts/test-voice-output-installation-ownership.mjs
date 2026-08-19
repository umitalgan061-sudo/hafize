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
  listenerCount(type) { return this.listeners.get(type)?.size || 0; }
}

class FakeDocument extends FakeNode {
  constructor(nodes) { super(); this.nodes = nodes; this.hidden = false; }
  querySelector(selector) { return this.nodes[selector] || null; }
  dispatchEvent() { return true; }
}

class FakeCustomEvent {
  constructor(type, options = {}) { this.type = type; this.detail = options.detail; }
}

function createNodes() {
  const toggle = new FakeNode({ textContent: 'Host toggle', title: 'Host title', disabled: true });
  toggle.setAttribute('aria-pressed', 'mixed');
  const card = new FakeNode();
  card.classList.toggle('thinking', true);
  const pause = new FakeNode({ textContent: 'Host pause', disabled: true, hidden: false });
  pause.setAttribute('aria-pressed', 'mixed');
  const status = new FakeNode({ textContent: 'Host status', hidden: true });
  const rateWrap = new FakeNode({ hidden: true });
  const rateSelect = new FakeNode({ value: '1.3', disabled: true });
  const playback = new FakeNode({ hidden: true });
  const replay = new FakeNode({ textContent: 'Host replay', disabled: true, hidden: true });
  const stop = new FakeNode({ textContent: 'Host stop', disabled: true, hidden: false });
  const mic = new FakeNode();
  mic.setAttribute('aria-pressed', 'false');
  const input = new FakeNode();
  const composer = new FakeNode();
  const messages = new FakeNode();
  messages.querySelectorAll = () => [];
  return { toggle, card, pause, status, rateWrap, rateSelect, playback, replay, stop, mic, input, composer, messages };
}

function createDocument(nodes) {
  return new FakeDocument({
    '#voiceOutputToggle': nodes.toggle,
    '.voice-card': nodes.card,
    '#voicePauseToggle': nodes.pause,
    '#voiceOutputStatus': nodes.status,
    '#voiceRateWrap': nodes.rateWrap,
    '#voiceRateSelect': nodes.rateSelect,
    '#voicePlaybackActions': nodes.playback,
    '#voiceReplayButton': nodes.replay,
    '#voiceStopButton': nodes.stop,
    '#micBtn': nodes.mic,
    '#messageInput': nodes.input,
    '#composer': nodes.composer,
    '#messages': nodes.messages
  });
}

function createRoot({ failOnObserve = null } = {}) {
  let observeCount = 0;
  const observers = [];
  class Observer {
    constructor(callback) { this.callback = callback; this.disconnected = false; observers.push(this); }
    observe() {
      observeCount += 1;
      if (observeCount === failOnObserve) throw new Error('OBSERVE_FAILED');
    }
    disconnect() { this.disconnected = true; }
  }
  class Utterance { constructor(text) { this.text = text; } }
  return {
    root: {
      CustomEvent: FakeCustomEvent,
      MutationObserver: Observer,
      speechSynthesis: {
        speak() {}, cancel() {}, pause() {}, resume() {}, getVoices() { return []; }
      },
      SpeechSynthesisUtterance: Utterance,
      localStorage: { getItem() { return null; }, setItem() {} }
    },
    observers
  };
}

const nodes = createNodes();
const documentRef = createDocument(nodes);
const { root } = createRoot();
const first = voiceOutput.installVoiceOutput(documentRef, root);
assert.ok(first);
assert.throws(
  () => voiceOutput.installVoiceOutput(documentRef, root),
  /VOICE_OUTPUT_ALREADY_INSTALLED/,
  'aynı voice card üzerinde ikinci aktif controller fail-closed reddedilmeli'
);
assert.equal(nodes.toggle.listenerCount('click'), 1, 'duplicate install ek listener bırakmamalı');
first.destroy();
const remount = voiceOutput.installVoiceOutput(documentRef, root);
assert.ok(remount, 'destroy sonrası clean remount mümkün olmalı');
remount.destroy();

const rollbackNodes = createNodes();
const rollbackDocument = createDocument(rollbackNodes);
const rollbackRoot = createRoot({ failOnObserve: 2 });
assert.throws(
  () => voiceOutput.installVoiceOutput(rollbackDocument, rollbackRoot.root),
  /OBSERVE_FAILED/,
  'ikinci observer kurulumu başarısızsa install hata vermeli'
);
assert.equal(rollbackRoot.observers.length, 2);
assert.equal(rollbackRoot.observers[0].disconnected, true, 'başarıyla bağlanan ilk observer rollbackte disconnect edilmeli');
assert.equal(rollbackRoot.observers[1].disconnected, true, 'hata veren observer nesnesi de rollbackte disconnect edilmeli');
assert.equal(rollbackNodes.toggle.listenerCount('click'), 0);
assert.equal(rollbackNodes.pause.listenerCount('click'), 0);
assert.equal(rollbackNodes.rateSelect.listenerCount('change'), 0);
assert.equal(rollbackNodes.replay.listenerCount('click'), 0);
assert.equal(rollbackNodes.stop.listenerCount('click'), 0);
assert.equal(rollbackNodes.composer.listenerCount('submit'), 0);
assert.equal(rollbackDocument.listenerCount('visibilitychange'), 0);
assert.equal(rollbackDocument.listenerCount(voiceOutput.VOICE_INPUT_STATE_EVENT), 0);

assert.equal(rollbackNodes.toggle.textContent, 'Host toggle');
assert.equal(rollbackNodes.toggle.title, 'Host title');
assert.equal(rollbackNodes.toggle.disabled, true);
assert.equal(rollbackNodes.toggle.getAttribute('aria-pressed'), 'mixed');
assert.equal(rollbackNodes.card.classList.contains('thinking'), true);
assert.equal(rollbackNodes.card.classList.contains('speaking'), false);
assert.equal(rollbackNodes.pause.textContent, 'Host pause');
assert.equal(rollbackNodes.pause.disabled, true);
assert.equal(rollbackNodes.pause.hidden, false);
assert.equal(rollbackNodes.pause.getAttribute('aria-pressed'), 'mixed');
assert.equal(rollbackNodes.status.textContent, 'Host status');
assert.equal(rollbackNodes.status.hidden, true);
assert.equal(rollbackNodes.rateWrap.hidden, true);
assert.equal(rollbackNodes.rateSelect.value, '1.3');
assert.equal(rollbackNodes.rateSelect.disabled, true);
assert.equal(rollbackNodes.playback.hidden, true);
assert.equal(rollbackNodes.replay.textContent, 'Host replay');
assert.equal(rollbackNodes.stop.textContent, 'Host stop');

const retry = voiceOutput.installVoiceOutput(rollbackDocument, createRoot().root);
assert.ok(retry, 'başarısız partial install active ownership bırakmamalı');
retry.destroy();

console.log('Voice output installation ownership OK: duplicate install denial, partial setup rollback and clean retry');