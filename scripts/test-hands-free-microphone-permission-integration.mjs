import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { installHandsFree, HANDS_FREE_REVOKE_EVENT } = require('../public/hands-free.js');
const {
  MICROPHONE_PERMISSION_REASON,
  REVOKED_ATTR,
  installHandsFreeBackgroundGuard
} = require('../public/hands-free-background-guard.js');

class FakeTarget {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, listener, capture = false) {
    const list = this.listeners.get(type) || [];
    list.push({ listener, capture: Boolean(capture) });
    this.listeners.set(type, list);
  }
  removeEventListener(type, listener, capture = false) {
    const list = this.listeners.get(type) || [];
    this.listeners.set(type, list.filter((entry) => entry.listener !== listener || entry.capture !== Boolean(capture)));
  }
  dispatchEvent(event) {
    const list = [...(this.listeners.get(event.type) || [])];
    for (const entry of list.filter((item) => item.capture)) entry.listener(event);
    for (const entry of list.filter((item) => !item.capture)) entry.listener(event);
    return true;
  }
  dispatch(type, detail) { return this.dispatchEvent({ type, detail }); }
  listenerCount(type) { return (this.listeners.get(type) || []).length; }
}

class PermissionStatus extends FakeTarget {
  constructor(state = 'granted') { super(); this.state = state; }
  transition(state) { this.state = state; this.dispatch('change'); }
}

class FakeClassList {
  constructor() { this.values = new Set(); }
  add(value) { this.values.add(value); }
  remove(value) { this.values.delete(value); }
  contains(value) { return this.values.has(value); }
}

function element({ attrs = {}, hidden = false, disabled = false } = {}) {
  const target = new FakeTarget();
  const values = new Map(Object.entries(attrs));
  return Object.assign(target, {
    hidden,
    disabled,
    textContent: '',
    classList: new FakeClassList(),
    clickCount: 0,
    getAttribute(name) { return values.has(name) ? values.get(name) : null; },
    setAttribute(name, value) { values.set(name, String(value)); },
    removeAttribute(name) { values.delete(name); },
    hasAttribute(name) { return values.has(name); },
    click() { this.clickCount += 1; throw new Error('SYNTHETIC_CONSENT_CLICK_FORBIDDEN'); }
  });
}

function flush() { return new Promise((resolve) => setImmediate(resolve)); }

function createHarness({ permissionState = 'granted' } = {}) {
  const documentRef = new FakeTarget();
  const root = new FakeTarget();
  const toggle = element({ attrs: { 'aria-pressed': 'false' } });
  const indicator = element({ hidden: true });
  const micButton = element();
  const input = element();
  const toast = element();
  toast.classList.add('hidden');
  const permissionStatus = new PermissionStatus(permissionState);

  documentRef.hidden = false;
  documentRef.documentElement = { lang: 'tr-TR' };
  documentRef.querySelector = (selector) => ({
    '#handsFreeToggle': toggle,
    '#handsFreeIndicator': indicator,
    '#micBtn': micButton,
    '#messageInput': input,
    '#toast': toast
  })[selector] || null;

  class FakeCustomEvent {
    constructor(type, options = {}) { this.type = type; this.detail = options.detail; }
  }
  root.CustomEvent = FakeCustomEvent;

  const recognitionInstances = [];
  class FakeRecognition {
    constructor() {
      this.started = false;
      this.aborted = false;
      recognitionInstances.push(this);
    }
    start() { this.started = true; this.onstart?.(); }
    abort() { this.aborted = true; }
    stop() {}
  }
  root.SpeechRecognition = FakeRecognition;
  root.navigator = {
    language: 'tr-TR',
    permissions: { query: async ({ name }) => {
      assert.equal(name, 'microphone');
      return permissionStatus;
    } }
  };
  root.MutationObserver = class { observe() {} disconnect() {} };

  const timers = new Map();
  let timerId = 0;
  root.setTimeout = (callback, delay) => {
    const id = ++timerId;
    timers.set(id, { callback, delay });
    return id;
  };
  root.clearTimeout = (id) => timers.delete(id);

  return { documentRef, indicator, input, micButton, permissionStatus, recognitionInstances, root, timers, toast, toggle };
}

{
  const h = createHarness();
  const runtime = installHandsFree(h.documentRef, h.root);
  const guard = installHandsFreeBackgroundGuard(h.documentRef, h.root);
  await flush();

  runtime.enable();
  assert.equal(runtime.isEnabled(), true);
  assert.equal(runtime.isListening(), true);
  assert.equal(h.recognitionInstances.length, 1);
  assert.equal(h.toggle.clickCount, 0);
  assert.equal(h.timers.size, 1, 'only the 30 minute safety timer should remain while listening');

  h.permissionStatus.transition('denied');
  assert.equal(runtime.isEnabled(), false, 'permission withdrawal must disable the canonical runtime state');
  assert.equal(runtime.isListening(), false);
  assert.equal(h.recognitionInstances[0].aborted, true, 'active recognizer must abort immediately');
  assert.equal(h.timers.size, 0, 'permission revoke must clear the session timer and restart paths');
  assert.equal(h.toggle.getAttribute('aria-pressed'), 'false');
  assert.equal(h.toggle.getAttribute(REVOKED_ATTR), MICROPHONE_PERMISSION_REASON);
  assert.equal(guard.getLastReason(), MICROPHONE_PERMISSION_REASON);
  assert.equal(h.toggle.clickCount, 0, 'permission revocation cannot synthesize a user toggle click');

  guard.destroy();
  runtime.destroy();
}

