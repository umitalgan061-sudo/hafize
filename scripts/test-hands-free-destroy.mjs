import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { installHandsFree } = require('../public/hands-free.js');
let starts = 0;
let aborts = 0;
class Recognition {
  start() { starts += 1; this.onstart?.(); }
  abort() { aborts += 1; this.onend?.(); }
  stop() { this.onend?.(); }
}
const timers = new Map();
let timerId = 0;
function setTimeoutFake(callback) {
  const id = ++timerId;
  timers.set(id, callback);
  return id;
}
function clearTimeoutFake(id) { timers.delete(id); }
function element() {
  return {
    disabled: false,
    hidden: false,
    textContent: '',
    classList: { remove() {} },
    setAttribute() {},
    addEventListener() {},
    removeEventListener() {},
    click() {}
  };
}
const toggle = element();
const indicator = element();
const mic = element();
const input = element();
const toast = element();
const nodes = new Map([
  ['#handsFreeToggle', toggle],
  ['#handsFreeIndicator', indicator],
  ['#micBtn', mic],
  ['#messageInput', input],
  ['#toast', toast]
]);
const documentRef = {
  hidden: false,
  documentElement: { lang: 'tr-TR' },
  querySelector: (selector) => nodes.get(selector) || null,
  addEventListener() {},
  removeEventListener() {}
};
class Observer { observe() {} disconnect() {} }
const root = {
  SpeechRecognition: Recognition,
  MutationObserver: Observer,
  navigator: { language: 'tr-TR' },
  localStorage: { setItem() {}, removeItem() {} },
  setTimeout: setTimeoutFake,
  clearTimeout: clearTimeoutFake
};
const api = installHandsFree(documentRef, root);
api.enable();
assert.equal(starts, 1);
assert.equal(api.isListening(), true);
api.destroy();
assert.equal(aborts, 1);
assert.equal(api.isEnabled(), false);
assert.equal(api.isListening(), false);
assert.equal(timers.size, 0, 'destroy must not schedule wake recognition again');
api.enable();
assert.equal(starts, 1, 'destroyed instance must not be reactivated');
console.log('hands-free destroy lifecycle tests passed');
