import assert from 'node:assert/strict';
import { createCanvaOAuthUpstream } from '../lib/canva-oauth-upstream.mjs';

{
  const listeners = new Set();
  let removals = 0;
  let timerClears = 0;
  const signal = {
    aborted: false,
    addEventListener(type, listener) { assert.equal(type, 'abort'); listeners.add(listener); },
    removeEventListener(type, listener) { assert.equal(type, 'abort'); if (listeners.delete(listener)) removals += 1; }
  };
  const client = createCanvaOAuthUpstream({
    fetchImpl: async () => { throw new Error('network down'); },
    setTimeoutImpl() { return 17; },
    clearTimeoutImpl(id) { assert.equal(id, 17); timerClears += 1; }
  });
  await assert.rejects(client.postForm('https://api.canva.com/rest/v1/oauth/token', {
    authorization: 'Basic abc', body: 'grant_type=x', signal, json: true
  }), /network down/);
  assert.equal(listeners.size, 0);
  assert.equal(removals, 1, 'external abort listener is removed after network failure');
  assert.equal(timerClears, 1, 'deadline timer is cleared after network failure');
}

{
  let timerClears = 0;
  const client = createCanvaOAuthUpstream({
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      headers: { get(name) { return name === 'content-type' ? 'application/json' : null; } },
      async json() { throw new SyntaxError('bad json'); }
    }),
    setTimeoutImpl() { return 23; },
    clearTimeoutImpl(id) { assert.equal(id, 23); timerClears += 1; }
  });
  await assert.rejects(client.postForm('https://api.canva.com/rest/v1/oauth/token', {
    authorization: 'Basic abc', body: 'grant_type=x', json: true
  }), SyntaxError);
  assert.equal(timerClears, 1, 'deadline timer is cleared after JSON parse failure');
}

{
  let cancelled = 0;
  const client = createCanvaOAuthUpstream({
    fetchImpl: async () => ({
      ok: false,
      status: 500,
      body: { async cancel() { cancelled += 1; throw new Error('cleanup failure'); } }
    })
  });
  const result = await client.postForm('https://api.canva.com/rest/v1/oauth/token', {
    authorization: 'Basic abc', body: 'grant_type=x', json: true
  });
  assert.equal(cancelled, 1);
  assert.deepEqual(result, { ok: false, status: 500, payload: null }, 'cleanup failure does not mask upstream HTTP result');
}

console.log('canva oauth upstream cleanup tests passed');
