import assert from 'node:assert/strict';
import { createPersonalMemoryControlRuntime } from '../lib/personal-memory-control-runtime.mjs';

const OWNER_KEY = Buffer.alloc(32, 7).toString('base64');
const BASE_ENV = Object.freeze({
  HAFIZE_CONNECTOR_OWNER_KEY_B64: OWNER_KEY,
  HAFIZE_MEMORY_KEY_B64: Buffer.alloc(32, 8).toString('base64'),
  HAFIZE_MEMORY_STORAGE_DIR: '/tmp/hafize-memory-test',
  HAFIZE_CLOUD_SESSION_ORIGIN: 'https://hafize.example'
});

function memoryStub() {
  return {
    async open() {},
    read() {},
    async write() {},
    async remove() {},
    exportOwner() {},
    async deleteOwner() {}
  };
}

function factories({ sessionConfigured = true } = {}) {
  return {
    createSessionRuntime() {
      if (!sessionConfigured) return { configured: false };
      return {
        configured: true,
        authenticator: {
          authenticate({ headers }) {
            return headers?.cookie === 'session=ok'
              ? { ok: true, principal: { authenticated: true, subject: 'session-user' } }
              : { ok: false };
          }
        }
      };
    },
    createAuthenticator({ token, subject }) {
      assert.equal(token, 'bearer-secret');
      return {
        authenticate({ headers }) {
          return headers?.authorization === 'Bearer bearer-secret'
            ? { ok: true, principal: { authenticated: true, subject } }
            : { ok: false };
        }
      };
    },
    createOwnerResolver() {
      return {
        resolve(principal) {
          return principal?.authenticated === true
            ? { ownerId: `owner:${principal.subject}` }
            : null;
        }
      };
    },
    createMemoryRuntime() {
      return memoryStub();
    }
  };
}

{
  const runtime = await createPersonalMemoryControlRuntime({
    env: { ...BASE_ENV },
    ...factories()
  });
  assert.equal(runtime.configured, true);
  assert.deepEqual(runtime.authenticate({ cookie: 'session=ok' }), {
    ownerId: 'owner:session-user',
    authMode: 'session'
  });
  assert.equal(runtime.authenticate({ cookie: 'bad' }), null);
  assert.deepEqual(
    runtime.authorizeMutation({
      headers: { origin: 'https://hafize.example' },
      ownership: { ownerId: 'owner:session-user', authMode: 'session' }
    }),
    { ok: true }
  );
  assert.deepEqual(
    runtime.authorizeMutation({
      headers: {},
      ownership: { ownerId: 'owner:session-user', authMode: 'session' }
    }),
    { ok: false, error: 'ORIGIN_REQUIRED' }
  );
  assert.deepEqual(
    runtime.authorizeMutation({
      headers: { origin: 'https://evil.example' },
      ownership: { ownerId: 'owner:session-user', authMode: 'session' }
    }),
    { ok: false, error: 'ORIGIN_REQUIRED' }
  );
}

{
  const runtime = await createPersonalMemoryControlRuntime({
    env: {
      ...BASE_ENV,
      HAFIZE_CONNECTOR_AUTH_TOKEN: 'bearer-secret',
      HAFIZE_CONNECTOR_AUTH_SUBJECT: 'service-user'
    },
    ...factories({ sessionConfigured: false })
  });
  assert.deepEqual(runtime.authenticate({ authorization: 'Bearer bearer-secret' }), {
    ownerId: 'owner:service-user',
    authMode: 'bearer'
  });
  assert.deepEqual(
    runtime.authorizeMutation({
      headers: {},
      ownership: { ownerId: 'owner:service-user', authMode: 'bearer' }
    }),
    { ok: true }
  );
}

{
  const runtime = await createPersonalMemoryControlRuntime({
    env: {
      ...BASE_ENV,
      HAFIZE_CONNECTOR_AUTH_TOKEN: 'bearer-secret',
      HAFIZE_CONNECTOR_AUTH_SUBJECT: 'service-user'
    },
    ...factories()
  });
  const headers = { cookie: 'session=ok', authorization: 'Bearer bearer-secret' };
  assert.equal(runtime.authenticate(headers)?.authMode, 'session', 'browser session must win over bearer fallback');
}

await assert.rejects(
  createPersonalMemoryControlRuntime({
    env: { ...BASE_ENV, HAFIZE_CONNECTOR_AUTH_TOKEN: 'only-half' },
    ...factories({ sessionConfigured: false })
  }),
  /INVALID_MEMORY_CONTROL_RUNTIME:bearerConfig/
);

await assert.rejects(
  createPersonalMemoryControlRuntime({
    env: {
      HAFIZE_CONNECTOR_OWNER_KEY_B64: OWNER_KEY,
      HAFIZE_MEMORY_KEY_B64: BASE_ENV.HAFIZE_MEMORY_KEY_B64,
      HAFIZE_MEMORY_STORAGE_DIR: BASE_ENV.HAFIZE_MEMORY_STORAGE_DIR
    },
    ...factories({ sessionConfigured: false })
  }),
  /INVALID_MEMORY_CONTROL_RUNTIME:config/
);

{
  let sessionFactoryCalls = 0;
  const runtime = await createPersonalMemoryControlRuntime({
    env: {},
    createSessionRuntime() {
      sessionFactoryCalls += 1;
      throw new Error('must not run');
    }
  });
  assert.equal(runtime.configured, false);
  assert.equal(sessionFactoryCalls, 0);
  assert.equal(runtime.authenticate({}), null);
  assert.deepEqual(runtime.authorizeMutation({}), { ok: false, error: 'AUTH_REQUIRED' });
}

console.log('personal memory cloud session auth tests passed');
