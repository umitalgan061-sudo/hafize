import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../public/network-status.js', import.meta.url), 'utf8');
const module = { exports: {} };
vm.runInNewContext(source, { module, exports: module.exports, globalThis: {} });
const api = module.exports;

function makeRoot() {
  const listeners = new Map();
  return {
    listeners,
    addEventListener(type, fn) { listeners.set(type, fn); },
    removeEventListener(type, fn) { if (listeners.get(type) === fn) listeners.delete(type); }
  };
}

function missingTopbarDocument() {
  return {
    head: { append() {} },
    body: {},
    querySelector() { return null; },
    createElement() { return { setAttribute() {}, dataset: {}, remove() {} }; }
  };
}

const root = makeRoot();
const navigatorRef = { onLine: false };
const timers = new Map();
let nextTimer = 0;
const setTimeoutImpl = (fn, ms) => {
  nextTimer += 1;
  timers.set(nextTimer, { fn, ms });
  return nextTimer;
};
const clearTimeoutImpl = (id) => timers.delete(id);

const unavailable = api.createController({
  rootRef: root,
  documentRef: missingTopbarDocument(),
  navigatorRef,
  setTimeoutImpl,
  clearTimeoutImpl
});
assert.equal(unavailable.mount(), false, 'missing topbar must fail closed');
assert.equal(root.listeners.size, 0, 'failed mount must not leak listeners');

assert.throws(() => api.createController({
  rootRef: {},
  documentRef: missingTopbarDocument(),
  navigatorRef,
  setTimeoutImpl,
  clearTimeoutImpl
}), /INVALID_NETWORK_STATUS_ROOT/);

assert.throws(() => api.createController({
  rootRef: makeRoot(),
  documentRef: missingTopbarDocument(),
  navigatorRef,
  setTimeoutImpl: null,
  clearTimeoutImpl
}), /INVALID_NETWORK_STATUS_TIMER/);

assert.equal(api.mount({
  rootRef: makeRoot(),
  documentRef: missingTopbarDocument(),
  navigatorRef,
  setTimeoutImpl,
  clearTimeoutImpl
}), null, 'public mount must convert invalid DOM into null');

assert.equal(source.includes('location.reload'), false);
assert.equal(source.includes('requestSubmit'), false);
assert.equal(source.includes('.click()'), false);
assert.equal(source.includes('sendBeacon'), false);
assert.equal(source.includes('XMLHttpRequest'), false);
assert.match(source, /clearRestoreTimer\(\)/);
assert.match(source, /removeEventListener\('offline'/);
assert.match(source, /removeEventListener\('online'/);
assert.match(source, /node\?\.remove\?\.\(\)/);

console.log('network status edge-case tests passed');
