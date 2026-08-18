import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { installHandsFree, VOICE_OUTPUT_STATE_EVENT } = require('../public/hands-free.js');

class FakeElement {
  constructor() {
    this.attributes = new Map();
    this.listeners = new Map();
    this.classList = { remove() {} };
    this.disabled = false;
    this.hidden = false;
    this.textContent = '';
    this.clickCount = 0;
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }
  removeEventListener(type, listener) { this.listeners.get(type)?.delete(listener); }
  dispatch(type, event = {}) {
    for (const listener of this.listeners.get(type) || []) listener(event);
  }
  click() {
    this.clickCount += 1;
    this.dispatch('click', { isTrusted: true });
  }
}

class FakeDocument {
  constructor(elements) {
    this.elements = elements;
    this.hidden = false;
    this.documentElement = { lang: 'tr-TR' };
    this.listeners = new Map();
  }
  querySelector(selector) { return this.elements.get(selector) || null; }
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }
  removeEventListener(type, listener) { this.listeners.get(type)?.delete(listener); }
  dispatch(type, detail) {
    const event = { detail };
    for (const listener of this.listeners.get(type) || []) listener(event);
  }
}

function createHarness() {
  const toggle = new FakeElement();
  const indicator = new FakeElement();
  const micButton = new FakeElement();
  const input = new FakeElement();
  const toast = new FakeElement();
  const documentRef = new FakeDocument(new Map([
    ['#handsFreeToggle', toggle],
    ['#handsFreeIndicator', indicator],
    ['#micBtn', micButton],
    ['#messageInput', input],
    ['#toast', toast]
  ]));

  let nextTimerId = 1;
  const timers = new Map();
  const instances = [];

  class FakeRecognition {
    constructor() {
      this.started = false;
      this.aborted = false;
      this.stopped = false;
      instances.push(this);
    }
    start() {
      this.started = true;
      this.onstart?.();
    }
    abort() { this.aborted = true; }
    stop() { this.stopped = true; }
    end() { this.onend?.(); }
    fail(code) {
      this.onerror?.({ error: code });
      this.onend?.();
    }
    result(text) {
      this.onresult?.({ resultIndex: 0, results: [[{ transcript: text }]] });
    }
  }

  class FakeMutationObserver {
    constructor(callback) { this.callback = callback; }
    observe() {}
    disconnect() { this.disconnected = true; }
  }

  const root = {
    SpeechRecognition: FakeRecognition,
    MutationObserver: FakeMutationObserver,
    navigator: { language: 'tr-TR' },
    setTimeout(fn, ms) {
      const id = nextTimerId++;
      timers.set(id, { fn, ms });
      return id;
    },
    clearTimeout(id) { timers.delete(id); }
  };

  function pendingDelays() {
    return [...timers.values()].map((timer) => timer.ms).sort((a, b) => a - b);
  }
  function runTimerWithDelay(ms) {
    const entry = [...timers.entries()].find(([, timer]) => timer.ms === ms);
    assert.ok(entry, `expected timer with ${ms}ms delay; got ${pendingDelays().join(', ')}`);
    timers.delete(entry[0]);
    entry[1].fn();
  }

  const controller = installHandsFree(documentRef, root);
  assert.ok(controller);
  return { controller, documentRef, indicator, instances, micButton, pendingDelays, runTimerWithDelay, toast, toggle };
}

{
  const h = createHarness();
  h.controller.enable();
  assert.equal(h.controller.isEnabled(), true);
  assert.equal(h.controller.isListening(), true);
  assert.equal(h.instances.length, 1);

  const expectedDelays = [2_000, 5_000, 15_000, 30_000, 60_000];
  for (let index = 0; index < expectedDelays.length; index += 1) {
    const current = h.instances.at(-1);
    current.fail('network');
    assert.equal(h.controller.isEnabled(), true, `network failure ${index + 1} should stay bounded-retryable`);
    assert.equal(h.controller.getNetworkErrorStreak(), index + 1);
    assert.equal(h.controller.getRestartDelayMs(), expectedDelays[index]);
    assert.ok(h.pendingDelays().includes(expectedDelays[index]));
    h.runTimerWithDelay(expectedDelays[index]);
    assert.equal(h.instances.length, index + 2);
    assert.equal(h.controller.getNetworkErrorStreak(), index + 1, 'restart must not erase the network failure budget');
  }

  h.instances.at(-1).fail('network');
  assert.equal(h.controller.isEnabled(), false, 'sixth network failure must fail closed');
  assert.equal(h.controller.isListening(), false);
  assert.equal(h.toggle.getAttribute('aria-pressed'), 'false');
  assert.match(h.toast.textContent, /hata.*kapatıldı/i);
  assert.equal(h.pendingDelays().includes(60_000), false, 'terminal failure must not schedule another network retry');
}

{
  const h = createHarness();
  h.controller.enable();
  h.instances[0].fail('audio-capture');
  assert.equal(h.controller.isEnabled(), false);
  assert.equal(h.controller.isListening(), false);
  assert.match(h.toast.textContent, /mikrofonu kullanamadı/i);
  const count = h.instances.length;
  for (const delay of h.pendingDelays().filter((value) => value !== 30 * 60 * 1_000)) h.runTimerWithDelay(delay);
  assert.equal(h.instances.length, count, 'terminal capture failure must never auto-restart recognition');
}

{
  const h = createHarness();
  h.controller.enable();
  h.instances[0].fail('no-speech');
  assert.equal(h.controller.isEnabled(), true);
  assert.equal(h.controller.getNetworkErrorStreak(), 0);
  assert.equal(h.controller.getRestartDelayMs(), 350);
  h.runTimerWithDelay(350);
  assert.equal(h.instances.length, 2);
}

{
  const h = createHarness();
  h.controller.enable();
  h.documentRef.dispatch(VOICE_OUTPUT_STATE_EVENT, { source: 'voice-output', speaking: false });
  assert.equal(h.controller.isCoolingDown(), false, 'an idle false event is not a completed TTS turn');

  h.documentRef.dispatch(VOICE_OUTPUT_STATE_EVENT, { source: 'voice-output', speaking: true });
  assert.equal(h.controller.isVoiceOutputSpeaking(), true);
  assert.equal(h.controller.isListening(), false);
  assert.equal(h.instances[0].aborted, true);

  h.documentRef.dispatch(VOICE_OUTPUT_STATE_EVENT, { source: 'voice-output', speaking: false });
  assert.equal(h.controller.isCoolingDown(), true, 'only true -> false speaking transition starts echo cooldown');
  assert.ok(h.pendingDelays().includes(1_800));
  h.runTimerWithDelay(1_800);
  assert.equal(h.controller.isCoolingDown(), false);
  h.runTimerWithDelay(350);
  assert.equal(h.controller.isListening(), true);
}

{
  const h = createHarness();
  h.controller.enable();
  const first = h.instances[0];
  first.fail('network');
  h.runTimerWithDelay(2_000);
  const recovered = h.instances[1];
  recovered.result('ortam sesi');
  assert.equal(h.controller.getNetworkErrorStreak(), 0, 'a real transcript proves recovery and resets the network streak');
  assert.equal(h.controller.getRestartDelayMs(), 350);
  recovered.end();
  h.runTimerWithDelay(350);
  assert.equal(h.controller.isListening(), true);
}

console.log('hands-free lifecycle runtime checks passed');
