import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const api = require('../public/schedule-runtime-status.js');

assert.equal(api.REQUEST_TIMEOUT_MS, 8_000);
const health = Object.freeze({
  scheduleWorkerConfigured: true,
  scheduleApiConfigured: true,
  scheduleStorageDurable: true,
  scheduleLeaseConfigured: true
});

function pendingFetch(capture) {
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
  const capture = {};
  let fireTimer = null;
  let cleared = null;
  const client = api.createClient({
    fetchImpl: pendingFetch(capture),
    timeoutMs: 25,
    setTimeoutImpl(callback, delay) { assert.equal(delay, 25); fireTimer = callback; return 9; },
    clearTimeoutImpl(id) { cleared = id; }
  });
  const request = client.read();
  await Promise.resolve();
  assert.equal(capture.url, '/api/health');
  assert.equal(capture.options.method, 'GET');
  assert.equal(capture.options.credentials, 'same-origin');
  assert.equal(capture.options.cache, 'no-store');
  fireTimer();
  await assert.rejects(request, (error) => error?.code === 'SCHEDULE_STATUS_TIMEOUT');
  assert.equal(capture.options.signal.aborted, true);
  assert.equal(cleared, 9);
}

{
  const capture = {};
  const outer = new AbortController();
  let cleared = 0;
  const client = api.createClient({
    fetchImpl: pendingFetch(capture),
    setTimeoutImpl() { return 11; },
    clearTimeoutImpl(id) { assert.equal(id, 11); cleared += 1; }
  });
  const request = client.read({ signal: outer.signal });
  await Promise.resolve();
  outer.abort('destroy');
  await assert.rejects(request, (error) => error?.code === 'SCHEDULE_STATUS_CANCELLED');
  assert.equal(capture.options.signal.aborted, true);
  assert.equal(cleared, 1);
}

{
  const outer = new AbortController();
  outer.abort();
  let calls = 0;
  const client = api.createClient({ fetchImpl: async () => { calls += 1; } });
  await assert.rejects(client.read({ signal: outer.signal }), (error) => error?.code === 'SCHEDULE_STATUS_CANCELLED');
  assert.equal(calls, 0);
}

{
  let cleared = false;
  const client = api.createClient({
    fetchImpl: async (_url, options) => {
      assert.equal(options.signal.aborted, false);
      return { ok: true, async json() { return health; } };
    },
    setTimeoutImpl() { return 12; },
    clearTimeoutImpl(id) { assert.equal(id, 12); cleared = true; }
  });
  const result = await client.read();
  assert.deepEqual(result, health);
  assert.equal(cleared, true);
}

{
  const client = api.createClient({ fetchImpl: async () => ({ ok: true, json: async () => health }) });
  await assert.rejects(client.read({ signal: 'bad' }), /INVALID_SCHEDULE_STATUS_SIGNAL/);
  assert.throws(() => api.createClient({ timeoutMs: 0 }), /INVALID_SCHEDULE_STATUS_TIMEOUT/);
  assert.throws(() => api.createClient({ timeoutMs: 120_001 }), /INVALID_SCHEDULE_STATUS_TIMEOUT/);
  assert.throws(() => api.createClient({ AbortControllerImpl: null }), /SCHEDULE_STATUS_ABORT_CONTROLLER_UNAVAILABLE/);
}

console.log('schedule runtime status request lifecycle tests passed');
