import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const api = require('../public/schedule-retry-policy.js');

function waitingFixture({ observeError = false, timerError = false } = {}) {
  const body = { nodeType: 1 };
  let observerInstance = null;
  let timeoutCallback = null;
  let timeoutDelay = null;
  let clearedTimer = null;

  class FakeObserver {
    constructor(callback) {
      this.callback = callback;
      this.disconnectCount = 0;
      observerInstance = this;
    }
    observe(target, options) {
      assert.equal(target, body);
      assert.deepEqual(options, { childList: true, subtree: true });
      if (observeError) throw new Error('observe failed');
    }
    disconnect() { this.disconnectCount += 1; }
  }

  const documentRef = {
    body,
    querySelector(selector) {
      if (selector === '#scheduleListCard') return null;
      if (selector === '[data-hafize-schedule-retry-policy-mounted]') return null;
      return null;
    }
  };
  const root = {
    MutationObserver: FakeObserver,
    setTimeout(callback, delay) {
      if (timerError) throw new Error('timer install failed');
      timeoutCallback = callback;
      timeoutDelay = delay;
      return 33;
    },
    clearTimeout(timer) { clearedTimer = timer; }
  };

  return {
    documentRef,
    root,
    observer: () => observerInstance,
    timeoutCallback: () => timeoutCallback,
    timeoutDelay: () => timeoutDelay,
    clearedTimer: () => clearedTimer
  };
}

{
  const f = waitingFixture({ observeError: true });
  assert.equal(api.autoMount(f.documentRef, f.root), null, 'observer setup failure fails closed');
  assert.equal(f.observer().disconnectCount, 1, 'failed observer is disconnected');
  assert.equal(f.timeoutCallback(), null, 'timer is never installed after observer failure');
}

{
  const f = waitingFixture({ timerError: true });
  assert.equal(api.autoMount(f.documentRef, f.root), null, 'timer setup failure fails closed');
  assert.equal(f.observer().disconnectCount, 1, 'observer is rolled back when timer install fails');
  assert.equal(f.clearedTimer(), null, 'no nonexistent timer is cleared');
}

{
  const f = waitingFixture();
  const waiting = api.autoMount(f.documentRef, f.root);
  assert.ok(waiting, 'autoMount returns a waiting controller when schedule card is absent');
  assert.equal(waiting.getController(), null);
  assert.equal(f.timeoutDelay(), api.AUTO_MOUNT_TIMEOUT_MS);
  assert.equal(typeof f.timeoutCallback(), 'function');
  assert.equal(f.observer().disconnectCount, 0);

  assert.equal(waiting.destroy(), true);
  assert.equal(f.observer().disconnectCount, 1, 'destroy disconnects waiting observer');
  assert.equal(f.clearedTimer(), 33, 'destroy clears auto-mount timeout');
  assert.equal(waiting.destroy(), true, 'repeated destroy stays harmless');
  assert.equal(f.observer().disconnectCount, 1, 'waiting observer is disconnected exactly once');
}

{
  const f = waitingFixture();
  const waiting = api.autoMount(f.documentRef, f.root);
  const timeout = f.timeoutCallback();
  timeout();
  assert.equal(f.observer().disconnectCount, 1, 'timeout stops waiting observer');
  assert.equal(f.clearedTimer(), 33, 'timeout path clears its tracked timer handle');
  assert.equal(waiting.getController(), null);
  waiting.destroy();
  assert.equal(f.observer().disconnectCount, 1, 'destroy after timeout is inert');
}

{
  const documentRef = { body: { nodeType: 1 }, querySelector: () => null };
  assert.equal(api.autoMount(documentRef, { MutationObserver: null }), null, 'missing MutationObserver fails closed');
  assert.equal(api.autoMount(null, {}), null, 'missing document fails closed');
}

console.log('schedule retry policy auto-mount lifecycle tests passed');
