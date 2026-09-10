import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const api = require('../public/hands-free.js');

assert.equal(api.normalizeSpeech(' HAFİZE!!! '), 'hafize');
assert.equal(api.containsWakePhrase('Merhaba Hafize nasılsın'), true);
assert.equal(api.containsWakePhrase('hafızaya kaydet'), false);

function element() {
  const listeners = new Map();
  return {
    hidden: false, disabled: false, textContent: '', value: '', attrs: {}, classList: { remove() {} },
    setAttribute(name, value) { this.attrs[name] = value; },
    addEventListener(type, fn) { listeners.set(type, fn); },
    removeEventListener(type) { listeners.delete(type); },
    click() { this.clicked = (this.clicked || 0) + 1; },
    fire(type) { listeners.get(type)?.({ preventDefault() {} }); }
  };
}

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
    return ({ '#handsFreeToggle': toggle, '#handsFreeIndicator': indicator, '#micBtn': mic, '#messageInput': input, '#toast': toast })[selector] || null;
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

const storage = new Map();
// Zamanlayıcılar iptal edilebilir olmalı: 30 dakikalık oturum sınırı da bir
// timer kullandığı için yalnız kısa vadeli restart timer'ları sayılır.
const timers = [];
let timerId = 0;
const pendingTimerDelays = () => timers.filter((timer) => timer.delayMs !== api.SESSION_LIMIT_MS).map((timer) => timer.delayMs);
function runTimer(delayMs) {
  const index = timers.findIndex((timer) => timer.delayMs === delayMs);
  assert.ok(index >= 0, `bekleyen ${delayMs} ms timer yok`);
  const [timer] = timers.splice(index, 1);
  timer.fn();
}
const root = {
  SpeechRecognition: Recognition,
  navigator: { language: 'tr-TR' },
  localStorage: {
    getItem(key) { return storage.has(key) ? storage.get(key) : null; },
    setItem(key, value) { storage.set(key, value); },
    removeItem(key) { storage.delete(key); }
  },
  setTimeout(fn, delayMs) { timers.push({ id: ++timerId, fn, delayMs }); return timerId; },
  clearTimeout(id) {
    const index = timers.findIndex((timer) => timer.id === id);
    if (index >= 0) timers.splice(index, 1);
  },
  MutationObserver: class { constructor(fn) { this.fn = fn; } observe() {} disconnect() {} }
};

const controller = api.installHandsFree(documentRef, root);
assert.equal(controller.isSupported, true);
assert.equal(controller.isEnabled(), false);
assert.equal(indicator.hidden, true);

toggle.fire('click');
assert.equal(controller.isEnabled(), true);
assert.equal(storage.get(api.STORAGE_KEY), 'on');
assert.equal(recognitions.length, 1);
assert.equal(recognitions[0].continuous, true);
assert.equal(controller.isListening(), true);
assert.equal(indicator.hidden, false);
assert.match(indicator.textContent, /Hafize/);

recognitions[0].onresult?.({ resultIndex: 0, results: [[{ transcript: 'merhaba dünya' }]] });
assert.equal(mic.clicked || 0, 0);
recognitions[0].onresult?.({ resultIndex: 0, results: [[{ transcript: 'Hafize' }]] });
assert.equal(recognitions[0].stopped, true);
assert.equal(mic.clicked, 1);
assert.equal(controller.isListening(), false);
// Uyandırma ifadesinden sonra tanıma durur ve sesli girişe devir için
// handoff timeout'u beklenir; sekme görünürlüğü bu bekleyişi bozmaz.
assert.deepEqual(pendingTimerDelays(), [api.HANDOFF_TIMEOUT_MS]);
docListeners.get('visibilitychange')?.();
assert.deepEqual(pendingTimerDelays(), [api.HANDOFF_TIMEOUT_MS]);

// Devir gerçekleşmezse eller serbest kendi dinlemesine geri döner.
runTimer(api.HANDOFF_TIMEOUT_MS);
assert.deepEqual(pendingTimerDelays(), [api.RESTART_DELAY_MS]);
runTimer(api.RESTART_DELAY_MS);
assert.equal(recognitions.length, 2);
assert.equal(controller.isListening(), true);

documentRef.hidden = true;
docListeners.get('visibilitychange')?.();
assert.equal(recognitions[1].aborted, true);
assert.equal(controller.isListening(), false);

documentRef.hidden = false;
toggle.fire('click');
assert.equal(controller.isEnabled(), false);
assert.equal(storage.has(api.STORAGE_KEY), false);
// Kapatma tercihi de kalıcıdır: yeniden kurulumda mikrofon kendiliğinden açılmaz.
assert.equal(controller.isPreferred(), false);

const unsupportedToggle = element();
const unsupportedDoc = {
  hidden: false,
  documentElement: { lang: 'tr' },
  querySelector(selector) {
    return ({ '#handsFreeToggle': unsupportedToggle, '#handsFreeIndicator': element(), '#micBtn': element(), '#messageInput': element(), '#toast': element() })[selector] || null;
  },
  addEventListener() {}, removeEventListener() {}
};
const unsupported = api.installHandsFree(unsupportedDoc, {});
assert.equal(unsupported.isSupported, false);
assert.equal(unsupportedToggle.disabled, true);

console.log('hands-free tests passed');
