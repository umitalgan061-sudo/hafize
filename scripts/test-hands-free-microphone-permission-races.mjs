import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  HANDS_FREE_REVOKE_EVENT,
  MICROPHONE_PERMISSION_REASON,
  installHandsFreeBackgroundGuard
} = require('../public/hands-free-background-guard.js');

class Target {
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
    for (const item of list.filter((entry) => entry.capture)) item.listener(event);
    for (const item of list.filter((entry) => !entry.capture)) item.listener(event);
    return true;
  }
  fire(type) { this.dispatchEvent({ type }); }
  count(type) { return (this.listeners.get(type) || []).length; }
}

class Status extends Target {
  constructor(state) { super(); this.state = state; }
  transition(state) { this.state = state; this.fire('change'); }
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, reject, resolve };
}

function flush() { return new Promise((resolve) => setImmediate(resolve)); }

function harness() {
  const documentRef = new Target();
  const root = new Target();
  const attrs = new Map([['aria-pressed', 'true']]);
  const toggle = {
    getAttribute(name) { return attrs.get(name) ?? null; },
    setAttribute(name, value) { attrs.set(name, String(value)); },
    removeAttribute(name) { attrs.delete(name); },
    hasAttribute(name) { return attrs.has(name); }
  };
  documentRef.hidden = false;
  documentRef.querySelector = (selector) => selector === '#handsFreeToggle' ? toggle : null;
  root.CustomEvent = class {
    constructor(type, options = {}) { this.type = type; this.detail = options.detail; }
  };

  const revocations = [];
  documentRef.addEventListener(HANDS_FREE_REVOKE_EVENT, (event) => {
    revocations.push(event.detail);
    attrs.set('aria-pressed', 'false');
  });

  return { attrs, documentRef, revocations, root, toggle };
}

{
  const h = harness();
  const first = deferred();
  const second = deferred();
  let queryCount = 0;
  h.root.navigator = { permissions: { query() { queryCount += 1; return queryCount === 1 ? first.promise : second.promise; } } };

  const guard = installHandsFreeBackgroundGuard(h.documentRef, h.root);
  const refresh = guard.refreshMicrophonePermission();
  const newest = new Status('granted');
  second.resolve(newest);
  assert.equal(await refresh, true);
  assert.equal(guard.getMicrophonePermissionState(), 'granted');
  assert.equal(newest.count('change'), 1);

  const stale = new Status('denied');
  first.resolve(stale);
  await flush();
  assert.equal(stale.count('change'), 0, 'out-of-order stale PermissionStatus cannot regain listener ownership');
  assert.equal(newest.count('change'), 1);
  assert.equal(guard.getMicrophonePermissionState(), 'granted');
  assert.equal(h.revocations.length, 0, 'stale denied result cannot revoke a session after a newer granted result won');

  newest.transition('denied');
  assert.equal(h.revocations.length, 1);
  assert.equal(h.revocations[0].reason, MICROPHONE_PERMISSION_REASON);
  guard.destroy();
}

{
  const h = harness();
  const initial = new Status('granted');
  const delayed = deferred();
  let queryCount = 0;
  h.root.navigator = { permissions: { query() { queryCount += 1; return queryCount === 1 ? Promise.resolve(initial) : delayed.promise; } } };

  const guard = installHandsFreeBackgroundGuard(h.documentRef, h.root);
  await flush();
  assert.equal(initial.count('change'), 1);
  const refresh = guard.refreshMicrophonePermission();
  guard.destroy();
  delayed.resolve(new Status('denied'));
  assert.equal(await refresh, false, 'destroyed guard rejects late refresh ownership');
  assert.equal(initial.count('change'), 0);
  assert.equal(h.revocations.length, 0);
}

{
  const h = harness();
  const first = new Status('granted');
  const second = new Status('granted');
  let current = first;
  h.root.navigator = { permissions: { query: async () => current } };
  const guard = installHandsFreeBackgroundGuard(h.documentRef, h.root);
  await flush();

  current = second;
  assert.equal(await guard.refreshMicrophonePermission(), true);
  assert.equal(first.count('change'), 0);
  assert.equal(second.count('change'), 1);

  first.transition('denied');
  assert.equal(h.revocations.length, 0, 'detached status objects cannot revoke current sessions');
  second.transition('denied');
  assert.equal(h.revocations.length, 1);
  guard.destroy();
}

{
  const h = harness();
  const status = new Status('granted');
  let fail = false;
  h.root.navigator = { permissions: { query: async () => {
    if (fail) throw new Error('permission api transient failure');
    return status;
  } } };
  const guard = installHandsFreeBackgroundGuard(h.documentRef, h.root);
  await flush();
  assert.equal(status.count('change'), 1);

  fail = true;
  assert.equal(await guard.refreshMicrophonePermission(), false);
  assert.equal(guard.getMicrophonePermissionState(), 'unavailable');
  assert.equal(status.count('change'), 1, 'a failed refresh must not silently orphan the last live status listener');
  status.transition('denied');
  assert.equal(h.revocations.length, 1, 'last trusted status remains able to fail closed after a transient refresh failure');
  guard.destroy();
}

{
  const h = harness();
  const status = new Status('granted');
  h.root.navigator = { permissions: { query: async () => status } };
  const guard = installHandsFreeBackgroundGuard(h.documentRef, h.root);
  await flush();

  h.attrs.set('aria-pressed', 'false');
  status.transition('denied');
  assert.equal(h.revocations.length, 0, 'permission events cannot turn an inactive runtime into a side effect');
  h.attrs.set('aria-pressed', 'true');
  status.transition('granted');
  assert.equal(h.revocations.length, 0);
  status.transition('prompt');
  assert.equal(h.revocations.length, 1);
  assert.equal(h.revocations[0].reason, MICROPHONE_PERMISSION_REASON);
  guard.destroy();
}

console.log('hands-free microphone permission race tests passed');