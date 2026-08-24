import assert from 'node:assert/strict';
import { createGoogleTokenRevoke, GOOGLE_TOKEN_REVOKE_LIMITS } from '../lib/google-token-revoke.mjs';

const OWNER = 'owner_test-1';
const REFRESH = 'refresh-token-123456789';
const ACCESS = 'access-token-123456789';

function tokenRecord(overrides = {}) {
  return { accessToken: ACCESS, refreshToken: REFRESH, tokenType: 'Bearer', scopes: ['gmail.readonly'], expiresAt: Date.now() + 60_000, ...overrides };
}

function response(status, body = '') {
  return new Response(body, {
    status,
    headers: body ? { 'content-type': 'application/json' } : undefined
  });
}

function harness({ record = tokenRecord(), fetchImpl, renewError = null, removeError = null, acquireError = null } = {}) {
  const events = [];
  let stored = record;
  const tokenStore = {
    async load(input) {
      events.push(['load', input]);
      return stored;
    },
    async remove(input) {
      events.push(['remove', input]);
      if (removeError) throw removeError;
      stored = null;
      return { deleted: true };
    }
  };
  const refreshLease = {
    async acquire(input) {
      events.push(['acquire', input]);
      if (acquireError) throw acquireError;
      return {
        async renew() {
          events.push(['renew']);
          if (renewError) throw renewError;
        },
        async release() { events.push(['release']); }
      };
    }
  };
  const fetchCalls = [];
  const runtime = createGoogleTokenRevoke({
    tokenStore,
    refreshLease,
    fetchImpl: fetchImpl || (async (url, init) => {
      fetchCalls.push({ url, init });
      events.push(['fetch']);
      return response(200);
    })
  });
  return { runtime, events, fetchCalls, getStored: () => stored };
}

assert.equal(GOOGLE_TOKEN_REVOKE_LIMITS.endpoint, 'https://oauth2.googleapis.com/revoke');
assert.equal(GOOGLE_TOKEN_REVOKE_LIMITS.timeoutMs, 15_000);

{
  const { runtime } = harness();
  for (const input of [null, []]) {
    await assert.rejects(
      () => runtime.disconnect(input),
      /INVALID_GOOGLE_TOKEN_REVOKE:input/
    );
  }
}

{
  const { runtime } = harness();
  await assert.rejects(
    () => runtime.disconnect({ ownerId: OWNER }),
    /GOOGLE_TOKEN_REVOKE_REQUIRES_INTENT/
  );
}

{
  const { runtime, events, fetchCalls } = harness({ record: null });
  const result = await runtime.disconnect({ ownerId: OWNER, explicitUserIntent: true });
  assert.deepEqual(result, {
    provider: 'google', ownerId: OWNER, disconnected: true,
    alreadyDisconnected: true, providerRevoked: false
  });
  assert.equal(fetchCalls.length, 0);
  assert.deepEqual(events.map(([name]) => name), ['acquire', 'load', 'release']);
}

{
  const { runtime, events, fetchCalls, getStored } = harness();
  const result = await runtime.disconnect({ ownerId: OWNER, explicitUserIntent: true });
  assert.equal(result.disconnected, true);
  assert.equal(result.providerRevoked, true);
  assert.equal(getStored(), null);
  assert.equal(fetchCalls.length, 1);
  const call = fetchCalls[0];
  assert.equal(call.url, GOOGLE_TOKEN_REVOKE_LIMITS.endpoint);
  assert.equal(call.init.method, 'POST');
  assert.equal(call.init.redirect, 'error');
  assert.equal(call.init.headers['Content-Type'], 'application/x-www-form-urlencoded');
  assert.equal(new URLSearchParams(call.init.body).get('token'), REFRESH, 'refresh token must be preferred over access token');
  assert.deepEqual(events.map(([name]) => name), ['acquire', 'load', 'fetch', 'renew', 'remove', 'release']);
  const removeInput = events.find(([name]) => name === 'remove')[1];
  assert.deepEqual(removeInput, { ownerId: OWNER, provider: 'google', explicitUserIntent: true });
  assert.equal(JSON.stringify(result).includes(REFRESH), false);
  assert.equal(JSON.stringify(result).includes(ACCESS), false);
}

