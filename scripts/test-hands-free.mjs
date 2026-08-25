import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const api = require('../public/hands-free.js');

assert.equal(api.normalizeSpeech(' HAFİZE!!! '), 'hafize');
assert.equal(api.containsWakePhrase('Merhaba Hafize nasılsın'), true);
assert.equal(api.containsWakePhrase('hafızaya kaydet'), false);
assert.equal(api.HANDOFF_TIMEOUT_MS, 1500);
assert.equal(api.VOICE_OUTPUT_STATE_EVENT, 'hafize:voice-output-state');

function element() {
  const listeners = new Map();
  return {
    hidden: false,
    disabled: false,
    textContent: '',
    value: '',
    attrs: {},
    classList: { remove() {} },
    setAttribute(name, value) { this.attrs[name] = value; },
    addEventListener(type, fn) { listeners.set(type, fn); },
    removeEventListener(type) { listeners.delete(type); },
    click() { this.clicked = (this.clicked || 0) + 1; listeners.get('click')?.({ preventDefault() {} }); },
    fire(type) { listeners.get(type)?.({ preventDefault() {} }); }
  };
}

function createHarness({ handoffStartsVoice = true } = {}) {
  const toggle = element();
  const indicator = element();
  const mic = element();
  const input = element();
  const toast = element();
  const docListeners = new Map();
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
    addEventListener(type, fn) { docListeners.set(type, fn); },
    removeEventListener(type) { docListeners.delete(type); }
  };

  const recognitions = [];
  class Recognition {
    constructor() { recognitions.push(this); }
    start() { this.started = true; this.onstart?.(); }
    stop() { this.stopped = true; this.onend?.(); }
    abort() { this.aborted = true; this.onend?.(); }
  }

  const timers = [];
  let nextTimerId = 1;
  const root = {
    SpeechRecognition: Recognition,
    navigator: { language: 'tr-TR' },
    setTimeout(fn, ms) {
      const timer = { id: nextTimerId++, fn, ms, cleared: false };
      timers.push(timer);
      return timer.id;
    },
    clearTimeout(id) {
      const timer = timers.find((item) => item.id === id);
      if (timer) timer.cleared = true;
    },
    MutationObserver: class {
      constructor(fn) { this.fn = fn; }
      observe() {}
      disconnect() { this.disconnected = true; }
    }
  };

  function voiceState(listening) {
    docListeners.get(api.VOICE_INPUT_STATE_EVENT)?.({
      detail: { source: 'voice-input', listening }
    });
  }

  function outputState(speaking, state = speaking ? 'speaking' : 'idle') {
    docListeners.get(api.VOICE_OUTPUT_STATE_EVENT)?.({
      detail: { source: 'voice-output', speaking, state }
    });
  }

  mic.click = () => {
    mic.clicked = (mic.clicked || 0) + 1;
    if (handoffStartsVoice) voiceState(true);
  };

  function pendingTimers(ms) {
    return timers.filter((timer) => !timer.cleared && (ms === undefined || timer.ms === ms));
  }

  function runTimer(timer) {
    timer.cleared = true;
    timer.fn();
  }

  return {
    toggle,
    indicator,
    mic,
    input,
    toast,
    documentRef,
    docListeners,
    recognitions,
    timers,
    root,
    voiceState,
    outputState,
    pendingTimers,
    runTimer
  };
}

function finishOutputCooldown(harness, controller) {
  assert.equal(controller.isCoolingDown(), true, 'TTS end must enter echo-suppression cooldown');
  assert.equal(harness.pendingTimers(api.POST_OUTPUT_COOLDOWN_MS).length, 1);
  assert.equal(harness.pendingTimers(api.RESTART_DELAY_MS).length, 0, 'wake restart must wait for cooldown');
  harness.runTimer(harness.pendingTimers(api.POST_OUTPUT_COOLDOWN_MS)[0]);
  assert.equal(controller.isCoolingDown(), false);
  assert.equal(harness.pendingTimers(api.RESTART_DELAY_MS).length, 1);
  harness.runTimer(harness.pendingTimers(api.RESTART_DELAY_MS)[0]);
}

const harness = createHarness();
const controller = api.installHandsFree(harness.documentRef, harness.root);
assert.equal(controller.isSupported, true);
assert.equal(controller.isEnabled(), false);
assert.equal(controller.isVoiceOutputSpeaking(), false);
assert.equal(harness.indicator.hidden, true);

harness.toggle.fire('click');
assert.equal(controller.isEnabled(), true);
assert.equal(harness.recognitions.length, 1);
assert.equal(harness.recognitions[0].continuous, true);
assert.equal(harness.recognitions[0].interimResults, false);
assert.equal(controller.isListening(), true);
assert.equal(harness.indicator.hidden, false);
assert.match(harness.indicator.textContent, /Hafize/);
assert.match(harness.toast.textContent, /bu oturum için açıldı/);

