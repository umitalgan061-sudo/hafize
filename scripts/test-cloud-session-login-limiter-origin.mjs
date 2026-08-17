import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createCloudSessionNodeServerRuntime } from '../lib/cloud-session-node-server-runtime.mjs';

const env = {
  HAFIZE_CLOUD_SESSION_PASSWORD_HASH: 'test-hash',
  HAFIZE_CLOUD_SESSION_SIGNING_KEY: '0123456789abcdef0123456789abcdef',
  HAFIZE_CLOUD_SESSION_SUBJECT: 'owner:test',
  HAFIZE_CLOUD_SESSION_ORIGIN: 'https://hafize.example'
};
let authCalls = 0;
const auth = {
  async login() { authCalls += 1; return { ok: false }; },
  authenticate() { return { ok: false }; },
  logoutCookie() { return ''; }
};
const runtime = createCloudSessionNodeServerRuntime({ env, createAuth: () => auth, loginAttempts: 2, now: () => 1_000 });

async function send(origin) {
  const request = Readable.from([Buffer.from('{"password":"wrong"}')]);
  request.socket = { remoteAddress: '192.0.2.55' };
  return runtime.handle({ request, method: 'POST', pathname: '/api/session/login', headers: { origin, 'content-type': 'application/json' } });
}

for (let index = 0; index < 20; index += 1) {
  const denied = await send(`https://attacker${index}.example`);
  assert.equal(denied.status, 403);
}
assert.equal(authCalls, 0);
assert.equal((await send('https://hafize.example')).status, 401, 'cross-origin noise must not exhaust the same-origin password attempt budget');
assert.equal((await send('https://hafize.example')).status, 401);
assert.equal((await send('https://hafize.example')).status, 429);
assert.equal(authCalls, 2);

console.log('cloud session origin pre-gate boundary ok');
