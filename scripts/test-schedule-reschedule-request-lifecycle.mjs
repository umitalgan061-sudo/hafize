import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const api = require('../public/schedule-reschedule.js');

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
      return 51;
    },
    clearTimeoutImpl(timer) { clearedTimer = timer; }
  });

  const pending = client.reschedule('schedule-1', '2026-08-21T12:00:00.000Z');
  await Promise.resolve();
  assert.equal(capture.url, '/api/schedules/schedule-1');
  assert.equal(capture.options.method, 'PATCH');
  assert.equal(JSON.parse(capture.options.body).runAt, '2026-08-21T12:00:00.000Z');
  assert.equal(capture.options.signal.aborted, false);

  timerCallback();
  await assert.rejects(pending, (error) => {
    assert.equal(error.name, 'AbortError');
    assert.equal(error.code, 'SCHEDULE_RESCHEDULE_TIMEOUT');
    return true;
  });
  assert.equal(capture.options.signal.aborted, true);
  assert.equal(clearedTimer, 51);
}

{
  const outer = new AbortController();
  const capture = {};
  let clearCount = 0;
  const client = api.createClient({
    fetchImpl: abortAwarePendingFetch(capture),
    timeoutMs: 100,
    setTimeoutImpl() { return 8; },
    clearTimeoutImpl(timer) { assert.equal(timer, 8); clearCount += 1; }
  });

  const pending = client.reschedule('schedule-2', '2026-08-21T13:00:00.000Z', { signal: outer.signal });
  await Promise.resolve();
  outer.abort('destroy');
  await assert.rejects(pending, (error) => {
    assert.equal(error.name, 'AbortError');
    assert.equal(error.code, 'SCHEDULE_RESCHEDULE_CANCELLED');
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
    client.reschedule('schedule-3', '2026-08-21T14:00:00.000Z', { signal: outer.signal }),
    (error) => error?.code === 'SCHEDULE_RESCHEDULE_CANCELLED'
  );
  assert.equal(called, false);
}

{
  let timerWasCleared = false;
  const client = api.createClient({
    fetchImpl: async (_url, options) => {
      assert.equal(options.signal.aborted, false);
      return { ok: true, status: 200, async json() { return { ok: true, schedule: { scheduleId: 's4' } }; } };
    },
    setTimeoutImpl() { return 6; },
    clearTimeoutImpl(timer) { assert.equal(timer, 6); timerWasCleared = true; }
  });
  const result = await client.reschedule('schedule-4', '2026-08-21T15:00:00.000Z');
  assert.equal(result.ok, true);
  assert.equal(result.status, 200);
  assert.equal(result.payload.ok, true);
  assert.equal(timerWasCleared, true);
}

{
  const client = api.createClient({ fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ ok: true }) }) });
  await assert.rejects(
    client.reschedule('schedule-5', '2026-08-21T16:00:00.000Z', { signal: 'not-a-signal' }),
    /INVALID_SCHEDULE_RESCHEDULE_SIGNAL/
  );
  assert.throws(() => api.createClient({ timeoutMs: 0 }), /INVALID_SCHEDULE_RESCHEDULE_TIMEOUT/);
  assert.throws(() => api.createClient({ timeoutMs: 120_001 }), /INVALID_SCHEDULE_RESCHEDULE_TIMEOUT/);
  assert.throws(() => api.createClient({ AbortControllerImpl: null }), /INVALID_SCHEDULE_RESCHEDULE_ABORT_CONTROLLER/);
}

console.log('schedule reschedule request lifecycle tests passed');