{
  const fetchCalls = [];
  const { runtime, getStored } = harness({
    record: tokenRecord({ refreshToken: null }),
    fetchImpl: async (url, init) => {
      fetchCalls.push({ url, init });
      return response(200);
    }
  });
  await runtime.disconnect({ ownerId: OWNER, explicitUserIntent: true });
  assert.equal(new URLSearchParams(fetchCalls[0].init.body).get('token'), ACCESS, 'access token is the bounded fallback when no refresh token exists');
  assert.equal(getStored(), null);
}

{
  const { runtime, getStored, events } = harness({
    fetchImpl: async () => response(400, JSON.stringify({ error: 'invalid_token', error_description: 'already revoked' }))
  });
  const result = await runtime.disconnect({ ownerId: OWNER, explicitUserIntent: true });
  assert.equal(result.providerRevoked, false);
  assert.equal(result.alreadyDisconnected, false);
  assert.equal(getStored(), null, 'provider invalid_token is terminal and local credential should be removed');
  assert.deepEqual(events.map(([name]) => name), ['acquire', 'load', 'renew', 'remove', 'release']);
}

for (const upstream of [
  () => response(400, JSON.stringify({ error: 'invalid_request' })),
  () => response(500, JSON.stringify({ error: 'server_error' })),
  () => { throw new Error('socket detail that must not escape'); }
]) {
  const { runtime, getStored, events } = harness({ fetchImpl: upstream });
  await assert.rejects(
    () => runtime.disconnect({ ownerId: OWNER, explicitUserIntent: true }),
    /GOOGLE_TOKEN_REVOKE_UPSTREAM_FAILED/
  );
  assert.notEqual(getStored(), null, 'local token must remain when provider revocation is uncertain');
  assert.equal(events.some(([name]) => name === 'remove'), false);
  assert.equal(events.at(-1)[0], 'release');
}

{
  const { runtime, getStored, events } = harness({
    renewError: Object.assign(new Error('lease lost'), { code: 'GOOGLE_REFRESH_LEASE_LOST' })
  });
  await assert.rejects(
    () => runtime.disconnect({ ownerId: OWNER, explicitUserIntent: true }),
    /GOOGLE_REFRESH_LEASE_LOST/
  );
  assert.notEqual(getStored(), null, 'revoked remote token stays locally until lease ownership is reconfirmed');
  assert.equal(events.some(([name]) => name === 'remove'), false);
  assert.equal(events.at(-1)[0], 'release');
}

{
  const { runtime, getStored, events } = harness({
    removeError: Object.assign(new Error('disk'), { code: 'OAUTH_TOKEN_STORE_DELETE_FAILED' })
  });
  await assert.rejects(
    () => runtime.disconnect({ ownerId: OWNER, explicitUserIntent: true }),
    /disk/
  );
  assert.notEqual(getStored(), null);
  assert.equal(events.at(-1)[0], 'release');
}

{
  const busy = Object.assign(new Error('busy'), { code: 'GOOGLE_REFRESH_LEASE_BUSY' });
  const { runtime, events } = harness({ acquireError: busy });
  await assert.rejects(
    () => runtime.disconnect({ ownerId: OWNER, explicitUserIntent: true }),
    /busy/
  );
  assert.deepEqual(events.map(([name]) => name), ['acquire']);
}

for (const badRecord of [
  {},
  { accessToken: '', refreshToken: null },
  { accessToken: ACCESS, refreshToken: 'short' },
  []
]) {
  const { runtime, events } = harness({ record: badRecord });
  await assert.rejects(
    () => runtime.disconnect({ ownerId: OWNER, explicitUserIntent: true }),
    /GOOGLE_TOKEN_REVOKE_INVALID_RECORD/
  );
  assert.equal(events.some(([name]) => name === 'remove'), false);
}

assert.throws(
  () => createGoogleTokenRevoke({ tokenStore: {}, fetchImpl: async () => response(200) }),
  /INVALID_GOOGLE_TOKEN_REVOKE:tokenStore/
);
assert.throws(
  () => createGoogleTokenRevoke({ tokenStore: { load() {}, remove() {} }, refreshLease: {}, fetchImpl: async () => response(200) }),
  /INVALID_GOOGLE_TOKEN_REVOKE:refreshLease/
);

console.log('Google token revoke tests passed');
