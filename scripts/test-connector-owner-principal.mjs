import assert from 'node:assert/strict';
import { createConnectorOwnerResolver } from '../lib/connector-owner-principal.mjs';

const resolver = createConnectorOwnerResolver({ key: Buffer.alloc(32, 7) });
const first = resolver.resolve({ authenticated: true, subject: 'user:123@example.com' });
const again = resolver.resolve({ authenticated: true, subject: 'user:123@example.com' });
const other = resolver.resolve({ authenticated: true, subject: 'user:456@example.com' });

assert.match(first.ownerId, /^owner_[A-Za-z0-9_-]{43}$/);
assert.equal(first.ownerId, again.ownerId);
assert.notEqual(first.ownerId, other.ownerId);
assert.equal(JSON.stringify(first).includes('user:123@example.com'), false);
assert.equal(Object.isFrozen(first), true);

for (const principal of [
  null,
  {},
  { authenticated: false, subject: 'user:123@example.com' },
  { authenticated: true, subject: '' },
  { authenticated: true, subject: '../bad' },
  { authenticated: true, subject: 'user:123@example.com', token: 'secret' }
]) {
  assert.throws(() => resolver.resolve(principal), /CONNECTOR_AUTH_REQUIRED|INVALID_CONNECTOR_PRINCIPAL/);
}

assert.throws(() => createConnectorOwnerResolver({}), /INVALID_CONNECTOR_PRINCIPAL:key/);
assert.throws(() => createConnectorOwnerResolver({ key: Buffer.alloc(31) }), /INVALID_CONNECTOR_PRINCIPAL:key/);
console.log('connector owner principal tests passed');
