import assert from 'node:assert/strict';
import {
  CANVA_OAUTH_UPSTREAM_TIMEOUT_MS,
  createCanvaOAuthUpstream
} from '../lib/canva-oauth-upstream.mjs';

assert.equal(CANVA_OAUTH_UPSTREAM_TIMEOUT_MS, 15_000);

function pendingFetch(capture) {
  return async (_url, options) => {
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
  let deadline;
  let cleared = null;
  const client = createCanvaOAuthUpstream({
    fetchImpl: pendingFetch(capture),
    timeoutMs: 25,
    setTimeoutImpl(callback, delay) { assert.equal(delay, 25); deadline = callback; return 41; },
    clearTimeoutImpl(id) { cleared = id; }
  });
  const pending = client.postForm('https://api.canva.com/rest/v1/oauth/token', {
    authorization: 'Basic abc', body: 'grant_type=x', json: true
  });
  await Promise.resolve();
  assert.equal(capture.options.redirect, 'error');
  assert.equal(capture.options.signal.aborted, false);
  deadline();
  await assert.rejects(pending, (error) => error?.code === 'CANVA_OAUTH_UPSTREAM_TIMEOUT');
  assert.equal(capture.options.signal.aborted, true);
  assert.equal(cleared, 41);
}

{
  const outer = new AbortController();
  const capture = {};
  let cleared = 0;
  const client = createCanvaOAuthUpstream({
    fetchImpl: pendingFetch(capture),
    setTimeoutImpl() { return 9; },
    clearTimeoutImpl(id) { assert.equal(id, 9); cleared += 1; }
  });
  const pending = client.postForm('https://api.canva.com/rest/v1/oauth/token', {
    authorization: 'Basic abc', body: 'grant_type=x', signal: outer.signal, json: true
  });
  await Promise.resolve();
  outer.abort('user-cancelled');
  await assert.rejects(pending, (error) => error?.code === 'CANVA_OAUTH_UPSTREAM_CANCELLED');
  assert.equal(capture.options.signal.aborted, true);
  assert.equal(cleared, 1);
}

{
  const outer = new AbortController();
  outer.abort();
  let called = false;
  const client = createCanvaOAuthUpstream({ fetchImpl: async () => { called = true; } });
  await assert.rejects(client.postForm('https://api.canva.com/rest/v1/oauth/token', {
    authorization: 'Basic abc', body: '', signal: outer.signal
  }), (error) => error?.code === 'CANVA_OAUTH_UPSTREAM_CANCELLED');
  assert.equal(called, false);
}

{
  let cancelled = 0;
  const client = createCanvaOAuthUpstream({
    fetchImpl: async () => ({
      ok: false, status: 401,
      body: { async cancel() { cancelled += 1; } }
    })
  });
  const result = await client.postForm('https://api.canva.com/rest/v1/oauth/token', {
    authorization: 'Basic abc', body: 'grant_type=x', json: true
  });
  assert.deepEqual(result, { ok: false, status: 401, payload: null });
  assert.equal(cancelled, 1, 'rejected upstream body is closed');
}

{
  let cancelled = 0;
  const client = createCanvaOAuthUpstream({
    fetchImpl: async (_url, options) => {
      assert.equal(options.headers.accept, 'application/json');
      assert.equal(options.headers['content-type'], 'application/x-www-form-urlencoded');
      return {
        ok: true, status: 200,
        body: { async cancel() { cancelled += 1; } },
        async json() { return { access_token: 'opaque' }; }
      };
    }
  });
  const result = await client.postForm('https://api.canva.com/rest/v1/oauth/token', {
    authorization: 'Basic abc', body: 'grant_type=x', json: true
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.payload, { access_token: 'opaque' });
  assert.equal(cancelled, 0, 'consumed successful JSON is not redundantly cancelled');
}

{
  let cancelled = 0;
  const client = createCanvaOAuthUpstream({
    fetchImpl: async () => ({ ok: true, status: 200, body: { async cancel() { cancelled += 1; } } })
  });
  const result = await client.postForm('https://api.canva.com/rest/v1/oauth/revoke', {
    authorization: 'Basic abc', body: 'token=x', json: false
  });
  assert.equal(result.ok, true);
  assert.equal(cancelled, 1, 'successful no-body revoke response is closed');
}

{
  const okFetch = async () => ({ ok: true, status: 200, async json() { return {}; } });
  assert.throws(() => createCanvaOAuthUpstream({ fetchImpl: okFetch, timeoutMs: 0 }), /INVALID_CANVA_OAUTH_UPSTREAM:timeoutMs/);
  assert.throws(() => createCanvaOAuthUpstream({ fetchImpl: okFetch, timeoutMs: 60_001 }), /INVALID_CANVA_OAUTH_UPSTREAM:timeoutMs/);
  const client = createCanvaOAuthUpstream({ fetchImpl: okFetch });
  await assert.rejects(client.postForm('https://evil.example/oauth', { authorization: 'Basic abc', body: '' }), /INVALID_CANVA_OAUTH_UPSTREAM:endpoint/);
  await assert.rejects(client.postForm('https://api.canva.com/rest/v1/oauth/token', { authorization: 'Bearer bad', body: '' }), /INVALID_CANVA_OAUTH_UPSTREAM:authorization/);
}

console.log('canva oauth upstream lifecycle tests passed');
