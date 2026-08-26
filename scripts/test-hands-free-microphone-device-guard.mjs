import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  HANDS_FREE_REVOKE_EVENT,
  MICROPHONE_DEVICE_REASON,
  REVOKED_ATTR,
  hasAudioInput,
  installHandsFreeBackgroundGuard
} = require('../public/hands-free-background-guard.js');

class FakeTarget {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, listener, capture = false) {
    const entries = this.listeners.get(type) || [];
    entries.push({ listener, capture: Boolean(capture) });
    this.listeners.set(type, entries);
  }
  removeEventListener(type, listener, capture = false) {
    const entries = this.listeners.get(type) || [];
    this.listeners.set(type, entries.filter((entry) => entry.listener !== listener || entry.capture !== Boolean(capture)));
  }
  dispatchEvent(event) {
    for (const entry of [...(this.listeners.get(event.type) || [])]) entry.listener(event);
    return true;
  }
  dispatch(type, detail) { return this.dispatchEvent({ type, detail }); }
  listenerCount(type) { return (this.listeners.get(type) || []).length; }
}

class FakePermissionStatus extends FakeTarget {
  constructor(state = 'granted') {
    super();
    this.state = state;
  }
}

class FakeMediaDevices extends FakeTarget {
  constructor(devices = [{ kind: 'audioinput' }]) {
    super();
    this.devices = devices;
    this.calls = 0;
    this.error = null;
  }
  async enumerateDevices() {
    this.calls += 1;
    if (this.error) throw this.error;
    return this.devices;
  }
  setDevices(devices) {
    this.devices = devices;
    this.dispatch('devicechange');
  }
}

class FakeClassList {
  constructor() { this.values = new Set(['hidden']); }
  remove(value) { this.values.delete(value); }
  contains(value) { return this.values.has(value); }
}

function flush() {
  return new Promise((resolve) => setImmediate(resolve));
}

function createHarness({ enabled = true, devices = [{ kind: 'audioinput' }], includeMediaDevices = true } = {}) {
  const documentRef = new FakeTarget();
  const root = new FakeTarget();
  const attrs = new Map([['aria-pressed', String(enabled)]]);
  const toast = { textContent: '', classList: new FakeClassList() };
  const toggle = {
    getAttribute(name) { return attrs.has(name) ? attrs.get(name) : null; },
    setAttribute(name, value) { attrs.set(name, String(value)); },
    removeAttribute(name) { attrs.delete(name); },
    hasAttribute(name) { return attrs.has(name); }
  };
  documentRef.hidden = false;
  documentRef.querySelector = (selector) => ({ '#handsFreeToggle': toggle, '#toast': toast })[selector] || null;

  class FakeCustomEvent {
    constructor(type, options = {}) { this.type = type; this.detail = options.detail; }
  }
  root.CustomEvent = FakeCustomEvent;

  const permissionStatus = new FakePermissionStatus('granted');
  const mediaDevices = new FakeMediaDevices(devices);
  root.navigator = {
    permissions: { query: async () => permissionStatus }
  };
  if (includeMediaDevices) root.navigator.mediaDevices = mediaDevices;

  const revokeEvents = [];
  documentRef.addEventListener(HANDS_FREE_REVOKE_EVENT, (event) => {
    revokeEvents.push(event);
    attrs.set('aria-pressed', 'false');
  });

  return { attrs, documentRef, mediaDevices, permissionStatus, revokeEvents, root, toast, toggle };
}

assert.equal(hasAudioInput([{ kind: 'audioinput' }]), true);
assert.equal(hasAudioInput([{ kind: 'videoinput' }, { kind: 'audiooutput' }]), false);
assert.equal(hasAudioInput([]), false);
assert.equal(hasAudioInput(null), null);
assert.equal(hasAudioInput({ length: 0 }), null);
assert.equal(hasAudioInput([{ kind: 'AUDIOINPUT' }]), false, 'device kind matching is exact and schema-bound');

{
  const harness = createHarness();
  const guard = installHandsFreeBackgroundGuard(harness.documentRef, harness.root);
  await flush();
  assert.equal(harness.mediaDevices.listenerCount('devicechange'), 1);
  assert.equal(harness.mediaDevices.calls, 1, 'active hands-free checks current device availability once at install');
  assert.equal(guard.getMicrophoneDeviceAvailability(), 'available');
  assert.equal(harness.revokeEvents.length, 0);
  guard.destroy();
}

{
  const harness = createHarness({ devices: [] });
  const guard = installHandsFreeBackgroundGuard(harness.documentRef, harness.root);
  await flush();
  assert.equal(harness.revokeEvents.length, 1, 'active hands-free must close if no audio input exists');
  assert.equal(harness.revokeEvents[0].detail.reason, MICROPHONE_DEVICE_REASON);
  assert.equal(harness.revokeEvents[0].detail.source, 'hands-free-background-guard');
  assert.equal(guard.getLastReason(), MICROPHONE_DEVICE_REASON);
  assert.equal(guard.getMicrophoneDeviceAvailability(), 'missing');
  assert.equal(harness.toggle.getAttribute(REVOKED_ATTR), MICROPHONE_DEVICE_REASON);
  assert.equal(harness.toggle.getAttribute('aria-pressed'), 'false');
  assert.equal(guard.hasPendingNotice(), false, 'visible device loss is announced immediately');
  assert.equal(harness.toast.classList.contains('hidden'), false);
  assert.match(harness.toast.textContent, /kullanılabilir mikrofon/i);
  guard.destroy();
}

