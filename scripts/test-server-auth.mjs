import assert from 'node:assert/strict';
import { createBearerPrincipalAuthenticator } from '../lib/server-auth.mjs';

const token = '0123456789abcdef0123456789abcdef';
const auth = createBearerPrincipalAuthenticator({ token, subject: 'user-primary' });

assert.deepEqual(auth.authenticate(), { ok: false, error: 'AUTH_REQUIRED' });
assert.deepEqual(auth.authenticate({ headers: {} }), { ok: false, error: 'AUTH_REQUIRED' });
assert.deepEqual(auth.authenticate({ headers: { authorization: 'Basic abc' } }), { ok: false, error: 'AUTH_REQUIRED' });
assert.deepEqual(
  auth.authenticate({ headers: { authorization: 'Bearer wrong-token-value-that-is-long-enough' } }),
  { ok: false, error: 'AUTH_REQUIRED' }
);
assert.deepEqual(
  auth.authenticate({ headers: { authorization: `Bearer ${token} trailing` } }),
  { ok: false, error: 'AUTH_REQUIRED' }
);

const result = auth.authenticate({ headers: { authorization: `Bearer ${token}` } });
assert.equal(result.ok, true);
assert.deepEqual(result.principal, { authenticated: true, subject: 'user-primary' });
assert.equal(Object.isFrozen(result.principal), true);
assert.equal(JSON.stringify(result).includes(token), false);

const upperHeader = auth.authenticate({ headers: { Authorization: `bearer ${token}` } });
assert.equal(upperHeader.ok, true);

assert.throws(
  () => createBearerPrincipalAuthenticator({ token: 'short', subject: 'user-primary' }),
  /INVALID_SERVER_AUTH:token/
);
assert.throws(
  () => createBearerPrincipalAuthenticator({ token: `${'a'.repeat(32)} bad`, subject: 'user-primary' }),
  /INVALID_SERVER_AUTH:token/
);
assert.throws(
  () => createBearerPrincipalAuthenticator({ token, subject: '   ' }),
  /INVALID_SERVER_AUTH:subject/
);
assert.throws(
  () => createBearerPrincipalAuthenticator({ token, subject: 'a'.repeat(201) }),
  /INVALID_SERVER_AUTH:subject/
);

console.log('server auth tests passed');
