import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const api = require('../public/hands-free.js');

assert.deepEqual(api.NETWORK_RETRY_DELAYS_MS, [2_000, 5_000, 15_000, 30_000, 60_000]);
assert.equal(api.POST_OUTPUT_COOLDOWN_MS, 1_800);
assert.equal(api.SESSION_LIMIT_MS, 30 * 60 * 1_000);
assert.deepEqual(api.classifyRecognitionError('aborted'), { code: 'aborted', kind: 'aborted' });
assert.deepEqual(api.classifyRecognitionError('no-speech'), { code: 'no-speech', kind: 'idle' });
assert.deepEqual(api.classifyRecognitionError('network'), { code: 'network', kind: 'network' });
assert.deepEqual(api.classifyRecognitionError('not_allowed'), { code: 'not-allowed', kind: 'terminal' });
assert.deepEqual(api.classifyRecognitionError('mystery'), { code: 'mystery', kind: 'terminal' });
assert.deepEqual([1, 2, 3, 4, 5, 6].map(api.networkRetryDelay), [2_000, 5_000, 15_000, 30_000, 60_000, 60_000]);

function element() {
  const listeners = new Map();
  return {
    hidden: false,
    disabled: false,
    textContent: '',
    attrs: {},
    classList: { remove() {}, add() {}, contains() { return false; } },
    getAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attrs, name) ? this.attrs[name] : null; },
    setAttribute(name, value) { this.attrs[name] = String(value); },
    removeAttribute(name) { delete this.attrs[name]; },
    addEventListener(type, handler) { listeners.set(type, handler); },
    removeEventListener(type, handler) { if (listeners.get(type) === handler) listeners.delete(type); },
    fire(type, event = {}) { listeners.get(type)?.(event); },
    click() { listeners.get('click')?.({ preventDefault() {} }); }
  };
}

function createHarness() {
  const toggle = element();
  const indicator = element();
  const mic = element();
  const input = element();
  const toast = element();
  const documentListeners = new Map();
  const recognitions = [];
  const timers = new Map();
  let nextTimerId = 0;

  const documentRef = {
    hidden: false,
    documentElement: { lang: 'tr' },
    querySelector(selector) {
      return ({
        '#handsFreeToggle': toggle,
        '#handsFreeIndicator': indicator,
        '#micBtn': mic,
        '#messageInput': input,
        '#toast': toast
      })[selector] || null;
    },
    addEventListener(type, handler) { documentListeners.set(type, handler); },
    removeEventListener(type, handler) { if (documentListeners.get(type) === handler) documentListeners.delete(type); }
  };

  class Recognition {
    constructor() { recognitions.push(this); }
    start() { this.started = true; this.onstart?.(); }
    stop() { this.stopped = true; }
    abort() { this.aborted = true; }
  }

  const root = {
    SpeechRecognition: Recognition,
    navigator: { language: 'tr-TR' },
    MutationObserver: class { observe() {} disconnect() {} },
    setTimeout(handler, ms) {
      const id = ++nextTimerId;
      timers.set(id, { id, handler, ms });
      return id;
    },
    clearTimeout(id) { timers.delete(id); }
  };

  function pending(ms) {
    return [...timers.values()].filter((timer) => ms === undefined || timer.ms === ms);
  }

  function run(timer) {
    assert.ok(timer, 'expected timer');
    timers.delete(timer.id);
    timer.handler();
  }

  function voiceOutput(speaking) {
    documentListeners.get(api.VOICE_OUTPUT_STATE_EVENT)?.({
      detail: { source: 'voice-output', speaking, state: speaking ? 'speaking' : 'idle' }
    });
  }

  return { toggle, indicator, mic, input, toast, documentRef, documentListeners, recognitions, timers, root, pending, run, voiceOutput };
}

function endRecognition(recognition) {
  recognition.onend?.();
}

