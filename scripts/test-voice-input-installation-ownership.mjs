import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const voiceInput = require('../public/voice-input.js');

class FakeClassList {
  constructor(values = []) { this.values = new Set(values); }
  add(name) { this.values.add(name); }
  remove(name) { this.values.delete(name); }
  contains(name) { return this.values.has(name); }
}

class FakeNode {
  constructor({ textContent = '', title = '', disabled = false, value = '' } = {}) {
    this.textContent = textContent;
    this.title = title;
    this.disabled = disabled;
    this.value = value;
    this.maxLength = 12000;
    this.attributes = new Map();
    this.listeners = new Map();
    this.classList = new FakeClassList();
  }
  hasAttribute(name) { return this.attributes.has(name); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  setAttribute(name, value) {
    this.attributes.set(name, String(value));
    if (name === 'class') this.classList = new FakeClassList(String(value).split(/\s+/).filter(Boolean));
  }
  removeAttribute(name) {
    this.attributes.delete(name);
    if (name === 'class') this.classList = new FakeClassList();
  }
  addEventListener(type, callback) {
    const group = this.listeners.get(type) || new Set();
    group.add(callback);
    this.listeners.set(type, group);
  }
  removeEventListener(type, callback) { this.listeners.get(type)?.delete(callback); }
  listenerCount(type) { return this.listeners.get(type)?.size || 0; }
  dispatchEvent(event) {
    for (const callback of this.listeners.get(event.type) || []) callback(event);
    return true;
  }
  focus() {}
}

class FakeDocument extends FakeNode {
  constructor(nodes) {
    super();
    this.nodes = nodes;
    this.hidden = false;
    this.documentElement = { lang: 'tr-TR' };
  }
  querySelector(selector) { return this.nodes[selector] || null; }
}

class FakeEvent {
  constructor(type) { this.type = type; }
}
class FakeCustomEvent extends FakeEvent {
  constructor(type, options = {}) { super(type); this.detail = options.detail; }
}

function buildHarness({ failObserve = false } = {}) {
  const mic = new FakeNode({ textContent: 'Host mic', title: 'Host title', disabled: true });
  mic.setAttribute('aria-pressed', 'mixed');
  mic.setAttribute('aria-label', 'Host label');
  const input = new FakeNode({ value: 'Başlangıç' });
  const toast = new FakeNode({ textContent: 'Host toast' });
  toast.setAttribute('class', 'toast host-class hidden');
  const documentRef = new FakeDocument({ '#micBtn': mic, '#messageInput': input, '#toast': toast });

  const observers = [];
  class FakeMutationObserver {
    constructor(callback) { this.callback = callback; this.disconnected = false; observers.push(this); }
    observe() { if (failObserve) throw new Error('OBSERVE_FAILED'); }
    disconnect() { this.disconnected = true; }
  }

  const recognitions = [];
  class Recognition {
    constructor() { recognitions.push(this); }
    start() { this.onstart?.(); }
    stop() { this.onend?.(); }
    abort() { this.onend?.(); }
  }

  let timerId = 0;
  const timers = new Map();
  const root = {
    SpeechRecognition: Recognition,
    MutationObserver: FakeMutationObserver,
    Event: FakeEvent,
    CustomEvent: FakeCustomEvent,
    navigator: { language: 'tr-TR' },
    setTimeout(callback) { timerId += 1; timers.set(timerId, callback); return timerId; },
    clearTimeout(id) { timers.delete(id); }
  };

  return { mic, input, toast, documentRef, root, observers, recognitions, timers };
}

const harness = buildHarness();
const first = voiceInput.installVoiceInput(harness.documentRef, harness.root);
assert.ok(first);
assert.throws(
  () => voiceInput.installVoiceInput(harness.documentRef, harness.root),
  /VOICE_INPUT_ALREADY_INSTALLED/,
  'aynı mic button üzerinde ikinci aktif controller fail-closed reddedilmeli'
);
assert.equal(harness.mic.listenerCount('click'), 1, 'duplicate install ikinci listener bırakmamalı');
assert.equal(harness.documentRef.listenerCount('visibilitychange'), 1);

first.destroy();
assert.equal(harness.mic.listenerCount('click'), 0);
assert.equal(harness.documentRef.listenerCount('visibilitychange'), 0);
assert.equal(harness.mic.textContent, 'Host mic');
assert.equal(harness.mic.title, 'Host title');
assert.equal(harness.mic.disabled, true);
assert.equal(harness.mic.getAttribute('aria-pressed'), 'mixed');
assert.equal(harness.mic.getAttribute('aria-label'), 'Host label');
assert.equal(harness.toast.textContent, 'Host toast');
assert.equal(harness.toast.getAttribute('class'), 'toast host-class hidden');

const remount = voiceInput.installVoiceInput(harness.documentRef, harness.root);
assert.ok(remount, 'destroy ownership kaydını bırakmalı ve temiz remount mümkün olmalı');
remount.destroy();

const rollback = buildHarness({ failObserve: true });
assert.throws(
  () => voiceInput.installVoiceInput(rollback.documentRef, rollback.root),
  /OBSERVE_FAILED/,
  'observer setup failure install işlemini fail-closed bitirmeli'
);
assert.equal(rollback.observers.length, 1);
assert.equal(rollback.observers[0].disconnected, true, 'yaratılmış observer rollbackte disconnect edilmeli');
assert.equal(rollback.mic.listenerCount('click'), 0, 'partial install click listener bırakmamalı');
assert.equal(rollback.documentRef.listenerCount('visibilitychange'), 0, 'partial install document listener bırakmamalı');
assert.equal(rollback.mic.textContent, 'Host mic');
assert.equal(rollback.mic.title, 'Host title');
assert.equal(rollback.mic.disabled, true);
assert.equal(rollback.mic.getAttribute('aria-pressed'), 'mixed');
assert.equal(rollback.mic.getAttribute('aria-label'), 'Host label');
assert.equal(rollback.toast.textContent, 'Host toast');
assert.equal(rollback.toast.getAttribute('class'), 'toast host-class hidden');
assert.equal(rollback.timers.size, 0, 'rollback announcer timer bırakmamalı');

const retry = voiceInput.installVoiceInput(rollback.documentRef, buildHarness().root);
assert.ok(retry, 'başarısız partial install active ownership bırakmamalı');
retry.destroy();

const listening = buildHarness();
listening.mic.disabled = false;
const active = voiceInput.installVoiceInput(listening.documentRef, listening.root);
active.start();
assert.equal(active.isListening(), true);
assert.equal(listening.toast.classList.contains('hidden'), false, 'announce toast görünür olmalı');
assert.notEqual(listening.toast.textContent, 'Host toast');
const staleRecognition = listening.recognitions[0];
active.destroy();
assert.equal(active.isListening(), false);
assert.equal(listening.toast.textContent, 'Host toast', 'destroy announcer-owned toast textini restore etmeli');
assert.equal(listening.toast.getAttribute('class'), 'toast host-class hidden', 'destroy host toast class stateini exact restore etmeli');
staleRecognition.onerror?.({ error: 'network' });
staleRecognition.onend?.();
assert.equal(listening.toast.textContent, 'Host toast', 'destroy sonrası stale recognition callback host DOMu değiştirmemeli');

console.log('Voice input installation ownership OK: duplicate denial, setup rollback, toast restoration and clean remount');