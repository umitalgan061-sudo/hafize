import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const voiceOutputApi = require('../public/voice-output.js');
const handsFreeApi = require('../public/hands-free.js');

class Node {
  constructor() {
    this.disabled = false;
    this.hidden = false;
    this.textContent = '';
    this.attrs = new Map();
    this.listeners = new Map();
    this.classList = { remove() {}, toggle() {} };
  }
  setAttribute(name, value) { this.attrs.set(name, String(value)); }
  getAttribute(name) { return this.attrs.get(name) ?? null; }
  addEventListener(type, fn) { this.listeners.set(type, fn); }
  removeEventListener(type) { this.listeners.delete(type); }
  click() { this.listeners.get('click')?.({ preventDefault() {} }); }
}

const nodes = {
  voiceToggle: new Node(),
  voiceCard: new Node(),
  handsFreeToggle: new Node(),
  handsFreeIndicator: new Node(),
  mic: new Node(),
  input: new Node(),
  composer: new Node(),
  messages: new Node(),
  toast: new Node()
};
nodes.messages.querySelectorAll = () => [];
nodes.mic.setAttribute('aria-pressed', 'false');

const documentListeners = new Map();
const documentRef = {
  hidden: false,
  documentElement: { lang: 'tr' },
  querySelector(selector) {
    return ({
      '#voiceOutputToggle': nodes.voiceToggle,
      '.voice-card': nodes.voiceCard,
      '#handsFreeToggle': nodes.handsFreeToggle,
      '#handsFreeIndicator': nodes.handsFreeIndicator,
      '#micBtn': nodes.mic,
      '#messageInput': nodes.input,
      '#composer': nodes.composer,
      '#messages': nodes.messages,
      '#toast': nodes.toast
    })[selector] || null;
  },
  addEventListener(type, fn) {
    const group = documentListeners.get(type) || new Set();
    group.add(fn);
    documentListeners.set(type, group);
  },
  removeEventListener(type, fn) { documentListeners.get(type)?.delete(fn); },
  dispatchEvent(event) {
    for (const fn of documentListeners.get(event.type) || []) fn(event);
    return true;
  }
};

class CustomEvent {
  constructor(type, options = {}) { this.type = type; this.detail = options.detail; }
}
const recognitions = [];
class Recognition {
  constructor() { recognitions.push(this); }
  start() { this.started = true; this.onstart?.(); }
  stop() { this.stopped = true; this.onend?.(); }
  abort() { this.aborted = true; this.onend?.(); }
}
const utterances = [];
const synth = {
  speak(utterance) { utterances.push(utterance); },
  cancel() {},
  getVoices() { return [{ lang: 'tr-TR', name: 'Türkçe' }]; }
};
class Utterance { constructor(text) { this.text = text; } }

const timers = [];
let timerId = 0;
const root = {
  CustomEvent,
  SpeechRecognition: Recognition,
  speechSynthesis: synth,
  SpeechSynthesisUtterance: Utterance,
  navigator: { language: 'tr-TR' },
  localStorage: { getItem() { return null; }, setItem() {} },
  MutationObserver: class { constructor(fn) { this.fn = fn; } observe() {} disconnect() {} },
  setTimeout(fn, ms) { const item = { id: ++timerId, fn, ms, cleared: false }; timers.push(item); return item.id; },
  clearTimeout(id) { const item = timers.find((timer) => timer.id === id); if (item) item.cleared = true; }
};
const pendingRestart = () => timers.find((timer) => !timer.cleared && timer.ms === 350);

const handsFree = handsFreeApi.installHandsFree(documentRef, root);
const voiceOutput = voiceOutputApi.installVoiceOutput(documentRef, root);
handsFree.enable();
assert.equal(handsFree.isListening(), true);
assert.equal(recognitions.length, 1);

voiceOutput.setEnabled(true);
assert.equal(voiceOutput.speak('Hafize sesli yanıt veriyor.'), true);
assert.equal(utterances.length, 1);
assert.equal(handsFree.isVoiceOutputSpeaking(), true);
assert.equal(recognitions[0].aborted, true, 'real voice-output event must abort active wake recognizer');
assert.equal(handsFree.isListening(), false);
assert.equal(pendingRestart(), undefined, 'wake restart must remain blocked for entire TTS utterance');

utterances[0].onend?.();
assert.equal(voiceOutput.isSpeaking(), false);
assert.equal(handsFree.isVoiceOutputSpeaking(), false);
const restart = pendingRestart();
assert.ok(restart, 'TTS completion must schedule bounded wake restart');
restart.cleared = true;
restart.fn();
assert.equal(recognitions.length, 2);
assert.equal(handsFree.isListening(), true);

voiceOutput.speak('Yeni yanıt.');
assert.equal(recognitions[1].aborted, true);
voiceOutput.cancel();
assert.equal(handsFree.isVoiceOutputSpeaking(), false);
assert.ok(pendingRestart(), 'explicit TTS cancel must also restore wake listening through bounded restart');

handsFree.destroy();
voiceOutput.destroy();
console.log('voice echo integration passed: TTS suspends and safely restores wake recognition');