{
  const harness = createHarness();
  const controller = api.installHandsFree(harness.documentRef, harness.root);
  controller.enable();
  assert.equal(harness.recognitions.length, 1);
  assert.equal(controller.getNetworkErrorStreak(), 0);

  const expectedBackoffs = [2_000, 5_000, 15_000, 30_000, 60_000];
  for (let index = 0; index < expectedBackoffs.length; index += 1) {
    const active = harness.recognitions.at(-1);
    active.onerror?.({ error: 'network' });
    assert.equal(controller.getNetworkErrorStreak(), index + 1);
    assert.equal(controller.getRestartDelayMs(), expectedBackoffs[index]);
    endRecognition(active);
    assert.equal(harness.pending(expectedBackoffs[index]).length, 1, `network retry ${index + 1} must use bounded backoff`);
    harness.run(harness.pending(expectedBackoffs[index])[0]);
    assert.equal(harness.recognitions.length, index + 2);
    assert.equal(controller.isEnabled(), true);
  }

  const terminal = harness.recognitions.at(-1);
  terminal.onerror?.({ error: 'network' });
  assert.equal(controller.getNetworkErrorStreak(), 6);
  assert.equal(controller.isEnabled(), false, 'sixth consecutive network failure must fail closed');
  assert.equal(harness.pending().length, 0, 'terminal network failure must clear recovery timers');
  assert.match(harness.toast.textContent, /yeniden aç/);
  endRecognition(terminal);
  assert.equal(harness.pending().length, 0);
  controller.destroy();
}

{
  const harness = createHarness();
  const controller = api.installHandsFree(harness.documentRef, harness.root);
  controller.enable();
  const first = harness.recognitions[0];
  first.onerror?.({ error: 'network' });
  endRecognition(first);
  harness.run(harness.pending(2_000)[0]);
  const recovered = harness.recognitions[1];
  recovered.onresult?.({ resultIndex: 0, results: [[{ transcript: 'sıradan konuşma' }]] });
  assert.equal(controller.getNetworkErrorStreak(), 0, 'successful transcript must reset network streak');
  assert.equal(controller.getRestartDelayMs(), api.RESTART_DELAY_MS);
  assert.equal(controller.getLastRecognitionError(), '');
  recovered.onerror?.({ error: 'no-speech' });
  assert.equal(controller.getNetworkErrorStreak(), 0);
  endRecognition(recovered);
  assert.equal(harness.pending(api.RESTART_DELAY_MS).length, 1, 'no-speech must use normal restart delay');
  controller.destroy();
  assert.equal(harness.pending().length, 0, 'destroy must cancel pending recovery timers');
}

{
  const harness = createHarness();
  const controller = api.installHandsFree(harness.documentRef, harness.root);
  controller.enable();
  assert.equal(harness.pending(api.SESSION_LIMIT_MS).length, 1, 'opt-in session must be time-bounded');
  const active = harness.recognitions[0];
  harness.run(harness.pending(api.SESSION_LIMIT_MS)[0]);
  assert.equal(controller.isEnabled(), false);
  assert.equal(active.aborted, true, 'session expiry must stop active listening');
  assert.equal(harness.pending().length, 0);
  assert.match(harness.toast.textContent, /30 dakikalık güvenlik süresi/);
  controller.destroy();
}

{
  const harness = createHarness();
  const controller = api.installHandsFree(harness.documentRef, harness.root);
  controller.enable();
  const active = harness.recognitions[0];
  harness.voiceOutput(true);
  assert.equal(active.aborted, true);
  assert.equal(controller.isVoiceOutputSpeaking(), true);
  assert.equal(harness.pending(api.RESTART_DELAY_MS).length, 0);

  harness.voiceOutput(false);
  assert.equal(controller.isCoolingDown(), true);
  assert.equal(harness.pending(api.POST_OUTPUT_COOLDOWN_MS).length, 1, 'TTS end must enter echo-suppression cooldown');
  harness.run(harness.pending(api.POST_OUTPUT_COOLDOWN_MS)[0]);
  assert.equal(controller.isCoolingDown(), false);
  assert.equal(harness.pending(api.RESTART_DELAY_MS).length, 1, 'wake listening resumes only after cooldown plus normal restart delay');
  harness.run(harness.pending(api.RESTART_DELAY_MS)[0]);
  assert.equal(harness.recognitions.length, 2);

  harness.voiceOutput(true);
  harness.voiceOutput(false);
  assert.equal(harness.pending(api.POST_OUTPUT_COOLDOWN_MS).length, 1);
  controller.disable();
  assert.equal(harness.pending().length, 0, 'explicit disable must cancel session and cooldown timers');
  controller.destroy();
}

console.log('hands-free recovery tests passed: backoff, expiry, cooldown and cancellation');
