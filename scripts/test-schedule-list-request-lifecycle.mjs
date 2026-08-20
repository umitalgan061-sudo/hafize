import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const scheduleList = require('../public/schedule-list.js');

function response(payload = { ok: true, schedules: [] }) {
  return {
    ok: true,
    status: 200,
    async json() { return payload; }
  };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

assert.equal(scheduleList.REQUEST_TIMEOUT_MS, 30_000);

{
  const calls = [];
  const client = scheduleList.createClient({
    fetchImpl: async (path, init) => {
      calls.push({ path, init });
      return response();
    },
    timeoutMs: 25
  });
  const result = await client.list({ scope: 'failed' });
  assert.equal(result.ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].path, '/api/schedules?limit=100&view=summary&scope=failed');
  assert.equal(calls[0].init.signal instanceof AbortSignal, true);
  assert.equal(calls[0].init.signal.aborted, false);
}

{
  const pending = deferred();
  let capturedSignal;
  let timerCallback;
  let clearedTimer = null;
  const client = scheduleList.createClient({
    fetchImpl: async (_path, init) => {
      capturedSignal = init.signal;
      return pending.promise;
    },
    setTimeoutImpl(callback) {
      timerCallback = callback;
      return 73;
    },
    clearTimeoutImpl(value) { clearedTimer = value; },
    timeoutMs: 10
  });

  const request = client.list();
  assert.equal(typeof timerCallback, 'function');
  timerCallback();
  assert.equal(capturedSignal.aborted, true);
  pending.reject(Object.assign(new Error('aborted by fetch'), { name: 'AbortError' }));
  await assert.rejects(request, (error) => error?.code === 'SCHEDULE_LIST_TIMEOUT');
  assert.equal(clearedTimer, 73);
}

{
  const pending = deferred();
  const external = new AbortController();
  let capturedSignal;
  const client = scheduleList.createClient({
    fetchImpl: async (_path, init) => {
      capturedSignal = init.signal;
      return pending.promise;
    },
    timeoutMs: 100
  });

  const request = client.list({}, { signal: external.signal });
  external.abort('controller destroyed');
  assert.equal(capturedSignal.aborted, true);
  pending.reject(Object.assign(new Error('aborted by fetch'), { name: 'AbortError' }));
  await assert.rejects(request, (error) => error?.code === 'SCHEDULE_LIST_CANCELLED');
}

{
  const external = new AbortController();
  external.abort();
  let called = false;
  const client = scheduleList.createClient({
    fetchImpl: async () => {
      called = true;
      return response();
    }
  });
  await assert.rejects(
    client.list({}, { signal: external.signal }),
    (error) => error?.code === 'SCHEDULE_LIST_CANCELLED'
  );
  assert.equal(called, false);
}

{
  const external = new AbortController();
  let addCount = 0;
  let removeCount = 0;
  const signal = {
    get aborted() { return external.signal.aborted; },
    get reason() { return external.signal.reason; },
    addEventListener(type, listener, options) {
      addCount += 1;
      external.signal.addEventListener(type, listener, options);
    },
    removeEventListener(type, listener) {
      removeCount += 1;
      external.signal.removeEventListener(type, listener);
    }
  };
  const client = scheduleList.createClient({ fetchImpl: async () => response() });
  await client.list({}, { signal });
  assert.equal(addCount, 1);
  assert.equal(removeCount, 1);
}

assert.throws(
  () => scheduleList.createClient({ fetchImpl: async () => response(), AbortControllerImpl: null }),
  /INVALID_SCHEDULE_LIST_ABORT_CONTROLLER/
);
assert.throws(
  () => scheduleList.createClient({ fetchImpl: async () => response(), setTimeoutImpl: null }),
  /INVALID_SCHEDULE_LIST_TIMER/
);
assert.throws(
  () => scheduleList.createClient({ fetchImpl: async () => response(), clearTimeoutImpl: null }),
  /INVALID_SCHEDULE_LIST_TIMER/
);
assert.throws(
  () => scheduleList.createClient({ fetchImpl: async () => response(), timeoutMs: 0 }),
  /INVALID_SCHEDULE_LIST_TIMEOUT/
);
assert.throws(
  () => scheduleList.createClient({ fetchImpl: async () => response(), timeoutMs: 120_001 }),
  /INVALID_SCHEDULE_LIST_TIMEOUT/
);

{
  const client = scheduleList.createClient({ fetchImpl: async () => response() });
  await assert.rejects(client.list({}, { signal: {} }), /INVALID_SCHEDULE_LIST_SIGNAL/);
}

console.log('schedule list request lifecycle tests passed');
