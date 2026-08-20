import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const api = require('../public/screen-analysis-client.js');

assert.equal(api.ENDPOINT, '/api/screen-analysis');
assert.equal(api.REQUEST_TIMEOUT_MS, 45_000);

function pendingFetch(capture) {
  return async (path, options) => {
    capture.path = path;
    capture.options = options;
    return await new Promise((_resolve, reject) => {
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
  let timeoutCallback = null;
  let clearedTimer = null;
  const client = api.createRequestClient({
    fetchImpl: pendingFetch(capture),
    timeoutMs: 37,
    setTimeoutImpl(callback, delay) {
      assert.equal(delay, 37);
      timeoutCallback = callback;
      return 71;
    },
    clearTimeoutImpl(timer) { clearedTimer = timer; }
  });

  const pending = client.post({ explicitUserIntent: true });
  await Promise.resolve();
  assert.equal(capture.path, api.ENDPOINT);
  assert.equal(capture.options.method, 'POST');
  assert.equal(capture.options.credentials, 'same-origin');
  assert.equal(capture.options.cache, 'no-store');
  assert.equal(capture.options.signal.aborted, false);
  assert.equal(typeof timeoutCallback, 'function');

  timeoutCallback();
  await assert.rejects(pending, (error) => {
    assert.equal(error.name, 'AbortError');
    assert.equal(error.code, 'SCREEN_ANALYSIS_TIMEOUT');
    return true;
  });
  assert.equal(capture.options.signal.aborted, true);
  assert.equal(clearedTimer, 71);
}

{
  const outer = new AbortController();
  const capture = {};
  let clearCount = 0;
  const client = api.createRequestClient({
    fetchImpl: pendingFetch(capture),
    timeoutMs: 100,
    setTimeoutImpl() { return 8; },
    clearTimeoutImpl(timer) {
      assert.equal(timer, 8);
      clearCount += 1;
    }
  });

  const pending = client.post({ explicitUserIntent: true }, { signal: outer.signal });
  await Promise.resolve();
  outer.abort('user-cancelled');
  await assert.rejects(pending, (error) => {
    assert.equal(error.name, 'AbortError');
    assert.equal(error.code, 'SCREEN_ANALYSIS_CANCELLED');
    return true;
  });
  assert.equal(capture.options.signal.aborted, true);
  assert.equal(clearCount, 1);
}

{
  const outer = new AbortController();
  outer.abort('already-closed');
  let called = false;
  const client = api.createRequestClient({
    fetchImpl: async () => {
      called = true;
      return { ok: true, json: async () => ({}) };
    }
  });
  await assert.rejects(
    client.post({}, { signal: outer.signal }),
    (error) => error?.code === 'SCREEN_ANALYSIS_CANCELLED'
  );
  assert.equal(called, false);
}

{
  let timerCleared = false;
  let capturedBody = null;
  const client = api.createRequestClient({
    fetchImpl: async (path, options) => {
      assert.equal(path, api.ENDPOINT);
      assert.equal(options.signal.aborted, false);
      capturedBody = JSON.parse(options.body);
      return { ok: true, status: 200, json: async () => ({ content: 'ok' }) };
    },
    setTimeoutImpl() { return 14; },
    clearTimeoutImpl(timer) {
      assert.equal(timer, 14);
      timerCleared = true;
    }
  });

  const response = await client.post({ model: 'nvidia/test', prompt: 'Inspect', explicitUserIntent: true });
  assert.equal(response.ok, true);
  assert.deepEqual(capturedBody, { model: 'nvidia/test', prompt: 'Inspect', explicitUserIntent: true });
  assert.equal(timerCleared, true);
}

{
  const listeners = new Set();
  let removed = 0;
  const signal = {
    aborted: false,
    addEventListener(type, listener) {
      assert.equal(type, 'abort');
      listeners.add(listener);
    },
    removeEventListener(type, listener) {
      assert.equal(type, 'abort');
      if (listeners.delete(listener)) removed += 1;
    }
  };
  const client = api.createRequestClient({
    fetchImpl: async () => { throw new Error('network down'); },
    setTimeoutImpl() { return 29; },
    clearTimeoutImpl(timer) { assert.equal(timer, 29); }
  });
  await assert.rejects(client.post({}, { signal }), /network down/);
  assert.equal(listeners.size, 0);
  assert.equal(removed, 1, 'outer abort listener is removed after network failure');
}

{
  const okFetch = async () => ({ ok: true, json: async () => ({}) });
  const client = api.createRequestClient({ fetchImpl: okFetch });
  await assert.rejects(client.post({}, { signal: 'bad' }), /INVALID_SCREEN_ANALYSIS_SIGNAL/);
  assert.throws(() => api.createRequestClient({ fetchImpl: okFetch, timeoutMs: 0 }), /INVALID_SCREEN_ANALYSIS_TIMEOUT/);
  assert.throws(() => api.createRequestClient({ fetchImpl: okFetch, timeoutMs: 120_001 }), /INVALID_SCREEN_ANALYSIS_TIMEOUT/);
  assert.throws(() => api.createRequestClient({ fetchImpl: okFetch, AbortControllerImpl: null }), /SCREEN_ANALYSIS_ABORT_UNSUPPORTED/);
  assert.throws(() => api.createRequestClient({ fetchImpl: okFetch, setTimeoutImpl: null }), /SCREEN_ANALYSIS_TIMER_UNSUPPORTED/);
}

console.log('screen analysis request lifecycle tests passed');
