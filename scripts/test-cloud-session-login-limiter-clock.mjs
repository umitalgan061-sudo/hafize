import assert from 'node:assert/strict';
import { createCloudSessionNodeServerRuntime } from '../lib/cloud-session-node-server-runtime.mjs';

const env = {
  HAFIZE_CLOUD_SESSION_PASSWORD_HASH: 'x',
  HAFIZE_CLOUD_SESSION_SIGNING_KEY: '0123456789abcdef0123456789abcdef',
  HAFIZE_CLOUD_SESSION_SUBJECT: 'owner:test',
  HAFIZE_CLOUD_SESSION_ORIGIN: 'https://hafize.example'
};
const auth = {
  async login() { return { ok: false }; },
  authenticate() { return { ok: false }; },
  revoke() { return false; },
  logoutCookie() { return ''; }
};

for (const invalidNow of [() => -1, () => 1.5, () => Number.NaN, () => Number.POSITIVE_INFINITY]) {
  let gate;
  createCloudSessionNodeServerRuntime({
    env,
    createAuth: () => auth,
    createHttpApi({ loginGate }) {
      gate = loginGate;
      return { async handle() { return { matched: false }; } };
    },
    now: invalidNow
  });
  assert.throws(
    () => gate({ request: { socket: { remoteAddress: '127.0.0.1' } } }),
    /INVALID_CLOUD_SESSION_SERVER:now/
  );
}

let gate;
createCloudSessionNodeServerRuntime({
  env,
  createAuth: () => auth,
  createHttpApi({ loginGate }) {
    gate = loginGate;
    return { async handle() { return { matched: false }; } };
  },
  now: () => Number.MAX_SAFE_INTEGER
});
const ticket = gate({ request: { socket: { remoteAddress: '127.0.0.1' } } });
assert.equal(ticket.ok, true);
assert.equal(ticket.complete({ authenticated: false }), true);

console.log('cloud session login limiter clock boundary ok');
