import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const cancel = require('../public/schedule-cancel.js');

assert.equal(cancel.AUTO_MOUNT_TIMEOUT_MS, 10_000);

function createRoot() {
  const observers = [];
  const timers = new Map();
  let timerId = 0;
  class FakeObserver {
    constructor(callback) { this.callback = callback; this.disconnected = false; observers.push(this); }
    observe(target, options) { this.target = target; this.options = options; }
    disconnect() { this.disconnected = true; }
  }
  return {
    MutationObserver: FakeObserver,
    fetch: async () => { throw new Error('network not expected'); },
    confirm: () => false,
    setTimeout(callback, delay) { timerId += 1; timers.set(timerId, { callback, delay }); return timerId; },
    clearTimeout(id) { timers.delete(id); },
    observers,
    timers
  };
}

const waitingRoot = createRoot();
const waitingDocument = {
  body: {},
  querySelector(selector) {
    if (selector === '#scheduleListCard') return null;
    if (selector === '[data-hafize-schedule-cancel-mounted]') return null;
    return null;
  }
};
const waiting = cancel.autoMount(waitingDocument, waitingRoot);
assert.ok(waiting, 'autoMount should wait when list is not available yet');
assert.equal(waiting.getController(), null);
assert.equal(waitingRoot.observers.length, 1);
assert.deepEqual(waitingRoot.observers[0].options, { childList: true, subtree: true });
assert.equal(waitingRoot.timers.size, 1);
const timer = [...waitingRoot.timers.values()][0];
assert.equal(timer.delay, 10_000);
timer.callback();
assert.equal(waitingRoot.observers[0].disconnected, true, 'timeout must stop observer');
assert.equal(waitingRoot.timers.size, 0, 'timeout must clean timer bookkeeping');
assert.equal(waiting.destroy(), true);

const noObserverRoot = { fetch() {}, confirm() {} };
assert.equal(cancel.autoMount(waitingDocument, noObserverRoot), null, 'unsupported observer must fail closed');
assert.equal(cancel.autoMount(null, waitingRoot), null);
assert.equal(cancel.autoMount(waitingDocument, null), null);

const alreadyMountedDocument = {
  body: {},
  querySelector(selector) {
    if (selector === '#scheduleListCard') return null;
    if (selector === '[data-hafize-schedule-cancel-mounted]') return {};
    return null;
  }
};
assert.equal(cancel.autoMount(alreadyMountedDocument, waitingRoot), null, 'duplicate mount waiter must not be installed');

console.log('schedule cancel lifecycle tests passed');
