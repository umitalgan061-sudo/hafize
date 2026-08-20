import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const api = require('../public/github-draft-pr-create.js');

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
  const capture = {};
  let timerCallback = null;
  let cleared = null;
  const client = api.createClient({
    fetchImpl: abortAwarePendingFetch(capture),
    timeoutMs: 25,
    setTimeoutImpl(callback, delay) {
      assert.equal(delay, 25);
      timerCallback = callback;
      return 91;
    },
    clearTimeoutImpl(id) { cleared = id; }
  });

  const pending = client.post(api.PREPARE_PATH, { command: { operation: 'pr.create' } });
  await Promise.resolve();
  assert.equal(capture.url, api.PREPARE_PATH);
  assert.equal(capture.options.method, 'POST');
  assert.equal(capture.options.credentials, 'same-origin');
  assert.equal(capture.options.cache, 'no-store');
  assert.equal(capture.options.signal.aborted, false);
  assert.equal(typeof timerCallback, 'function');
  timerCallback();
  await assert.rejects(pending, (error) => {
    assert.equal(error.name, 'AbortError');
    assert.equal(error.code, 'GITHUB_DRAFT_PR_TIMEOUT');
    return true;
  });
  assert.equal(capture.options.signal.aborted, true);
  assert.equal(cleared, 91);
}

{
  const capture = {};
  const outer = new AbortController();
  let clearCount = 0;
  const client = api.createClient({
    fetchImpl: abortAwarePendingFetch(capture),
    setTimeoutImpl() { return 8; },
    clearTimeoutImpl(id) { assert.equal(id, 8); clearCount += 1; }
  });

  const pending = client.post(api.EXECUTE_PATH, { approvalToken: 'x' }, { signal: outer.signal });
  await Promise.resolve();
  outer.abort('destroy');
  await assert.rejects(pending, (error) => {
    assert.equal(error.code, 'GITHUB_DRAFT_PR_CANCELLED');
    return true;
  });
  assert.equal(capture.options.signal.aborted, true);
  assert.equal(clearCount, 1);
}

{
  const outer = new AbortController();
  outer.abort();
  let called = false;
  const client = api.createClient({ fetchImpl: async () => {
    called = true;
    return { ok: true, status: 200, json: async () => ({ ok: true }) };
  } });
  await assert.rejects(
    client.post(api.PREPARE_PATH, {}, { signal: outer.signal }),
    (error) => error?.code === 'GITHUB_DRAFT_PR_CANCELLED'
  );
  assert.equal(called, false);
}

{
  let timerCleared = false;
  const client = api.createClient({
    fetchImpl: async (_url, options) => {
      assert.equal(options.signal.aborted, false);
      return { ok: true, status: 200, async json() { return { ok: true }; } };
    },
    setTimeoutImpl() { return 19; },
    clearTimeoutImpl(id) { assert.equal(id, 19); timerCleared = true; }
  });
  const result = await client.post(api.PREPARE_PATH, { command: {} });
  assert.equal(result.response.ok, true);
  assert.deepEqual(result.payload, { ok: true });
  assert.equal(timerCleared, true);
}

{
  let timerCleared = false;
  const client = api.createClient({
    fetchImpl: async () => { throw new Error('network'); },
    setTimeoutImpl() { return 23; },
    clearTimeoutImpl(id) { assert.equal(id, 23); timerCleared = true; }
  });
  await assert.rejects(client.post(api.PREPARE_PATH, {}), /network/);
  assert.equal(timerCleared, true);
}

{
  const client = api.createClient({ fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({}) }) });
  await assert.rejects(client.post('/api/other', {}), /INVALID_GITHUB_DRAFT_PR_PATH/);
  await assert.rejects(client.post(api.PREPARE_PATH, {}, { signal: 'bad' }), /INVALID_GITHUB_DRAFT_PR_SIGNAL/);
  assert.throws(() => api.createClient({ timeoutMs: 0 }), /INVALID_GITHUB_DRAFT_PR_TIMEOUT/);
  assert.throws(() => api.createClient({ timeoutMs: 120_001 }), /INVALID_GITHUB_DRAFT_PR_TIMEOUT/);
  assert.throws(() => api.createClient({ AbortControllerImpl: null }), /INVALID_GITHUB_DRAFT_PR_ABORT_CONTROLLER/);
}

console.log('github draft PR create request lifecycle tests passed');
