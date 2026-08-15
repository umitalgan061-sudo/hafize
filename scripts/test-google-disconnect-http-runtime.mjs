import assert from 'node:assert/strict';
import { createGoogleDisconnectHttpRuntime, GOOGLE_DISCONNECT_HTTP_PATH } from '../lib/google-disconnect-http-runtime.mjs';

const COOKIE = '__Host-hafize_session=signed';
const ORIGIN = 'https://hafize.example.test';
const OWNER_KEY = Buffer.alloc(32, 11).toString('base64');
const ENV = {
  HAFIZE_CLOUD_SESSION_ORIGIN: ORIGIN,
  HAFIZE_CONNECTOR_OWNER_KEY_B64: OWNER_KEY,
  HAFIZE_GOOGLE_REFRESH_REDIS_URL: 'rediss://refresh.example.test:6380'
};

function url(query = '') {
  return new URL(`${ORIGIN}${GOOGLE_DISCONNECT_HTTP_PATH}${query}`);
}

function headers(overrides = {}) {
  return {
    cookie: COOKIE,
    origin: ORIGIN,
    'content-type': 'application/json; charset=utf-8',
    ...overrides
  };
}

function requestFor(value, state = { reads: 0 }) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return {
    state,
    async *[Symbol.asyncIterator]() {
      state.reads += 1;
      yield Buffer.from(text);
    },
    resume() { state.resumed = true; }
  };
}

function createHarness({ disconnectError = null, refreshRedis = true } = {}) {
  const authCalls = [];
  const resolveCalls = [];
  const disconnectCalls = [];
  let leaseCloses = 0;
  const runtime = createGoogleDisconnectHttpRuntime({
    env: { ...ENV, ...(refreshRedis ? {} : { HAFIZE_GOOGLE_REFRESH_REDIS_URL: '' }) },
    fetchImpl: async () => { throw new Error('fetch should be owned by injected revoke'); },
    createSessionRuntime: () => ({
      configured: true,
      authenticator: {
        authenticate({ headers: incoming }) {
          authCalls.push(incoming);
          return incoming?.cookie === COOKIE
            ? { ok: true, principal: { authenticated: true, subject: 'person@example.test' } }
            : { ok: false, error: 'AUTH_REQUIRED' };
        }
      }
    }),
    createOwnerResolver: () => ({
      resolve(principal) {
        resolveCalls.push(principal);
        return { ownerId: 'owner_cloud-session' };
      }
    }),
    createTokenStoreRuntime: () => ({ async load() {}, async remove() {} }),
    createRefreshLease: () => ({
      async acquire() { throw new Error('lease should be owned by injected revoke'); },
      async close() { leaseCloses += 1; }
    }),
    createTokenRevoke: ({ refreshLease }) => {
      if (refreshRedis) assert.equal(typeof refreshLease?.acquire, 'function');
      else assert.equal(refreshLease, null);
      return {
        async disconnect(input) {
          disconnectCalls.push(input);
          if (disconnectError) throw disconnectError;
          return { disconnected: true, alreadyDisconnected: false };
        }
      };
    }
  });
  return { runtime, authCalls, resolveCalls, disconnectCalls, getLeaseCloses: () => leaseCloses };
}

{
  const { runtime, authCalls, disconnectCalls } = createHarness();
  assert.equal(runtime.configured, true);
  const bodyState = { reads: 0 };
  const result = await runtime.handle({
    request: requestFor({ explicitUserIntent: true }, bodyState),
    method: 'POST', pathname: GOOGLE_DISCONNECT_HTTP_PATH, url: url(),
    headers: headers({ origin: 'https://evil.example.test' })
  });
  assert.equal(result.status, 403);
  assert.deepEqual(result.body, { error: 'ORIGIN_REQUIRED' });
  assert.equal(authCalls.length, 0, 'origin must be checked before cookie authentication');
  assert.equal(bodyState.reads, 0, 'cross-origin body must not be consumed');
  assert.equal(disconnectCalls.length, 0);
}

{
  const { runtime, authCalls, disconnectCalls } = createHarness();
  const bodyState = { reads: 0 };
  const result = await runtime.handle({
    request: requestFor({ explicitUserIntent: true }, bodyState),
    method: 'POST', pathname: GOOGLE_DISCONNECT_HTTP_PATH, url: url(),
    headers: headers({ cookie: 'bad-session' })
  });
  assert.equal(result.status, 401);
  assert.deepEqual(result.body, { error: 'AUTH_REQUIRED' });
  assert.equal(authCalls.length, 1);
  assert.equal(bodyState.reads, 0, 'unauthenticated body must not be consumed');
  assert.equal(disconnectCalls.length, 0);
}

{
  const { runtime } = createHarness();
  const result = await runtime.handle({
    request: requestFor({ explicitUserIntent: true }),
    method: 'POST', pathname: GOOGLE_DISCONNECT_HTTP_PATH, url: url(),
    headers: headers({ 'content-type': 'text/plain' })
  });
  assert.equal(result.status, 415);
  assert.deepEqual(result.body, { error: 'UNSUPPORTED_MEDIA_TYPE' });
}

for (const body of [
  {},
  { explicitUserIntent: false },
  { explicitUserIntent: true, ownerId: 'attacker' },
  { explicitUserIntent: true, token: 'secret' },
  []
]) {
  const { runtime, disconnectCalls } = createHarness();
  const result = await runtime.handle({
    request: requestFor(body), method: 'POST', pathname: GOOGLE_DISCONNECT_HTTP_PATH,
    url: url(), headers: headers()
  });
  assert.equal(result.status, 400);
  assert.deepEqual(result.body, { error: 'INVALID_DISCONNECT_REQUEST' });
  assert.equal(disconnectCalls.length, 0);
}

