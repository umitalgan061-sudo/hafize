import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const api = require('../public/schedule-create.js');

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
      return 91;
    },
    clearTimeoutImpl(timer) { clearedTimer = timer; }
  });

  const pending = client.create({ task: 'bounded request' });
  await Promise.resolve();
  assert.equal(capture.url, '/api/schedules');
  assert.equal(capture.options.signal.aborted, false);
  assert.equal(typeof timerCallback, 'function');

  timerCallback();
  await assert.rejects(pending, (error) => {
    assert.equal(error.name, 'AbortError');
    assert.equal(error.code, 'SCHEDULE_CREATE_TIMEOUT');
    return true;
  });
  assert.equal(capture.options.signal.aborted, true);
  assert.equal(clearedTimer, 91);
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

  const pending = client.create({ task: 'cancel request' }, { signal: outer.signal });
  await Promise.resolve();
  outer.abort('destroy');
  await assert.rejects(pending, (error) => {
    assert.equal(error.name, 'AbortError');
    assert.equal(error.code, 'SCHEDULE_CREATE_CANCELLED');
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
    fetchImpl: async () => { called = true; return { ok: true, status: 201, json: async () => ({ ok: true }) }; }
  });
  await assert.rejects(
    client.create({ task: 'pre-aborted' }, { signal: outer.signal }),
    (error) => error?.code === 'SCHEDULE_CREATE_CANCELLED'
  );
  assert.equal(called, false);
}

{
  let timerWasCleared = false;
  const client = api.createClient({
    fetchImpl: async (_url, options) => {
      assert.equal(options.signal.aborted, false);
      return { ok: true, status: 201, async json() { return { ok: true, schedule: { scheduleId: 's1' } }; } };
    },
    setTimeoutImpl() { return 5; },
    clearTimeoutImpl(timer) { assert.equal(timer, 5); timerWasCleared = true; }
  });
  const result = await client.create({ task: 'success' });
  assert.equal(result.ok, true);
  assert.equal(result.status, 201);
  assert.equal(result.payload.schedule.scheduleId, 's1');
  assert.equal(timerWasCleared, true);
}

assert.throws(() => api.createClient({ timeoutMs: 0 }), /INVALID_SCHEDULE_CREATE_TIMEOUT/);
assert.throws(() => api.createClient({ timeoutMs: 120_001 }), /INVALID_SCHEDULE_CREATE_TIMEOUT/);
await assert.rejects(
  api.createClient().create({}, { signal: { aborted: false } }),
  /INVALID_SCHEDULE_CREATE_SIGNAL/
);

console.log('schedule create request lifecycle tests passed');
