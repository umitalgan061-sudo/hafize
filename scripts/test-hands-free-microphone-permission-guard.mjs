import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  HANDS_FREE_REVOKE_EVENT,
  MICROPHONE_PERMISSION_REASON,
  REVOKED_ATTR,
  installHandsFreeBackgroundGuard,
  normalizePermissionState
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
    const entries = [...(this.listeners.get(event.type) || [])];
    for (const entry of entries.filter((item) => item.capture)) entry.listener(event);
    for (const entry of entries.filter((item) => !item.capture)) entry.listener(event);
    return true;
  }
  dispatch(type, detail) { return this.dispatchEvent({ type, detail }); }
  listenerCount(type) { return (this.listeners.get(type) || []).length; }
}

class FakePermissionStatus extends FakeTarget {
  constructor(state) {
    super();
    this.state = state;
  }
  setState(next) {
    this.state = next;
    this.dispatch('change');
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

function createHarness({ enabled = false, permissionState = 'granted', queryError = null } = {}) {
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

  const status = new FakePermissionStatus(permissionState);
  const queries = [];
  root.navigator = {
    permissions: {
      async query(descriptor) {
        queries.push(descriptor);
        if (queryError) throw queryError;
        return status;
      }
    }
  };

  const revokeEvents = [];
  documentRef.addEventListener(HANDS_FREE_REVOKE_EVENT, (event) => {
    revokeEvents.push(event);
    attrs.set('aria-pressed', 'false');
  });

  return { attrs, documentRef, queries, revokeEvents, root, status, toast, toggle };
}

assert.equal(normalizePermissionState('granted'), 'granted');
assert.equal(normalizePermissionState('prompt'), 'prompt');
assert.equal(normalizePermissionState('denied'), 'denied');
assert.equal(normalizePermissionState('GRANTED'), 'unknown');
assert.equal(normalizePermissionState(undefined), 'unknown');

{
  const harness = createHarness({ enabled: true, permissionState: 'granted' });
  const guard = installHandsFreeBackgroundGuard(harness.documentRef, harness.root);
  await flush();
  assert.deepEqual(harness.queries, [{ name: 'microphone' }], 'only the microphone permission may be queried');
  assert.equal(guard.getMicrophonePermissionState(), 'granted');
  assert.equal(harness.status.listenerCount('change'), 1);
  assert.equal(harness.revokeEvents.length, 0);

  harness.status.setState('denied');
  assert.equal(harness.revokeEvents.length, 1);
  assert.equal(harness.revokeEvents[0].detail.source, 'hands-free-background-guard');
  assert.equal(harness.revokeEvents[0].detail.reason, MICROPHONE_PERMISSION_REASON);
  assert.equal(guard.getLastReason(), MICROPHONE_PERMISSION_REASON);
  assert.equal(harness.toggle.getAttribute(REVOKED_ATTR), MICROPHONE_PERMISSION_REASON);
  assert.equal(harness.toggle.getAttribute('aria-pressed'), 'false');
  assert.equal(guard.hasPendingNotice(), true);

  guard.destroy();
  assert.equal(harness.status.listenerCount('change'), 0, 'destroy must release PermissionStatus listener');
}

{
  const harness = createHarness({ enabled: true, permissionState: 'prompt' });
  const guard = installHandsFreeBackgroundGuard(harness.documentRef, harness.root);
  await flush();
  assert.equal(harness.revokeEvents.length, 1, 'an active session cannot remain trusted when permission returns to prompt');
  assert.equal(guard.getLastReason(), MICROPHONE_PERMISSION_REASON);
  guard.destroy();
}

{
  const harness = createHarness({ enabled: true, permissionState: 'denied' });
  const guard = installHandsFreeBackgroundGuard(harness.documentRef, harness.root);
  await flush();
  assert.equal(harness.revokeEvents.length, 1, 'an already withdrawn permission must revoke after async query resolves');
  assert.equal(guard.getMicrophonePermissionState(), 'denied');
  guard.destroy();
}

{
  const harness = createHarness({ enabled: false, permissionState: 'denied' });
  const guard = installHandsFreeBackgroundGuard(harness.documentRef, harness.root);
  await flush();
  assert.equal(harness.revokeEvents.length, 0, 'inactive hands-free must not manufacture a revocation');
  assert.equal(guard.isRevoked(), false);
  harness.status.setState('prompt');
  assert.equal(harness.revokeEvents.length, 0);
  guard.destroy();
}

{
  const harness = createHarness({ enabled: true, permissionState: 'granted' });
  const guard = installHandsFreeBackgroundGuard(harness.documentRef, harness.root);
  await flush();
  harness.status.setState('granted');
  assert.equal(harness.revokeEvents.length, 0, 'granted-to-granted notifications are harmless');
  guard.destroy();
}

{
  const harness = createHarness({ enabled: true, permissionState: 'granted' });
  const guard = installHandsFreeBackgroundGuard(harness.documentRef, harness.root);
  await flush();
  harness.status.setState('mystery');
  assert.equal(guard.getMicrophonePermissionState(), 'unknown');
  assert.equal(harness.revokeEvents.length, 0, 'unknown browser extensions must not be treated as an approval signal or synthetic denial');
  guard.destroy();
}

{
  const harness = createHarness({ enabled: true, queryError: new Error('unsupported descriptor') });
  const guard = installHandsFreeBackgroundGuard(harness.documentRef, harness.root);
  await flush();
  assert.equal(guard.getMicrophonePermissionState(), 'unavailable');
  assert.equal(harness.revokeEvents.length, 0, 'Permissions API absence/failure must not fake a state transition');
  guard.destroy();
}

{
  const harness = createHarness({ enabled: true });
  delete harness.root.navigator.permissions;
  const guard = installHandsFreeBackgroundGuard(harness.documentRef, harness.root);
  await flush();
  assert.equal(guard.getMicrophonePermissionState(), 'unavailable');
  assert.equal(harness.revokeEvents.length, 0, 'older browsers remain protected by existing SpeechRecognition terminal errors');
  guard.destroy();
}

{
  const harness = createHarness({ enabled: false, permissionState: 'granted' });
  const guard = installHandsFreeBackgroundGuard(harness.documentRef, harness.root);
  await flush();
  const oldStatus = harness.status;
  const replacement = new FakePermissionStatus('granted');
  harness.root.navigator.permissions.query = async () => replacement;
  assert.equal(await guard.refreshMicrophonePermission(), true);
  assert.equal(oldStatus.listenerCount('change'), 0, 'refresh must detach the old status object');
  assert.equal(replacement.listenerCount('change'), 1);
  assert.equal(guard.getMicrophonePermissionState(), 'granted');
  guard.destroy();
  assert.equal(replacement.listenerCount('change'), 0);
}

{
  const harness = createHarness({ enabled: true, permissionState: 'granted' });
  let resolveQuery;
  harness.root.navigator.permissions.query = () => new Promise((resolve) => { resolveQuery = resolve; });
  const guard = installHandsFreeBackgroundGuard(harness.documentRef, harness.root);
  guard.destroy();
  resolveQuery(harness.status);
  await flush();
  assert.equal(harness.status.listenerCount('change'), 0, 'late permission results cannot resurrect a destroyed guard');
  assert.equal(guard.getMicrophonePermissionState(), 'unavailable');
  assert.equal(harness.revokeEvents.length, 0);
}

{
  const harness = createHarness({ enabled: true, permissionState: 'granted' });
  const guard = installHandsFreeBackgroundGuard(harness.documentRef, harness.root);
  await flush();
  harness.status.setState('denied');
  harness.documentRef.hidden = false;
  assert.equal(guard.announce(), true);
  assert.equal(harness.toast.classList.contains('hidden'), false);
  assert.match(harness.toast.textContent, /mikrofon izni/i);
  guard.destroy();
}

console.log('hands-free microphone permission guard tests passed');