{
  const { runtime } = createHarness();
  const result = await runtime.handle({
    request: requestFor('{bad-json'), method: 'POST', pathname: GOOGLE_DISCONNECT_HTTP_PATH,
    url: url(), headers: headers()
  });
  assert.equal(result.status, 400);
  assert.deepEqual(result.body, { error: 'INVALID_JSON' });
}

{
  const { runtime } = createHarness();
  const result = await runtime.handle({
    request: requestFor({ explicitUserIntent: true }), method: 'POST', pathname: GOOGLE_DISCONNECT_HTTP_PATH,
    url: url(), headers: headers({ 'content-length': '2048' })
  });
  assert.equal(result.status, 413);
  assert.deepEqual(result.body, { error: 'BODY_TOO_LARGE' });
  assert.deepEqual(result.headers, { Connection: 'close' });
}

{
  const { runtime, resolveCalls, disconnectCalls } = createHarness();
  const result = await runtime.handle({
    request: requestFor({ explicitUserIntent: true }), method: 'POST', pathname: GOOGLE_DISCONNECT_HTTP_PATH,
    url: url(), headers: headers()
  });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { linked: false, disconnected: true, alreadyDisconnected: false });
  assert.equal(resolveCalls.length, 1);
  assert.deepEqual(disconnectCalls, [{ ownerId: 'owner_cloud-session', explicitUserIntent: true }]);
  assert.equal(JSON.stringify(result.body).includes('person@example.test'), false);
}

{
  const { runtime } = createHarness();
  const result = await runtime.handle({
    request: requestFor({ explicitUserIntent: true }), method: 'POST', pathname: GOOGLE_DISCONNECT_HTTP_PATH,
    url: url('?ownerId=attacker'), headers: headers()
  });
  assert.equal(result.status, 400, 'disconnect query parameters are forbidden');
}

{
  const { runtime } = createHarness();
  const wrongMethod = await runtime.handle({
    method: 'DELETE', pathname: GOOGLE_DISCONNECT_HTTP_PATH, url: url(), headers: headers()
  });
  assert.equal(wrongMethod.status, 405);
  assert.deepEqual(wrongMethod.headers, { Allow: 'POST' });
  assert.deepEqual(await runtime.handle({ method: 'POST', pathname: '/other' }), { matched: false });
}

for (const [error, status, publicCode] of [
  [Object.assign(new Error('timeout detail'), { code: 'GOOGLE_TOKEN_REVOKE_UPSTREAM_TIMEOUT' }), 504, 'GOOGLE_REVOKE_UPSTREAM_TIMEOUT'],
  [Object.assign(new Error('provider detail'), { code: 'GOOGLE_TOKEN_REVOKE_UPSTREAM_FAILED' }), 502, 'GOOGLE_REVOKE_UPSTREAM_FAILED'],
  [Object.assign(new Error('redis host detail'), { code: 'GOOGLE_REFRESH_LEASE_UNAVAILABLE' }), 503, 'GOOGLE_DISCONNECT_TEMPORARILY_UNAVAILABLE'],
  [Object.assign(new Error('disk path detail'), { code: 'OAUTH_TOKEN_STORE_DELETE_FAILED' }), 503, 'GOOGLE_DISCONNECT_TEMPORARILY_UNAVAILABLE']
]) {
  const { runtime } = createHarness({ disconnectError: error });
  const result = await runtime.handle({
    request: requestFor({ explicitUserIntent: true }), method: 'POST', pathname: GOOGLE_DISCONNECT_HTTP_PATH,
    url: url(), headers: headers()
  });
  assert.equal(result.status, status);
  assert.deepEqual(result.body, { error: publicCode });
  assert.equal(JSON.stringify(result.body).includes('detail'), false);
}

{
  const { runtime, getLeaseCloses } = createHarness();
  const closeA = runtime.close();
  const closeB = runtime.close();
  assert.strictEqual(closeA, closeB);
  await closeA;
  assert.equal(getLeaseCloses(), 1);
}

{
  const { runtime, getLeaseCloses } = createHarness({ refreshRedis: false });
  await runtime.close();
  assert.equal(getLeaseCloses(), 0);
}

{
  let tokenStoreCreated = 0;
  const disabled = createGoogleDisconnectHttpRuntime({
    env: {},
    createSessionRuntime: () => ({ configured: false, authenticator: null }),
    createTokenStoreRuntime: () => { tokenStoreCreated += 1; throw new Error('must not run'); }
  });
  assert.equal(disabled.configured, false);
  assert.equal((await disabled.handle({ pathname: GOOGLE_DISCONNECT_HTTP_PATH })).status, 404);
  assert.deepEqual(await disabled.handle({ pathname: '/elsewhere' }), { matched: false });
  assert.equal(tokenStoreCreated, 0, 'disabled session must not initialize token storage');
}

assert.throws(
  () => createGoogleDisconnectHttpRuntime({
    env: { ...ENV, HAFIZE_CLOUD_SESSION_ORIGIN: 'http://hafize.example.test' },
    createSessionRuntime: () => ({ configured: true, authenticator: { authenticate() {} } })
  }),
  /INVALID_GOOGLE_DISCONNECT_HTTP:HAFIZE_CLOUD_SESSION_ORIGIN/
);
assert.throws(
  () => createGoogleDisconnectHttpRuntime({
    env: { ...ENV, HAFIZE_CONNECTOR_OWNER_KEY_B64: 'bad' },
    createSessionRuntime: () => ({ configured: true, authenticator: { authenticate() {} } })
  }),
  /INVALID_GOOGLE_DISCONNECT_HTTP:HAFIZE_CONNECTOR_OWNER_KEY_B64/
);

console.log('Google disconnect HTTP runtime tests passed');
