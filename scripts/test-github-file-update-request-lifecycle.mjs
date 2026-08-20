import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const api = require('../public/github-file-update.js');

assert.equal(api.REQUEST_TIMEOUT_MS, 30_000);

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
  let cleared = null;
  const client = api.createClient({
    fetchImpl: pendingFetch(capture),
    timeoutMs: 25,
    setTimeoutImpl(callback, delay) {
      assert.equal(delay, 25);
      timeoutCallback = callback;
      return 44;
    },
    clearTimeoutImpl(timer) { cleared = timer; }
  });

  const pending = client.post(api.PREPARE_PATH, { command: { ok: true } });
  await Promise.resolve();
  assert.equal(capture.path, api.PREPARE_PATH);
  assert.equal(capture.options.method, 'POST');
  assert.equal(capture.options.credentials, 'same-origin');
  assert.equal(capture.options.cache, 'no-store');
  assert.equal(capture.options.signal.aborted, false);
  assert.equal(typeof timeoutCallback, 'function');

  timeoutCallback();
  await assert.rejects(pending, (error) => {
    assert.equal(error.name, 'AbortError');
    assert.equal(error.code, 'GITHUB_FILE_UPDATE_TIMEOUT');
    return true;
  });
  assert.equal(capture.options.signal.aborted, true);
  assert.equal(cleared, 44);
}

{
  const outer = new AbortController();
  const capture = {};
  let clearCount = 0;
  const client = api.createClient({
    fetchImpl: pendingFetch(capture),
    timeoutMs: 100,
    setTimeoutImpl() { return 7; },
    clearTimeoutImpl(timer) { assert.equal(timer, 7); clearCount += 1; }
  });

  const pending = client.post(api.EXECUTE_PATH, { command: { ok: true } }, { signal: outer.signal });
  await Promise.resolve();
  outer.abort('closed');
  await assert.rejects(pending, (error) => {
    assert.equal(error.code, 'GITHUB_FILE_UPDATE_CANCELLED');
    return true;
  });
  assert.equal(capture.options.signal.aborted, true);
  assert.equal(clearCount, 1);
}

{
  const outer = new AbortController();
  outer.abort('pre-abort');
  let called = false;
  const client = api.createClient({
    fetchImpl: async () => {
      called = true;
      return { ok: true, status: 200, json: async () => ({ ok: true }) };
    }
  });
  await assert.rejects(
    client.post(api.PREPARE_PATH, {}, { signal: outer.signal }),
    (error) => error?.code === 'GITHUB_FILE_UPDATE_CANCELLED'
  );
  assert.equal(called, false);
}

{
  let timerCleared = false;
  let capturedBody = null;
  const client = api.createClient({
    fetchImpl: async (path, options) => {
      assert.equal(path, api.PREPARE_PATH);
      assert.equal(options.signal.aborted, false);
      capturedBody = JSON.parse(options.body);
      return { ok: true, status: 200, json: async () => ({ ok: true }) };
    },
    setTimeoutImpl() { return 9; },
    clearTimeoutImpl(timer) { assert.equal(timer, 9); timerCleared = true; }
  });
  const result = await client.post(api.PREPARE_PATH, { command: { operation: 'file.update' } });
  assert.equal(result.response.ok, true);
  assert.deepEqual(result.payload, { ok: true });
  assert.deepEqual(capturedBody, { command: { operation: 'file.update' } });
  assert.equal(timerCleared, true);
}

{
  let removed = 0;
  const listeners = new Set();
  const signal = {
    aborted: false,
    addEventListener(type, listener) { assert.equal(type, 'abort'); listeners.add(listener); },
    removeEventListener(type, listener) { assert.equal(type, 'abort'); if (listeners.delete(listener)) removed += 1; }
  };
  const client = api.createClient({
    fetchImpl: async () => { throw new Error('network down'); },
    setTimeoutImpl() { return 13; },
    clearTimeoutImpl(timer) { assert.equal(timer, 13); }
  });
  await assert.rejects(client.post(api.PREPARE_PATH, {}, { signal }), /network down/);
  assert.equal(listeners.size, 0);
  assert.equal(removed, 1, 'external abort listener removed after network failure');
}

{
  const okFetch = async () => ({ ok: true, status: 200, json: async () => ({ ok: true }) });
  const client = api.createClient({ fetchImpl: okFetch });
  await assert.rejects(client.post('/api/not-allowed', {}), /INVALID_GITHUB_FILE_UPDATE_PATH/);
  await assert.rejects(client.post(api.PREPARE_PATH, {}, { signal: 'bad' }), /INVALID_GITHUB_FILE_UPDATE_SIGNAL/);
  assert.throws(() => api.createClient({ fetchImpl: okFetch, timeoutMs: 0 }), /INVALID_GITHUB_FILE_UPDATE_TIMEOUT/);
  assert.throws(() => api.createClient({ fetchImpl: okFetch, timeoutMs: 120_001 }), /INVALID_GITHUB_FILE_UPDATE_TIMEOUT/);
  assert.throws(() => api.createClient({ fetchImpl: okFetch, AbortControllerImpl: null }), /INVALID_GITHUB_FILE_UPDATE_ABORT_CONTROLLER/);
}

console.log('github file update request lifecycle tests passed');
