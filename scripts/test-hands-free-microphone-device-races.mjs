import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  HANDS_FREE_REVOKE_EVENT,
  MICROPHONE_DEVICE_REASON,
  installHandsFreeBackgroundGuard
} = require('../public/hands-free-background-guard.js');

class FakeTarget {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, listener) {
    const list = this.listeners.get(type) || [];
    list.push(listener);
    this.listeners.set(type, list);
  }
  removeEventListener(type, listener) {
    const list = this.listeners.get(type) || [];
    this.listeners.set(type, list.filter((entry) => entry !== listener));
  }
  dispatchEvent(event) {
    for (const listener of [...(this.listeners.get(event.type) || [])]) listener(event);
    return true;
  }
  dispatch(type) { return this.dispatchEvent({ type }); }
  listenerCount(type) { return (this.listeners.get(type) || []).length; }
}

class FakeClassList { remove() {} }

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, reject, resolve };
}

function flush() {
  return new Promise((resolve) => setImmediate(resolve));
}

function createHarness() {
  const documentRef = new FakeTarget();
  const root = new FakeTarget();
  const attrs = new Map([['aria-pressed', 'true']]);
  const toggle = {
    getAttribute(name) { return attrs.get(name) ?? null; },
    setAttribute(name, value) { attrs.set(name, String(value)); },
    removeAttribute(name) { attrs.delete(name); },
    hasAttribute(name) { return attrs.has(name); }
  };
  const toast = { textContent: '', classList: new FakeClassList() };
  documentRef.hidden = false;
  documentRef.querySelector = (selector) => ({ '#handsFreeToggle': toggle, '#toast': toast })[selector] || null;
  class FakeCustomEvent {
    constructor(type, options = {}) { this.type = type; this.detail = options.detail; }
  }
  root.CustomEvent = FakeCustomEvent;

  const permissionStatus = new FakeTarget();
  permissionStatus.state = 'granted';
  const mediaDevices = new FakeTarget();
  const queue = [];
  mediaDevices.enumerateDevices = () => {
    if (!queue.length) return Promise.resolve([{ kind: 'audioinput' }]);
    return queue.shift().promise;
  };
  root.navigator = {
    permissions: { query: async () => permissionStatus },
    mediaDevices
  };

  const revokeEvents = [];
  documentRef.addEventListener(HANDS_FREE_REVOKE_EVENT, (event) => {
    revokeEvents.push(event);
    attrs.set('aria-pressed', 'false');
  });
  return { attrs, documentRef, mediaDevices, queue, revokeEvents, root };
}

{
  const harness = createHarness();
  const first = deferred();
  const second = deferred();
  harness.queue.push(first, second);
  const guard = installHandsFreeBackgroundGuard(harness.documentRef, harness.root);
  harness.mediaDevices.dispatch('devicechange');
  second.resolve([{ kind: 'audioinput' }]);
  await flush();
  first.resolve([]);
  await flush();
  assert.equal(harness.revokeEvents.length, 0, 'older missing-device result cannot override a newer available-device result');
  assert.equal(guard.getMicrophoneDeviceAvailability(), 'available');
  guard.destroy();
}

{
  const harness = createHarness();
  const first = deferred();
  const second = deferred();
  harness.queue.push(first, second);
  const guard = installHandsFreeBackgroundGuard(harness.documentRef, harness.root);
  harness.mediaDevices.dispatch('devicechange');
  second.resolve([]);
  await flush();
  assert.equal(harness.revokeEvents.length, 1);
  assert.equal(harness.revokeEvents[0].detail.reason, MICROPHONE_DEVICE_REASON);
  first.resolve([{ kind: 'audioinput' }]);
  await flush();
  assert.equal(guard.getMicrophoneDeviceAvailability(), 'missing', 'stale availability cannot erase terminal device-loss observation');
  guard.destroy();
}

{
  const harness = createHarness();
  const pending = deferred();
  harness.queue.push(pending);
  const guard = installHandsFreeBackgroundGuard(harness.documentRef, harness.root);
  guard.destroy();
  pending.resolve([]);
  await flush();
  assert.equal(harness.revokeEvents.length, 0, 'late enumeration cannot revoke a destroyed guard');
  assert.equal(guard.getMicrophoneDeviceAvailability(), 'unavailable');
  assert.equal(harness.mediaDevices.listenerCount('devicechange'), 0);
}

{
  const harness = createHarness();
  const pending = deferred();
  harness.queue.push(pending);
  const guard = installHandsFreeBackgroundGuard(harness.documentRef, harness.root);
  harness.attrs.set('aria-pressed', 'false');
  pending.resolve([]);
  await flush();
  assert.equal(harness.revokeEvents.length, 0, 'user disable wins a race against a pending missing-device result');
  assert.equal(guard.getMicrophoneDeviceAvailability(), 'missing', 'observation may finish but cannot create a side effect after disable');
  guard.destroy();
}

{
  const harness = createHarness();
  const pending = deferred();
  harness.queue.push(pending);
  const guard = installHandsFreeBackgroundGuard(harness.documentRef, harness.root);
  pending.reject(new Error('browser enumeration failure'));
  await flush();
  assert.equal(harness.revokeEvents.length, 0);
  assert.equal(guard.getMicrophoneDeviceAvailability(), 'unavailable');
  guard.destroy();
}

{
  const harness = createHarness();
  const installScan = deferred();
  const refreshScan = deferred();
  harness.queue.push(installScan, refreshScan);
  const guard = installHandsFreeBackgroundGuard(harness.documentRef, harness.root);
  const refreshPromise = guard.refreshMicrophoneDevices();
  refreshScan.resolve([{ kind: 'audioinput' }]);
  assert.equal(await refreshPromise, true);
  installScan.reject(new Error('stale install failure'));
  await flush();
  assert.equal(guard.getMicrophoneDeviceAvailability(), 'available', 'stale failure cannot downgrade a newer successful refresh');
  assert.equal(harness.revokeEvents.length, 0);
  guard.destroy();
}

{
  const harness = createHarness();
  const pending = deferred();
  harness.queue.push(pending);
  const guard = installHandsFreeBackgroundGuard(harness.documentRef, harness.root);
  harness.mediaDevices.dispatch('devicechange');
  harness.mediaDevices.dispatch('devicechange');
  assert.equal(harness.queue.length, 0, 'devicechange can schedule independent checks without sharing mutable result buffers');
  pending.resolve([{ kind: 'audioinput' }]);
  await flush();
  assert.equal(harness.revokeEvents.length, 0);
  guard.destroy();
}

console.log('hands-free microphone device race tests passed');