{
  const h = createHarness();
  const runtime = installHandsFree(h.documentRef, h.root);
  const guard = installHandsFreeBackgroundGuard(h.documentRef, h.root);
  await flush();
  runtime.enable();
  h.permissionStatus.transition('prompt');

  assert.equal(runtime.isEnabled(), false, 'reset-to-prompt also requires fresh explicit consent');
  assert.equal(h.recognitionInstances[0].aborted, true);
  assert.equal(guard.hasPendingNotice(), false, 'visible permission revocation should surface its re-consent notice immediately');
  assert.equal(h.toast.classList.contains('hidden'), false, 'visible permission revocation may immediately expose the re-consent notice');
  assert.match(h.toast.textContent, /mikrofon iznini kontrol/i);

  h.permissionStatus.transition('granted');
  assert.equal(runtime.isEnabled(), false, 'restoring browser permission must never auto-enable hands-free');
  assert.equal(h.recognitionInstances.length, 1, 'permission restoration cannot create a recognizer without user consent');

  runtime.enable();
  assert.equal(runtime.isEnabled(), true, 'the existing explicit runtime enable path remains available');
  assert.equal(h.recognitionInstances.length, 2);
  guard.destroy();
  runtime.destroy();
}

{
  const h = createHarness({ permissionState: 'denied' });
  const runtime = installHandsFree(h.documentRef, h.root);
  runtime.enable();
  assert.equal(runtime.isEnabled(), true, 'harness starts active before async permission state resolves');
  const guard = installHandsFreeBackgroundGuard(h.documentRef, h.root);
  await flush();
  assert.equal(runtime.isEnabled(), false, 'already-denied state must fail closed when guard query resolves');
  assert.equal(h.recognitionInstances[0].aborted, true);
  assert.equal(guard.getMicrophonePermissionState(), 'denied');
  guard.destroy();
  runtime.destroy();
}

{
  const h = createHarness();
  const runtime = installHandsFree(h.documentRef, h.root);
  const guard = installHandsFreeBackgroundGuard(h.documentRef, h.root);
  await flush();
  runtime.enable();

  h.documentRef.hidden = true;
  h.documentRef.dispatch('visibilitychange');
  assert.equal(runtime.isEnabled(), false);
  assert.equal(guard.getLastReason(), 'hidden');
  const eventListenersAfterBackground = h.documentRef.listenerCount(HANDS_FREE_REVOKE_EVENT);

  h.permissionStatus.transition('denied');
  assert.equal(guard.getLastReason(), 'hidden', 'a later permission signal must not create a second revoke for an inactive session');
  assert.equal(h.recognitionInstances.length, 1);
  assert.equal(h.toggle.clickCount, 0);
  assert.equal(h.documentRef.listenerCount(HANDS_FREE_REVOKE_EVENT), eventListenersAfterBackground);
  guard.destroy();
  runtime.destroy();
}

{
  const h = createHarness();
  const runtime = installHandsFree(h.documentRef, h.root);
  const guard = installHandsFreeBackgroundGuard(h.documentRef, h.root);
  await flush();
  runtime.enable();
  guard.destroy();
  assert.equal(h.permissionStatus.listenerCount('change'), 0);

  h.permissionStatus.transition('denied');
  assert.equal(runtime.isEnabled(), true, 'destroyed guard cannot retain authority over the runtime');
  assert.equal(h.recognitionInstances[0].aborted, false);
  runtime.disable();
  runtime.destroy();
}

{
  const h = createHarness();
  delete h.root.navigator.permissions;
  const runtime = installHandsFree(h.documentRef, h.root);
  const guard = installHandsFreeBackgroundGuard(h.documentRef, h.root);
  await flush();
  runtime.enable();
  assert.equal(runtime.isEnabled(), true, 'Permissions API unsupported browsers keep the pre-existing runtime path');
  assert.equal(guard.getMicrophonePermissionState(), 'unavailable');

  const recognition = h.recognitionInstances[0];
  recognition.onerror?.({ error: 'not-allowed' });
  assert.equal(runtime.isEnabled(), false, 'terminal SpeechRecognition errors remain the fallback permission boundary');
  assert.equal(recognition.aborted, true);
  guard.destroy();
  runtime.destroy();
}

console.log('hands-free microphone permission integration tests passed');