import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { installHandsFree, VOICE_INPUT_STATE_EVENT, VOICE_OUTPUT_STATE_EVENT } = require('../public/hands-free.js');

function element() {
  const listeners = new Map();
  return {
    disabled: false,
    hidden: false,
    textContent: '',
    attrs: new Map(),
    classList: { remove() {} },
    setAttribute(name, value) { this.attrs.set(name, String(value)); },
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
    },
    removeEventListener(type, fn) { listeners.get(type)?.delete(fn); },
    click() { for (const fn of listeners.get('click') || []) fn({ isTrusted: true }); }
  };
}

function harness({ startThrows = false } = {}) {
  const nodes = new Map([
    ['#handsFreeToggle', element()],
    ['#handsFreeIndicator', element()],
    ['#micBtn', element()],
    ['#messageInput', element()],
    ['#toast', element()]
  ]);
  const listeners = new Map();
  const timers = new Map();
  let id = 0;
  const recognitions = [];

  class Recognition {
    constructor() { recognitions.push(this); }
    start() {
      if (startThrows) throw new Error('private browser detail');
      this.onstart?.();
    }
    abort() { this.aborted = true; }
    stop() { this.stopped = true; }
    fail(code) { this.onerror?.({ error: code }); this.onend?.(); }
    end() { this.onend?.(); }
  }

  const documentRef = {
    hidden: false,
    documentElement: { lang: 'tr-TR' },
    querySelector(selector) { return nodes.get(selector) || null; },
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
    },
    removeEventListener(type, fn) { listeners.get(type)?.delete(fn); },
    dispatch(type, detail) { for (const fn of listeners.get(type) || []) fn({ detail }); }
  };
  const root = {
    SpeechRecognition: Recognition,
    navigator: { language: 'tr-TR' },
    MutationObserver: class { observe() {} disconnect() {} },
    setTimeout(fn, ms) { const timerId = ++id; timers.set(timerId, { fn, ms }); return timerId; },
    clearTimeout(timerId) { timers.delete(timerId); }
  };
  const controller = installHandsFree(documentRef, root);
  const run = (ms) => {
    const entry = [...timers.entries()].find(([, timer]) => timer.ms === ms);
    assert.ok(entry, `missing ${ms}ms timer`);
    timers.delete(entry[0]);
    entry[1].fn();
  };
  return { controller, documentRef, nodes, recognitions, run, timers };
}

{
  const h = harness({ startThrows: true });
  h.controller.enable();
  assert.equal(h.controller.isEnabled(), false, 'unknown start exception must fail closed instead of spinning');
  assert.equal(h.controller.isListening(), false);
  assert.equal([...h.timers.values()].some((timer) => timer.ms === 350), false);
  assert.match(h.nodes.get('#toast').textContent, /hata.*kapatıldı/i);
  assert.doesNotMatch(h.nodes.get('#toast').textContent, /private browser detail/i);
}

{
  const h = harness();
  h.controller.enable();
  h.recognitions[0].fail('mystery-secret-provider-error');
  assert.equal(h.controller.isEnabled(), false);
  assert.equal(h.controller.getLastRecognitionError(), 'mystery-secret-provider-error');
  assert.doesNotMatch(h.nodes.get('#toast').textContent, /mystery|secret|provider/i);
}

{
  const h = harness();
  h.controller.enable();
  h.documentRef.hidden = true;
  h.documentRef.dispatch('visibilitychange');
  assert.equal(h.controller.isListening(), false);
  assert.equal(h.recognitions[0].aborted, true);
  assert.equal([...h.timers.values()].some((timer) => timer.ms === 350), false);
  h.documentRef.hidden = false;
  h.documentRef.dispatch('visibilitychange');
  h.run(350);
  assert.equal(h.controller.isListening(), true);
}

{
  const h = harness();
  h.controller.enable();
  h.documentRef.dispatch(VOICE_INPUT_STATE_EVENT, { source: 'voice-input', listening: true });
  assert.equal(h.controller.isVoiceInputListening(), true);
  assert.equal(h.controller.isListening(), false);
  h.documentRef.dispatch(VOICE_INPUT_STATE_EVENT, { source: 'voice-input', listening: false });
  h.run(350);
  assert.equal(h.controller.isListening(), true);
}

{
  const h = harness();
  h.controller.enable();
  h.documentRef.dispatch(VOICE_OUTPUT_STATE_EVENT, { source: 'other-component', speaking: true });
  assert.equal(h.controller.isVoiceOutputSpeaking(), false, 'foreign event sources must be ignored');
  h.documentRef.dispatch(VOICE_OUTPUT_STATE_EVENT, { source: 'voice-output', speaking: 'yes' });
  assert.equal(h.controller.isVoiceOutputSpeaking(), false, 'malformed speaking state must be ignored');
  h.controller.destroy();
  assert.equal(h.controller.isEnabled(), false);
  assert.equal(h.controller.isListening(), false);
  const before = h.recognitions.length;
  h.documentRef.dispatch('visibilitychange');
  assert.equal(h.recognitions.length, before, 'destroyed controller must never re-arm recognition');
}

console.log('hands-free fail-closed lifecycle checks passed');
