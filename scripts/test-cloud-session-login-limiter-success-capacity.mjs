import assert from 'node:assert/strict';
import { createCloudSessionNodeServerRuntime } from '../lib/cloud-session-node-server-runtime.mjs';

const env = {
  HAFIZE_CLOUD_SESSION_PASSWORD_HASH: 'x',
  HAFIZE_CLOUD_SESSION_SIGNING_KEY: '0123456789abcdef0123456789abcdef',
  HAFIZE_CLOUD_SESSION_SUBJECT: 'owner:test',
  HAFIZE_CLOUD_SESSION_ORIGIN: 'https://hafize.example'
};
let gate;
const auth = { async login() { return { ok: false }; }, authenticate() { return { ok: false }; }, revoke() { return false; }, logoutCookie() { return ''; } };
createCloudSessionNodeServerRuntime({
  env,
  createAuth: () => auth,
  createHttpApi({ loginGate }) { gate = loginGate; return { async handle() { return { matched: false }; } }; },
  loginAttempts: 2,
  maxRateKeys: 16,
  now: () => 1_000
});

for (let index = 0; index < 16; index += 1) {
  const ticket = gate({ request: { socket: { remoteAddress: `10.1.0.${index + 1}` } } });
  assert.equal(ticket.ok, true);
  ticket.complete({ authenticated: false });
}
assert.equal(gate({ request: { socket: { remoteAddress: '10.2.0.1' } } }).ok, false);

const existing = gate({ request: { socket: { remoteAddress: '10.1.0.1' } } });
assert.equal(existing.ok, true);
existing.complete({ authenticated: true });
const newcomer = gate({ request: { socket: { remoteAddress: '10.2.0.1' } } });
assert.equal(newcomer.ok, true, 'successful auth must release the peer bucket and bounded key capacity immediately');
newcomer.complete({ authenticated: false });

console.log('cloud session success releases limiter capacity ok');
