import assert from 'node:assert/strict';
import { createPersonalMemoryControlRuntime } from '../lib/personal-memory-control-runtime.mjs';

const OWNER_KEY = Buffer.alloc(32, 9);
const OWNER_ID = `owner_${'a'.repeat(43)}`;
const env = {
  HAFIZE_CONNECTOR_AUTH_TOKEN: 'test-token',
  HAFIZE_CONNECTOR_AUTH_SUBJECT: 'user:test',
  HAFIZE_CONNECTOR_OWNER_KEY_B64: OWNER_KEY.toString('base64'),
  HAFIZE_MEMORY_KEY_B64: Buffer.alloc(32, 3).toString('base64'),
  HAFIZE_MEMORY_STORAGE_DIR: '/tmp/hafize-memory-test'
};

let approvalSecret = null;
let opened = 0;
const approval = {
  prepare() { return { approvalToken: 'token' }; },
  consume() { return { kind: 'write' }; }
};
const memory = {
  async open() { opened += 1; },
  read() {},
  write() {},
  remove() {},
  exportOwner() {},
  deleteOwner() {}
};

const runtime = await createPersonalMemoryControlRuntime({
  env,
  createSessionRuntime: () => ({ configured: false }),
  createAuthenticator: ({ token, subject }) => {
    assert.equal(token, env.HAFIZE_CONNECTOR_AUTH_TOKEN);
    assert.equal(subject, env.HAFIZE_CONNECTOR_AUTH_SUBJECT);
    return {
      authenticate() {
        return { ok: true, principal: { subject: 'user:test' } };
      }
    };
  },
  createOwnerResolver: ({ key }) => {
    assert.deepEqual(Buffer.from(key), OWNER_KEY);
    return { resolve: () => ({ ownerId: OWNER_ID }) };
  },
  createMemoryRuntime: ({ env: receivedEnv }) => {
    assert.equal(receivedEnv, env);
    return memory;
  },
  createApprovalBoundary: ({ secret }) => {
    approvalSecret = Buffer.from(secret);
    return approval;
  }
});

assert.equal(runtime.configured, true);
assert.equal(runtime.memory, memory);
assert.equal(runtime.approval, approval);
assert.equal(opened, 1);
assert.deepEqual(approvalSecret, OWNER_KEY, 'approval uses existing server-side owner key material');
assert.deepEqual(runtime.authenticate({ authorization: 'Bearer test-token' }), {
  ownerId: OWNER_ID,
  authMode: 'bearer'
});
assert.deepEqual(runtime.authorizeMutation({ ownership: { ownerId: OWNER_ID, authMode: 'bearer' } }), { ok: true });

await assert.rejects(
  createPersonalMemoryControlRuntime({
    env,
    createSessionRuntime: () => ({ configured: false }),
    createAuthenticator: () => ({ authenticate: () => ({ ok: true, principal: { subject: 'user:test' } }) }),
    createOwnerResolver: () => ({ resolve: () => ({ ownerId: OWNER_ID }) }),
    createMemoryRuntime: () => memory,
    createApprovalBoundary: () => ({ prepare() {} })
  }),
  /INVALID_MEMORY_CONTROL_RUNTIME:approval/
);

console.log('personal memory control approval wiring tests passed');
