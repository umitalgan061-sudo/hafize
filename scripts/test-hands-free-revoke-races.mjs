import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  HANDS_FREE_REVOKE_EVENT,
  VOICE_INPUT_STATE_EVENT,
  VOICE_OUTPUT_STATE_EVENT,
  installHandsFree
} = require('../public/hands-free.js');

class Target {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, listener) {
    const list = this.listeners.get(type) || [];
    list.push(listener);
    this.listeners.set(type, list);
  }
  removeEventListener(type, listener) {
    const list = this.listeners.get(type) || [];
    this.listeners.set(type, list.filter((item) => item !== listener));
  }
  dispatchEvent(event) {
    for (const listener of [...(this.listeners.get(event.type) || [])]) listener(event);
    return true;
  }
}

function element({ hidden = false } = {}) {
  const target = new Target();
  const attrs = new Map();
  return Object.assign(target, {
    hidden,
    disabled: false,
    textContent: '',
    classList: { add() {}, remove() {}, contains() { return false; } },
    getAttribute(name) { return attrs.has(name) ? attrs.get(name) : null; },
    setAttribute(name, value) { attrs.set(name, String(value)); },
    removeAttribute(name) { attrs.delete(name); },
    click() { this.dispatchEvent({ type: 'click' }); }
  });
}

function harness() {
  const documentRef = new Target();
  const toggle = element();
  const indicator = element({ hidden: true });
  const micButton = element();
  const input = element();
  const toast = element();
  documentRef.hidden = false;
  documentRef.documentElement = { lang: 'tr-TR' };
  documentRef.querySelector = (selector) => ({
    '#handsFreeToggle': toggle,
    '#handsFreeIndicator': indicator,
    '#micBtn': micButton,
    '#messageInput': input,
    '#toast': toast
  })[selector] || null;

  const recognizers = [];
  class Recognition {
    constructor() {
      this.abortCount = 0;
      recognizers.push(this);
    }
    start() { this.onstart?.(); }
    abort() { this.abortCount += 1; }
    stop() { this.onend?.(); }
  }

  const timers = new Map();
  let nextTimer = 0;
  const root = {
    SpeechRecognition: Recognition,
    navigator: { language: 'tr-TR' },
    MutationObserver: class { observe() {} disconnect() {} },
    setTimeout(callback, delay) {
      nextTimer += 1;
      timers.set(nextTimer, { callback, delay });
      return nextTimer;
    },
    clearTimeout(id) { timers.delete(id); }
  };

  return { documentRef, root, toggle, micButton, recognizers, timers };
}

function revoke(documentRef, detail = {}) {
  documentRef.dispatchEvent({ type: HANDS_FREE_REVOKE_EVENT, detail });
}

{
  const h = harness();
  const controller = installHandsFree(h.documentRef, h.root);
  controller.enable();
  assert.equal(controller.isEnabled(), true);

  h.documentRef.dispatchEvent({
    type: VOICE_OUTPUT_STATE_EVENT,
    detail: { source: 'voice-output', speaking: true }
  });
  assert.equal(controller.isVoiceOutputSpeaking(), true);
  assert.equal(controller.isEnabled(), true);

  revoke(h.documentRef, { source: 'background-guard', reason: 'hidden' });
  assert.equal(controller.isEnabled(), false);
  assert.equal(h.timers.size, 0, 'revoke during TTS must clear hands-free timers');

  h.documentRef.dispatchEvent({
    type: VOICE_OUTPUT_STATE_EVENT,
    detail: { source: 'voice-output', speaking: false }
  });
  assert.equal(controller.isEnabled(), false, 'TTS completion after revoke cannot restart hands-free');
  assert.equal(h.timers.size, 0);
  controller.destroy();
}

{
  const h = harness();
  const controller = installHandsFree(h.documentRef, h.root);
  controller.enable();

  h.documentRef.dispatchEvent({
    type: VOICE_INPUT_STATE_EVENT,
    detail: { source: 'voice-input', listening: true }
  });
  assert.equal(controller.isVoiceInputListening(), true);

  revoke(h.documentRef, { source: 'background-guard', reason: 'pagehide' });
  assert.equal(controller.isEnabled(), false);

  h.documentRef.dispatchEvent({
    type: VOICE_INPUT_STATE_EVENT,
    detail: { source: 'voice-input', listening: false }
  });
  assert.equal(controller.isEnabled(), false, 'voice input ending after revoke cannot auto-resume wake listening');
  assert.equal(h.timers.size, 0);
  controller.destroy();
}

{
  const h = harness();
  const controller = installHandsFree(h.documentRef, h.root);
  controller.enable();
  assert.equal(h.recognizers.length, 1);

  h.documentRef.hidden = true;
  h.documentRef.dispatchEvent({ type: 'visibilitychange' });
  assert.equal(controller.isEnabled(), true, 'runtime visibility handler alone pauses without revoking consent');
  assert.equal(h.recognizers[0].abortCount, 1);

  revoke(h.documentRef, { source: 'background-guard', reason: 'hidden' });
  assert.equal(controller.isEnabled(), false, 'guard revoke closes the consent session after pause');

  h.documentRef.hidden = false;
  h.documentRef.dispatchEvent({ type: 'visibilitychange' });
  assert.equal(controller.isEnabled(), false);
  assert.equal(h.timers.size, 0, 'visibility return after revoke cannot schedule restart');
  controller.destroy();
}

{
  const h = harness();
  const controller = installHandsFree(h.documentRef, h.root);
  controller.enable();
  const firstRecognizer = h.recognizers[0];

  revoke(h.documentRef, { source: 'unknown', reason: 'anything', enable: true });
  revoke(h.documentRef, { requestedState: 'enabled' });
  revoke(h.documentRef, null);

  assert.equal(controller.isEnabled(), false, 'repeated or malformed revoke payloads remain monotonic');
  assert.equal(firstRecognizer.abortCount, 1, 'idempotent revoke cannot repeatedly manipulate old recognizer');
  assert.equal(h.timers.size, 0);
  controller.destroy();
}

console.log('hands-free revoke race tests passed');