import assert from 'node:assert/strict';
import { createGoogleTokenRevoke } from '../lib/google-token-revoke.mjs';

const OWNER = 'owner_google_disconnect';
const RECORD = Object.freeze({ accessToken: 'access-token-123', refreshToken: 'refresh-token-123' });

function headers(values = {}) {
  const map = new Map(Object.entries(values).map(([key, value]) => [key.toLowerCase(), String(value)]));
  return { get(name) { return map.get(String(name).toLowerCase()) ?? null; } };
}

function storeWith(record = RECORD) {
  const calls = { loads: [], removes: [] };
  return {
    calls,
    store: {
      async load(input) { calls.loads.push(input); return record; },
      async remove(input) { calls.removes.push(input); }
    }
  };
}

function createRevoke({ store, fetchImpl, refreshLease = null, timeoutMs = 10_000 }) {
  return createGoogleTokenRevoke({ tokenStore: store, refreshLease, fetchImpl, timeoutMs });
}

{
  const outer = new AbortController();
  outer.abort('caller-left');
  const { store, calls } = storeWith();
  let fetchCalls = 0;
  const revoke = createRevoke({
    store,
    fetchImpl: async () => { fetchCalls += 1; throw new Error('must not fetch'); }
  });
  await assert.rejects(
    revoke.disconnect({ ownerId: OWNER, explicitUserIntent: true, signal: outer.signal }),
    (error) => error?.code === 'GOOGLE_TOKEN_REVOKE_CANCELLED'
  );
  assert.equal(fetchCalls, 0);
  assert.equal(calls.loads.length, 0);
  assert.equal(calls.removes.length, 0);
}

{
  const outer = new AbortController();
  const { store, calls } = storeWith();
  let providerSignal = null;
  const revoke = createRevoke({
    store,
    fetchImpl: async (_url, init) => {
      providerSignal = init.signal;
      return await new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => {
          const error = new Error('aborted');
          error.name = 'AbortError';
          reject(error);
        }, { once: true });
      });
    }
  });
  const pending = revoke.disconnect({ ownerId: OWNER, explicitUserIntent: true, signal: outer.signal });
  await Promise.resolve();
  await Promise.resolve();
  outer.abort('navigation');
  await assert.rejects(pending, (error) => error?.code === 'GOOGLE_TOKEN_REVOKE_CANCELLED');
  assert.equal(providerSignal?.aborted, true);
  assert.equal(calls.removes.length, 0, 'uncertain cancelled revoke must preserve local credential');
}

{
  const outer = new AbortController();
  const { store, calls } = storeWith();
  let bodyCancels = 0;
  const revoke = createRevoke({
    store,
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      headers: headers(),
      body: {
        async cancel() {
          bodyCancels += 1;
          outer.abort('client-left-after-provider-confirmed');
        }
      }
    })
  });
  const result = await revoke.disconnect({ ownerId: OWNER, explicitUserIntent: true, signal: outer.signal });
  assert.equal(result.disconnected, true);
  assert.equal(result.providerRevoked, true);
  assert.equal(bodyCancels, 1, 'successful revoke response body is deterministically closed');
  assert.equal(calls.removes.length, 1, 'confirmed provider revoke must still clear local credential');
  assert.deepEqual(calls.removes[0], {
    ownerId: OWNER,
    provider: 'google',
    explicitUserIntent: true
  });
}

{
  const { store, calls } = storeWith();
  const encoder = new TextEncoder();
  let released = 0;
  const revoke = createRevoke({
    store,
    fetchImpl: async () => ({
      ok: false,
      status: 400,
      headers: headers(),
      body: {
        getReader() {
          let read = false;
          return {
            async read() {
              if (read) return { done: true };
              read = true;
              return { done: false, value: encoder.encode('{"error":"invalid_token"}') };
            },
            async cancel() {},
            releaseLock() { released += 1; }
          };
        }
      }
    })
  });
  const result = await revoke.disconnect({ ownerId: OWNER, explicitUserIntent: true });
  assert.equal(result.disconnected, true);
  assert.equal(result.providerRevoked, false, 'already-invalid token is a confirmed disconnected state');
  assert.equal(released, 1);
  assert.equal(calls.removes.length, 1);
}

{
  const { store, calls } = storeWith();
  let bodyCancels = 0;
  const revoke = createRevoke({
    store,
    fetchImpl: async () => ({
      ok: false,
      status: 500,
      headers: headers(),
      body: { async cancel() { bodyCancels += 1; } }
    })
  });
  await assert.rejects(
    revoke.disconnect({ ownerId: OWNER, explicitUserIntent: true }),
    (error) => error?.code === 'GOOGLE_TOKEN_REVOKE_UPSTREAM_FAILED'
  );
  assert.equal(bodyCancels, 1, 'failed revoke response body must be closed');
  assert.equal(calls.removes.length, 0, 'failed provider revoke keeps local credential');
}

{
  const { store, calls } = storeWith();
  let bodyCancels = 0;
  const revoke = createRevoke({
    store,
    fetchImpl: async () => ({
      ok: false,
      status: 400,
      headers: headers({ 'content-length': 9000 }),
      body: { async cancel() { bodyCancels += 1; } }
    })
  });
  await assert.rejects(
    revoke.disconnect({ ownerId: OWNER, explicitUserIntent: true }),
    (error) => error?.code === 'GOOGLE_TOKEN_REVOKE_UPSTREAM_FAILED'
  );
  assert.equal(bodyCancels, 1, 'oversized error body is closed before rejection');
  assert.equal(calls.removes.length, 0);
}

{
  const { store, calls } = storeWith(null);
  let fetchCalls = 0;
  const revoke = createRevoke({
    store,
    fetchImpl: async () => { fetchCalls += 1; throw new Error('must not fetch'); }
  });
  const result = await revoke.disconnect({ ownerId: OWNER, explicitUserIntent: true });
  assert.equal(result.alreadyDisconnected, true);
  assert.equal(fetchCalls, 0);
  assert.equal(calls.removes.length, 0);
}

{
  const events = [];
  const lease = {
    async acquire() {
      events.push('acquire');
      return {
        async renew() { events.push('renew'); },
        async release() { events.push('release'); }
      };
    }
  };
  const { store } = storeWith();
  const revoke = createRevoke({
    store,
    refreshLease: lease,
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      headers: headers(),
      body: { async cancel() { events.push('body-cancel'); } }
    })
  });
  await revoke.disconnect({ ownerId: OWNER, explicitUserIntent: true });
  assert.deepEqual(events, ['acquire', 'body-cancel', 'renew', 'release']);
}

{
  const { store } = storeWith();
  const revoke = createRevoke({ store, fetchImpl: async () => { throw new Error('unused'); } });
  await assert.rejects(
    revoke.disconnect({ ownerId: OWNER, explicitUserIntent: true, signal: { aborted: false } }),
    /INVALID_GOOGLE_TOKEN_REVOKE:signal/
  );
}

console.log('Google token revoke cancellation and outcome-boundary tests passed');
