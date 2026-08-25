import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { installHandsFree } = require('../public/hands-free.js');
const {
  MICROPHONE_DEVICE_REASON,
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

function createHarness({ devices = [{ kind: 'audioinput' }] } = {}) {
  const documentRef = new FakeTarget();
  const root = new FakeTarget();
  const toggle = element({ attrs: { 'aria-pressed': 'false' } });
  const indicator = element({ hidden: true });
  const micButton = element();
  const input = element();
  const toast = element();
  toast.classList.add('hidden');

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

  const permissionStatus = new FakeTarget();
  permissionStatus.state = 'granted';
  const mediaDevices = new FakeTarget();
  mediaDevices.devices = devices;
  mediaDevices.calls = 0;
  mediaDevices.enumerateDevices = async () => {
    mediaDevices.calls += 1;
    return mediaDevices.devices;
  };
  mediaDevices.setDevices = (next) => {
    mediaDevices.devices = next;
    mediaDevices.dispatch('devicechange');
  };
  root.navigator = {
    language: 'tr-TR',
    permissions: { query: async () => permissionStatus },
    mediaDevices
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

  return { documentRef, indicator, mediaDevices, recognitionInstances, root, timers, toast, toggle };
}

{
  const h = createHarness();
  const runtime = installHandsFree(h.documentRef, h.root);
  const guard = installHandsFreeBackgroundGuard(h.documentRef, h.root);
  await flush();
  assert.equal(h.mediaDevices.calls, 0, 'guard installation does not enumerate while hands-free is inactive');

  runtime.enable();
  assert.equal(runtime.isEnabled(), true);
  assert.equal(runtime.isListening(), true);
  assert.equal(h.recognitionInstances.length, 1);
  assert.equal(h.timers.size, 1);

  h.mediaDevices.setDevices([]);
  await flush();
  assert.equal(runtime.isEnabled(), false, 'losing the final microphone disables canonical runtime state');
  assert.equal(runtime.isListening(), false);
  assert.equal(h.recognitionInstances[0].aborted, true, 'active recognition is aborted immediately');
  assert.equal(h.timers.size, 0, 'device-loss revoke clears the session timer/restart paths');
  assert.equal(h.toggle.getAttribute('aria-pressed'), 'false');
  assert.equal(h.toggle.getAttribute(REVOKED_ATTR), MICROPHONE_DEVICE_REASON);
  assert.equal(guard.getLastReason(), MICROPHONE_DEVICE_REASON);
  assert.equal(h.toggle.clickCount, 0, 'device loss never synthesizes consent UI interaction');
  guard.destroy();
  runtime.destroy();
}

{
  const h = createHarness();
  const runtime = installHandsFree(h.documentRef, h.root);
  const guard = installHandsFreeBackgroundGuard(h.documentRef, h.root);
  await flush();
  runtime.enable();
  h.mediaDevices.setDevices([{ kind: 'audioinput' }, { kind: 'videoinput' }]);
  await flush();
  assert.equal(runtime.isEnabled(), true, 'devicechange with an available microphone is non-terminal');
  assert.equal(runtime.isListening(), true);
  assert.equal(h.recognitionInstances[0].aborted, false);
  assert.equal(guard.getMicrophoneDeviceAvailability(), 'available');
  guard.destroy();
  runtime.disable();
  runtime.destroy();
}

{
  const h = createHarness();
  const runtime = installHandsFree(h.documentRef, h.root);
  const guard = installHandsFreeBackgroundGuard(h.documentRef, h.root);
  await flush();
  runtime.enable();
  h.mediaDevices.setDevices([]);
  await flush();
  assert.equal(runtime.isEnabled(), false);
  const instanceCount = h.recognitionInstances.length;

  h.mediaDevices.setDevices([{ kind: 'audioinput' }]);
  await flush();
  assert.equal(runtime.isEnabled(), false, 'microphone restoration cannot auto-resume hands-free');
  assert.equal(h.recognitionInstances.length, instanceCount, 'no recognizer is created without fresh user enable');

  runtime.enable();
  assert.equal(runtime.isEnabled(), true, 'the existing explicit enable path remains available after recovery');
  assert.equal(h.recognitionInstances.length, instanceCount + 1);
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
  assert.equal(h.mediaDevices.listenerCount('devicechange'), 0);

  h.mediaDevices.setDevices([]);
  await flush();
  assert.equal(runtime.isEnabled(), true, 'destroyed guard cannot retain authority over active runtime');
  assert.equal(h.recognitionInstances[0].aborted, false);
  runtime.disable();
  runtime.destroy();
}

{
  const h = createHarness();
  const runtime = installHandsFree(h.documentRef, h.root);
  const guard = installHandsFreeBackgroundGuard(h.documentRef, h.root);
  await flush();
  runtime.enable();
  runtime.disable();
  const callsBefore = h.mediaDevices.calls;
  h.mediaDevices.setDevices([]);
  await flush();
  assert.equal(h.mediaDevices.calls, callsBefore, 'explicit user disable prevents later hardware probing');
  assert.equal(h.toggle.clickCount, 0);
  guard.destroy();
  runtime.destroy();
}

console.log('hands-free microphone device integration tests passed');