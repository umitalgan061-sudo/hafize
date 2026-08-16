import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const api = require('../public/hands-free.js');

assert.equal(api.SESSION_LIMIT_MS, 30 * 60 * 1000);
assert.equal(api.POST_OUTPUT_COOLDOWN_MS, 1800);
assert.equal(api.containsWakePhrase('Hafize'), true);
assert.equal(api.containsWakePhrase('hey hafize nasılsın'), true);
assert.equal(api.containsWakePhrase('hafizelik'), false);
assert.equal(api.containsWakePhrase('hey uzaylı hafize', 'uzaylı hafize'), true);
assert.equal(api.containsWakePhrase('uzaylı sonra hafize', 'uzaylı hafize'), false);

function eventTarget(initial = {}) {
  const listeners = new Map();
  return Object.assign({
    hidden: false,
    disabled: false,
    value: '',
    textContent: '',
    attributes: new Map(),
    classList: { remove() {}, add() {} },
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(listener);
    },
    removeEventListener(type, listener) {
      const next = (listeners.get(type) || []).filter((item) => item !== listener);
      listeners.set(type, next);
    },
    dispatch(type, detail) {
      for (const listener of [...(listeners.get(type) || [])]) listener({ type, detail });
    },
    click() {
      for (const listener of [...(listeners.get('click') || [])]) listener({ type: 'click' });
    },
    setAttribute(name, value) { this.attributes.set(name, String(value)); },
    getAttribute(name) { return this.attributes.get(name) ?? null; },
    focus() {}
  }, initial);
}

const toggle = eventTarget();
const indicator = eventTarget({ hidden: true });
const mic = eventTarget();
const input = eventTarget();
const toast = eventTarget();
const documentRef = eventTarget({
  hidden: false,
  documentElement: { lang: 'tr-TR' },
  querySelector(selector) {
    return new Map([
      ['#handsFreeToggle', toggle],
      ['#handsFreeIndicator', indicator],
      ['#micBtn', mic],
      ['#messageInput', input],
      ['#toast', toast]
    ]).get(selector) || null;
  }
});

const timers = new Map();
let nextTimer = 1;
class Recognition {
  static instances = [];
  constructor() {
    this.started = false;
    this.stopped = false;
    this.aborted = false;
    Recognition.instances.push(this);
  }
  start() {
    this.started = true;
    this.onstart?.();
  }
  stop() {
    this.stopped = true;
    this.onend?.();
  }
  abort() {
    this.aborted = true;
    this.onend?.();
  }
}
class MutationObserver {
  observe() {}
  disconnect() {}
}
const root = {
  SpeechRecognition: Recognition,
  MutationObserver,
  navigator: { language: 'tr-TR' },
  setTimeout(fn, ms) {
    const id = nextTimer++;
    timers.set(id, { fn, ms });
    return id;
  },
  clearTimeout(id) { timers.delete(id); }
};

function runTimerByDelay(ms) {
  const entry = [...timers.entries()].find(([, timer]) => timer.ms === ms);
  assert.ok(entry, `expected timer ${ms}ms`);
  timers.delete(entry[0]);
  entry[1].fn();
}

const controller = api.installHandsFree(documentRef, root);
assert.ok(controller);
assert.equal(controller.isEnabled(), false);
assert.equal(toggle.getAttribute('aria-pressed'), 'false');

toggle.click();
assert.equal(controller.isEnabled(), true);
assert.equal(controller.isListening(), true);
assert.equal(toggle.getAttribute('aria-pressed'), 'true');
assert.match(toast.textContent, /30 dakika/);
assert.ok([...timers.values()].some((timer) => timer.ms === api.SESSION_LIMIT_MS));

const firstRecognition = Recognition.instances.at(-1);
documentRef.dispatch(api.VOICE_OUTPUT_STATE_EVENT, { source: 'voice-output', speaking: true });
assert.equal(controller.isVoiceOutputSpeaking(), true);
assert.equal(controller.isListening(), false);
assert.equal(firstRecognition.aborted, true);

documentRef.dispatch(api.VOICE_OUTPUT_STATE_EVENT, { source: 'voice-output', speaking: false });
assert.equal(controller.isVoiceOutputSpeaking(), false);
assert.equal(controller.isCoolingDown(), true);
assert.equal(indicator.getAttribute('data-cooling-down'), 'true');
assert.match(indicator.textContent, /Yankı koruması/);
assert.ok([...timers.values()].some((timer) => timer.ms === api.POST_OUTPUT_COOLDOWN_MS));

runTimerByDelay(api.POST_OUTPUT_COOLDOWN_MS);
assert.equal(controller.isCoolingDown(), false);
assert.ok([...timers.values()].some((timer) => timer.ms === 350));
runTimerByDelay(350);
assert.equal(controller.isListening(), true);

runTimerByDelay(api.SESSION_LIMIT_MS);
assert.equal(controller.isEnabled(), false);
assert.equal(controller.isListening(), false);
assert.equal(indicator.hidden, true);
assert.match(toast.textContent, /güvenlik süresi sonunda kapatıldı/);
assert.equal([...timers.values()].some((timer) => timer.ms === api.SESSION_LIMIT_MS), false);

controller.enable();
assert.equal(controller.isEnabled(), true);
documentRef.hidden = true;
documentRef.dispatch('visibilitychange');
assert.equal(controller.isListening(), false);
documentRef.hidden = false;
documentRef.dispatch('visibilitychange');
assert.ok([...timers.values()].some((timer) => timer.ms === 350));

controller.destroy();
assert.equal(controller.isEnabled(), false);
assert.equal(controller.isCoolingDown(), false);
assert.equal(timers.size, 0);

console.log('hands-free session safety tests passed');
