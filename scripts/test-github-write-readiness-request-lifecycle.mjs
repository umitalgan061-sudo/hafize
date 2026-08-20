import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const api = require('../public/github-write-readiness.js');
assert.equal(api.REQUEST_TIMEOUT_MS, 8_000);

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
  let timerCallback = null;
  let cleared = null;
  const client = api.createClient({
    fetchImpl: pendingFetch(capture),
    timeoutMs: 25,
    setTimeoutImpl(callback, delay) { assert.equal(delay, 25); timerCallback = callback; return 71; },
    clearTimeoutImpl(id) { cleared = id; }
  });
  const promise = client.load();
  await Promise.resolve();
  assert.equal(capture.url, '/api/health');
  assert.equal(capture.options.method, 'GET');
  assert.equal(capture.options.credentials, 'same-origin');
  assert.equal(capture.options.cache, 'no-store');
  timerCallback();
  await assert.rejects(promise, (error) => error?.code === 'GITHUB_WRITE_READINESS_TIMEOUT');
  assert.equal(capture.options.signal.aborted, true);
  assert.equal(cleared, 71);
}

{
  const outer = new AbortController();
  const capture = {};
  let clearCount = 0;
  const client = api.createClient({
    fetchImpl: pendingFetch(capture),
    timeoutMs: 100,
    setTimeoutImpl() { return 8; },
    clearTimeoutImpl(id) { assert.equal(id, 8); clearCount += 1; }
  });
  const promise = client.load({ signal: outer.signal });
  await Promise.resolve();
  outer.abort('destroy');
  await assert.rejects(promise, (error) => error?.code === 'GITHUB_WRITE_READINESS_CANCELLED');
  assert.equal(capture.options.signal.aborted, true);
  assert.equal(clearCount, 1);
}

{
  const outer = new AbortController();
  outer.abort();
  let called = false;
  const client = api.createClient({ fetchImpl: async () => { called = true; throw new Error('must not run'); } });
  await assert.rejects(client.load({ signal: outer.signal }), (error) => error?.code === 'GITHUB_WRITE_READINESS_CANCELLED');
  assert.equal(called, false);
}

{
  let timerCleared = false;
  let removed = false;
  const listeners = new Map();
  const signal = {
    aborted: false,
    addEventListener(name, fn) { listeners.set(name, fn); },
    removeEventListener(name, fn) { removed = listeners.get(name) === fn; listeners.delete(name); }
  };
  const client = api.createClient({
    fetchImpl: async (_url, options) => {
      assert.ok(options.signal);
      return { ok: true, status: 200, json: async () => ({ githubWriteConfigured: true }) };
    },
    setTimeoutImpl() { return 44; },
    clearTimeoutImpl(id) { assert.equal(id, 44); timerCleared = true; }
  });
  assert.deepEqual(await client.load({ signal }), { githubWriteConfigured: true });
  assert.equal(timerCleared, true);
  assert.equal(removed, true);
}

{
  const client = api.createClient({
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ githubWriteConfigured: false }) })
  });
  assert.deepEqual(await client.load(), { githubWriteConfigured: false });
}

{
  const client = api.createClient({ fetchImpl: async () => ({ ok: true, json: async () => ({ wrong: true }) }) });
  await assert.rejects(client.load(), /GITHUB_WRITE_READINESS_INVALID_RESPONSE/);
}

{
  const client = api.createClient({ fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({}) }) });
  await assert.rejects(client.load(), /GITHUB_WRITE_READINESS_HTTP_ERROR/);
}

assert.throws(() => api.createClient({ timeoutMs: 0 }), /INVALID_GITHUB_WRITE_READINESS_TIMEOUT/);
assert.throws(() => api.createClient({ timeoutMs: 120_001 }), /INVALID_GITHUB_WRITE_READINESS_TIMEOUT/);
assert.throws(() => api.createClient({ AbortControllerImpl: null }), /GITHUB_WRITE_READINESS_ABORT_CONTROLLER_UNAVAILABLE/);
assert.throws(() => api.createClient({ setTimeoutImpl: null }), /GITHUB_WRITE_READINESS_TIMER_UNAVAILABLE/);
{
  const client = api.createClient({ fetchImpl: async () => ({ ok: true, json: async () => ({ githubWriteConfigured: true }) }) });
  await assert.rejects(client.load({ signal: 'bad' }), /INVALID_GITHUB_WRITE_READINESS_SIGNAL/);
}

console.log('GitHub write readiness request lifecycle tests passed');
