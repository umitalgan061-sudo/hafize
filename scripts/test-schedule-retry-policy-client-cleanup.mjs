import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const api = require('../public/schedule-retry-policy.js');

function trackedSignal() {
  const listeners = new Set();
  return {
    aborted: false,
    reason: undefined,
    addCount: 0,
    removeCount: 0,
    addEventListener(name, listener) {
      assert.equal(name, 'abort');
      this.addCount += 1;
      listeners.add(listener);
    },
    removeEventListener(name, listener) {
      assert.equal(name, 'abort');
      this.removeCount += 1;
      listeners.delete(listener);
    },
    abort(reason) {
      this.aborted = true;
      this.reason = reason;
      for (const listener of [...listeners]) listener();
    }
  };
}

{
  const outer = trackedSignal();
  let timerClears = 0;
  const client = api.createClient({
    fetchImpl: async (_url, options) => {
      assert.ok(options.signal, 'inner AbortSignal reaches fetch');
      return { ok: true, status: 200, json: async () => ({ ok: true }) };
    },
    setTimeoutImpl() { return 81; },
    clearTimeoutImpl(timer) { assert.equal(timer, 81); timerClears += 1; }
  });
  const result = await client.update('schedule-clean', 60_000, { signal: outer });
  assert.equal(result.ok, true);
  assert.equal(outer.addCount, 1);
  assert.equal(outer.removeCount, 1, 'successful request removes outer abort listener');
  assert.equal(timerClears, 1, 'successful request clears timeout exactly once');
}

{
  const outer = trackedSignal();
  const networkError = new Error('network down');
  let cleared = false;
  const client = api.createClient({
    fetchImpl: async () => { throw networkError; },
    setTimeoutImpl() { return 92; },
    clearTimeoutImpl(timer) { assert.equal(timer, 92); cleared = true; }
  });
  await assert.rejects(client.update('schedule-network', 300_000, { signal: outer }), (error) => error === networkError);
  assert.equal(outer.removeCount, 1, 'network failure still removes abort listener');
  assert.equal(cleared, true, 'network failure still clears timeout');
}

console.log('schedule retry policy client cleanup tests passed');