{
  const harness = createHarness();
  const guard = installHandsFreeBackgroundGuard(harness.documentRef, harness.root);
  await flush();
  harness.mediaDevices.setDevices([{ kind: 'audiooutput' }, { kind: 'videoinput' }]);
  await flush();
  assert.equal(harness.revokeEvents.length, 1, 'devicechange that removes every microphone revokes the session');
  assert.equal(harness.revokeEvents[0].detail.reason, MICROPHONE_DEVICE_REASON);
  assert.equal(guard.getMicrophoneDeviceAvailability(), 'missing');
  assert.equal(guard.hasPendingNotice(), false);
  assert.equal(harness.toast.classList.contains('hidden'), false, 'visible devicechange surfaces the revocation notice');
  guard.destroy();
}

{
  const harness = createHarness({ enabled: false, devices: [] });
  const guard = installHandsFreeBackgroundGuard(harness.documentRef, harness.root);
  await flush();
  assert.equal(harness.mediaDevices.calls, 0, 'inactive hands-free does not enumerate hardware at install');
  assert.equal(guard.getMicrophoneDeviceAvailability(), 'unavailable');
  harness.mediaDevices.dispatch('devicechange');
  await flush();
  assert.equal(harness.mediaDevices.calls, 0, 'inactive hands-free ignores devicechange without probing devices');
  assert.equal(harness.revokeEvents.length, 0);
  guard.destroy();
}

{
  const harness = createHarness();
  const guard = installHandsFreeBackgroundGuard(harness.documentRef, harness.root);
  await flush();
  harness.mediaDevices.setDevices([
    { kind: 'audioinput', label: 'Private microphone name', deviceId: 'secret-device-id', groupId: 'secret-group-id' },
    { kind: 'videoinput', label: 'Private camera name', deviceId: 'camera-id' }
  ]);
  await flush();
  assert.equal(guard.getMicrophoneDeviceAvailability(), 'available');
  assert.equal(harness.revokeEvents.length, 0);
  assert.equal(Object.prototype.hasOwnProperty.call(guard, 'devices'), false, 'controller does not expose device inventory');
  guard.destroy();
}

{
  const harness = createHarness();
  const guard = installHandsFreeBackgroundGuard(harness.documentRef, harness.root);
  await flush();
  harness.mediaDevices.error = new Error('enumeration denied by browser');
  harness.mediaDevices.dispatch('devicechange');
  await flush();
  assert.equal(guard.getMicrophoneDeviceAvailability(), 'unavailable');
  assert.equal(harness.revokeEvents.length, 0, 'enumeration failure is not forged into a device-loss signal');
  guard.destroy();
}

{
  const harness = createHarness({ includeMediaDevices: false });
  const guard = installHandsFreeBackgroundGuard(harness.documentRef, harness.root);
  await flush();
  assert.equal(guard.getMicrophoneDeviceAvailability(), 'unavailable');
  assert.equal(await guard.refreshMicrophoneDevices(), false);
  assert.equal(harness.revokeEvents.length, 0, 'unsupported MediaDevices keeps existing recognition/permission fallbacks');
  guard.destroy();
}

{
  const harness = createHarness();
  harness.root.navigator.mediaDevices.addEventListener = undefined;
  const guard = installHandsFreeBackgroundGuard(harness.documentRef, harness.root);
  await flush();
  assert.equal(harness.mediaDevices.calls, 0, 'without devicechange event support no implicit inventory scan is attached');
  assert.equal(await guard.refreshMicrophoneDevices(), true, 'explicit refresh can still check an available microphone');
  assert.equal(guard.getMicrophoneDeviceAvailability(), 'available');
  guard.destroy();
}

{
  const harness = createHarness();
  const guard = installHandsFreeBackgroundGuard(harness.documentRef, harness.root);
  await flush();
  harness.attrs.set('aria-pressed', 'false');
  harness.mediaDevices.setDevices([]);
  await flush();
  assert.equal(harness.revokeEvents.length, 0, 'a hardware change after user disable cannot manufacture a revocation');
  assert.equal(guard.getMicrophoneDeviceAvailability(), 'available', 'inactive device changes do not probe or overwrite last trusted observation');
  guard.destroy();
}

{
  const harness = createHarness();
  const guard = installHandsFreeBackgroundGuard(harness.documentRef, harness.root);
  await flush();
  assert.equal(harness.mediaDevices.listenerCount('devicechange'), 1);
  guard.destroy();
  assert.equal(harness.mediaDevices.listenerCount('devicechange'), 0, 'destroy releases devicechange listener ownership');
  harness.mediaDevices.setDevices([]);
  await flush();
  assert.equal(harness.revokeEvents.length, 0);
  assert.equal(guard.getMicrophoneDeviceAvailability(), 'unavailable');
}

{
  const harness = createHarness({ devices: [] });
  harness.documentRef.hidden = true;
  const guard = installHandsFreeBackgroundGuard(harness.documentRef, harness.root);
  await flush();
  assert.equal(guard.hasPendingNotice(), true, 'hidden device loss defers the visible notice');
  assert.equal(harness.toast.classList.contains('hidden'), true);
  harness.documentRef.hidden = false;
  assert.equal(guard.announce(), true);
  assert.equal(harness.toast.classList.contains('hidden'), false);
  assert.match(harness.toast.textContent, /kullanılabilir mikrofon/i);
  guard.destroy();
}

console.log('hands-free microphone device guard tests passed');