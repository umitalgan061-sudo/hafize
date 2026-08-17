import assert from 'node:assert/strict';
import { createCloudSessionNodeServerRuntime } from '../lib/cloud-session-node-server-runtime.mjs';

const env = {
  HAFIZE_CLOUD_SESSION_PASSWORD_HASH: 'test-hash',
  HAFIZE_CLOUD_SESSION_SIGNING_KEY: '0123456789abcdef0123456789abcdef',
  HAFIZE_CLOUD_SESSION_SUBJECT: 'owner:test',
  HAFIZE_CLOUD_SESSION_ORIGIN: 'https://hafize.example'
};

let gate;
let clock = 10_000;
const auth = {
  async login() { return { ok: false }; },
  authenticate() { return { ok: false }; },
  logoutCookie() { return ''; }
};

createCloudSessionNodeServerRuntime({
  env,
  createAuth: () => auth,
  createHttpApi({ loginGate }) {
    gate = loginGate;
    return { async handle() { return { matched: false }; } };
  },
  loginAttempts: 2,
  loginWindowMs: 2_000,
  maxRateKeys: 16,
  now: () => clock
});

for (let index = 0; index < 16; index += 1) {
  const ticket = gate({ request: { socket: { remoteAddress: `10.0.0.${index + 1}` } } });
  assert.equal(ticket.ok, true);
  ticket.complete({ authenticated: false });
}

const capacityBlocked = gate({ request: { socket: { remoteAddress: '10.0.1.1' } } });
assert.equal(capacityBlocked.ok, false, 'bounded key map must fail closed when every slot is occupied');
assert.equal(capacityBlocked.retryAfterSeconds, 2);

clock += 2_001;
const afterPrune = gate({ request: { socket: { remoteAddress: '10.0.1.1' } } });
assert.equal(afterPrune.ok, true, 'expired buckets should be pruned before denying a new peer');
afterPrune.complete({ authenticated: false });

const unknown1 = gate({ request: {} });
assert.equal(unknown1.ok, true);
unknown1.complete({ authenticated: false });
const unknown2 = gate({ request: { socket: { remoteAddress: '\ninvalid' } } });
assert.equal(unknown2.ok, true, 'invalid peer identifiers share the bounded unknown-peer bucket');
unknown2.complete({ authenticated: false });
const unknownBlocked = gate({ request: { socket: {} } });
assert.equal(unknownBlocked.ok, false);

console.log('cloud session login limiter capacity ok');
