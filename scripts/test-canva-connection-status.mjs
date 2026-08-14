import assert from 'node:assert/strict';
import { createCanvaAgentRuntime } from '../lib/canva-agent-runtime.mjs';

const authToken = 's'.repeat(40);
const principal = Object.freeze({ authenticated: true, subject: 'user:status@example.com' });
const loads = [];
let storedRecord = { accessToken: 'must-never-leak', refreshToken: 'also-private' };
const env = {
  HAFIZE_CONNECTOR_AUTH_TOKEN: authToken,
  HAFIZE_CONNECTOR_AUTH_SUBJECT: principal.subject,
  HAFIZE_CONNECTOR_OWNER_KEY_B64: Buffer.alloc(32, 3).toString('base64')
};
const runtime = createCanvaAgentRuntime({
  env,
  fetchImpl: async () => {},
  createAuthenticator() {
    return {
      authenticate({ headers }) {
        return headers?.authorization === `Bearer ${authToken}`
          ? { ok: true, principal }
          : { ok: false, error: 'AUTH_REQUIRED' };
      }
    };
  },
  createOwnerResolver() {
    return { resolve(received) { assert.equal(received, principal); return { ownerId: 'owner_opaque_status' }; } };
  },
  createTokenStoreRuntime() {
    return { async load(input) { loads.push(input); return storedRecord; }, save() {}, remove() {} };
  },
  createReadClient() { return { read() {} }; },
  createBoundary() { return { execute() {} }; }
});

assert.deepEqual(await runtime.connectionStatus({ headers: {} }), { ok: false, error: 'AUTH_REQUIRED' });
const linked = await runtime.connectionStatus({ headers: { authorization: `Bearer ${authToken}` } });
assert.deepEqual(linked, { ok: true, linked: true });
assert.deepEqual(loads[0], { ownerId: 'owner_opaque_status', provider: 'canva' });
assert.equal(JSON.stringify(linked).includes('owner_opaque_status'), false);
assert.equal(JSON.stringify(linked).includes('must-never-leak'), false);
assert.equal(JSON.stringify(linked).includes(principal.subject), false);

storedRecord = null;
assert.deepEqual(
  await runtime.connectionStatus({ headers: { authorization: `Bearer ${authToken}` } }),
  { ok: true, linked: false }
);
assert.deepEqual(
  await createCanvaAgentRuntime({ env: {} }).connectionStatus(),
  { ok: false, error: 'CANVA_NOT_CONFIGURED' }
);
console.log('canva connection status tests passed');
