import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const api = require('../public/schedule-retry-policy.js');

assert.equal(api.REQUEST_TIMEOUT_MS, 30_000);

function abortAwarePendingFetch(capture) {
  return async (url, options) => {
    capture.url = url;
    capture.options = options;
    return await new Promise((resolve, reject) => {
      options.signal.addEventListener('abort', () => {
        const error = new Error('aborted');
        error.name = 'AbortError';
        reject(error);
      }, { once: true });
    });
  };
}

{
  let timerCallback = null;
  let clearedTimer = null;
  const capture = {};
  const client = api.createClient({
    fetchImpl: abortAwarePendingFetch(capture),
    timeoutMs: 25,
    setTimeoutImpl(callback, delay) {
      assert.equal(delay, 25);
      timerCallback = callback;
      return 41;
    },
    clearTimeoutImpl(timer) { clearedTimer = timer; }
  });

  const pending = client.update('schedule-1', 900_000);
  await Promise.resolve();
  assert.equal(capture.url, '/api/schedules/schedule-1');
  assert.equal(capture.options.method, 'PATCH');
  assert.equal(capture.options.signal.aborted, false);
  assert.deepEqual(JSON.parse(capture.options.body), { retryDelayMs: 900_000 });
  assert.equal(typeof timerCallback, 'function');

  timerCallback();
  await assert.rejects(pending, (error) => {
    assert.equal(error.name, 'AbortError');
    assert.equal(error.code, 'SCHEDULE_RETRY_POLICY_TIMEOUT');
    return true;
  });
  assert.equal(capture.options.signal.aborted, true);
  assert.equal(clearedTimer, 41);
}

{
  const outer = new AbortController();
  const capture = {};
  let clearCount = 0;
  const client = api.createClient({
    fetchImpl: abortAwarePendingFetch(capture),
    timeoutMs: 100,
    setTimeoutImpl() { return 7; },
    clearTimeoutImpl(timer) { assert.equal(timer, 7); clearCount += 1; }
  });

  const pending = client.update('schedule-2', 300_000, { signal: outer.signal });
  await Promise.resolve();
  outer.abort('destroy');
  await assert.rejects(pending, (error) => {
    assert.equal(error.name, 'AbortError');
    assert.equal(error.code, 'SCHEDULE_RETRY_POLICY_CANCELLED');
    return true;
  });
  assert.equal(capture.options.signal.aborted, true);
  assert.equal(clearCount, 1);
}

{
  const outer = new AbortController();
  outer.abort();
  let called = false;
  const client = api.createClient({
    fetchImpl: async () => {
      called = true;
      return { ok: true, status: 200, json: async () => ({ ok: true }) };
    }
  });
  await assert.rejects(
    client.update('schedule-3', 60_000, { signal: outer.signal }),
    (error) => error?.code === 'SCHEDULE_RETRY_POLICY_CANCELLED'
  );
  assert.equal(called, false);
}

{
  let timerWasCleared = false;
  const client = api.createClient({
    fetchImpl: async (_url, options) => {
      assert.equal(options.signal.aborted, false);
      return { ok: true, status: 200, async json() { return { ok: true }; } };
    },
    setTimeoutImpl() { return 5; },
    clearTimeoutImpl(timer) { assert.equal(timer, 5); timerWasCleared = true; }
  });
  const result = await client.update('schedule-4', 21_600_000);
  assert.equal(result.ok, true);
  assert.equal(result.status, 200);
  assert.equal(result.payload.ok, true);
  assert.equal(timerWasCleared, true);
}

{
  let networkCalls = 0;
  const client = api.createClient({
    fetchImpl: async () => {
      networkCalls += 1;
      return { ok: true, status: 200, json: async () => ({ ok: true }) };
    }
  });
  const invalid = await client.update('schedule-5', 12_345);
  assert.equal(invalid.ok, false);
  assert.equal(networkCalls, 0, 'invalid retry delay fails before timer/network setup');
  await assert.rejects(client.update('schedule-5', 60_000, { signal: 'not-a-signal' }), /INVALID_SCHEDULE_RETRY_POLICY_SIGNAL/);
  assert.throws(() => api.createClient({ timeoutMs: 0 }), /INVALID_SCHEDULE_RETRY_POLICY_TIMEOUT/);
  assert.throws(() => api.createClient({ timeoutMs: 120_001 }), /INVALID_SCHEDULE_RETRY_POLICY_TIMEOUT/);
  assert.throws(() => api.createClient({ AbortControllerImpl: null }), /INVALID_SCHEDULE_RETRY_POLICY_ABORT_CONTROLLER/);
  assert.throws(() => api.createClient({ setTimeoutImpl: null }), /INVALID_SCHEDULE_RETRY_POLICY_TIMER/);
}

console.log('schedule retry policy request lifecycle tests passed');