harness.outputState(true);
assert.equal(controller.isVoiceOutputSpeaking(), true);
assert.equal(harness.recognitions[0].aborted, true, 'TTS başlarken wake recognizer hemen durmalı');
assert.equal(controller.isListening(), false);
assert.equal(harness.pendingTimers(350).length, 0, 'TTS sırasında wake restart kuyruğa alınmamalı');
assert.match(harness.indicator.textContent, /Hafize konuşuyor/);

harness.outputState(false);
assert.equal(controller.isVoiceOutputSpeaking(), false);
finishOutputCooldown(harness, controller);
assert.equal(harness.recognitions.length, 2);
assert.equal(controller.isListening(), true);

harness.outputState(true);
assert.equal(harness.recognitions[1].aborted, true);
const recognitionCountWhileSpeaking = harness.recognitions.length;
harness.input.disabled = false;
harness.outputState(true, 'speaking');
assert.equal(harness.pendingTimers(350).length, 0);
assert.equal(harness.recognitions.length, recognitionCountWhileSpeaking, 'duplicate speaking state yeni recognizer başlatmamalı');
harness.outputState(false);
finishOutputCooldown(harness, controller);
assert.equal(harness.recognitions.length, 3);

harness.recognitions[2].onresult?.({ resultIndex: 0, results: [[{ transcript: 'merhaba dünya' }]] });
assert.equal(harness.mic.clicked || 0, 0);
harness.recognitions[2].onresult?.({ resultIndex: 0, results: [[{ transcript: 'Hafize' }]] });
assert.equal(harness.recognitions[2].stopped, true);
assert.equal(harness.mic.clicked, 1);
assert.equal(controller.isListening(), false);
assert.equal(controller.isVoiceInputListening(), true);
assert.equal(controller.isHandoffWaiting(), false);
assert.equal(harness.pendingTimers(api.HANDOFF_TIMEOUT_MS).length, 0, 'confirmed voice input must cancel handoff fallback');
assert.match(harness.indicator.textContent, /Sesli giriş etkin/);

harness.voiceState(false);
assert.equal(controller.isVoiceInputListening(), false);
assert.equal(harness.pendingTimers(350).length, 1, 'wake listening resumes only after voice input ends');
harness.runTimer(harness.pendingTimers(350)[0]);
assert.equal(harness.recognitions.length, 4);
assert.equal(controller.isListening(), true);

harness.documentRef.hidden = true;
harness.docListeners.get('visibilitychange')?.();
assert.equal(harness.recognitions[3].aborted, true);
assert.equal(controller.isListening(), false);
assert.equal(controller.isHandoffWaiting(), false);

harness.documentRef.hidden = false;
harness.docListeners.get('visibilitychange')?.();
assert.equal(harness.pendingTimers(350).length, 1);
harness.toggle.fire('click');
assert.equal(controller.isEnabled(), false);
assert.equal(harness.pendingTimers().length, 0, 'disabling must clear queued wake restarts');

const failed = createHarness({ handoffStartsVoice: false });
const failedController = api.installHandsFree(failed.documentRef, failed.root);
failed.toggle.fire('click');
assert.equal(failedController.isListening(), true);
failed.recognitions[0].onresult?.({ resultIndex: 0, results: [[{ transcript: 'Hafize' }]] });
assert.equal(failed.mic.clicked, 1);
assert.equal(failedController.isHandoffWaiting(), true);
assert.match(failed.indicator.textContent, /hazırlanıyor/);
assert.equal(failed.pendingTimers(api.HANDOFF_TIMEOUT_MS).length, 1);

failed.outputState(true);
assert.equal(failedController.isVoiceOutputSpeaking(), true);
failed.runTimer(failed.pendingTimers(api.HANDOFF_TIMEOUT_MS)[0]);
assert.equal(failedController.isHandoffWaiting(), false);
assert.equal(failed.pendingTimers(350).length, 0, 'TTS aktifken failed handoff wake restart etmemeli');
failed.outputState(false);
finishOutputCooldown(failed, failedController);
assert.equal(failed.recognitions.length, 2);
assert.equal(failedController.isListening(), true);

failed.recognitions[1].onerror?.({ error: 'not-allowed' });
assert.equal(failedController.isEnabled(), false);
assert.equal(failedController.isHandoffWaiting(), false);
assert.match(failed.toast.textContent, /mikrofon izni kullanılamıyor/);

const unsupportedToggle = element();
const unsupportedDoc = {
  hidden: false,
  documentElement: { lang: 'tr' },
  querySelector(selector) {
    return ({
      '#handsFreeToggle': unsupportedToggle,
      '#handsFreeIndicator': element(),
      '#micBtn': element(),
      '#messageInput': element(),
      '#toast': element()
    })[selector] || null;
  },
  addEventListener() {},
  removeEventListener() {}
};
const unsupported = api.installHandsFree(unsupportedDoc, {});
assert.equal(unsupported.isSupported, false);
assert.equal(unsupportedToggle.disabled, true);

controller.destroy();
failedController.destroy();
assert.equal(controller.isVoiceOutputSpeaking(), false);
console.log('hands-free tests passed: wake handoff and TTS echo suppression');
