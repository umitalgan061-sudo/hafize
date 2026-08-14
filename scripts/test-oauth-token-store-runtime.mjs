import assert from 'node:assert/strict';
import { createOAuthTokenStoreRuntime, OAUTH_TOKEN_STORE_ENV } from '../lib/oauth-token-store-runtime.mjs';

const key = Buffer.alloc(32, 9).toString('base64');
const calls = [];
const events = [];
const store = {
  save: async (input) => { events.push(['save', input]); return { stored: true }; },
  load: async (input) => { events.push(['load', input]); return { accessToken: 'secret' }; },
  remove: async (input) => { events.push(['remove', input]); return { deleted: true }; }
};
const runtime = createOAuthTokenStoreRuntime({
  env: { HAFIZE_OAUTH_TOKEN_KEY_B64: key, HAFIZE_OAUTH_TOKEN_STORAGE_DIR: ' /srv/hafize/oauth ' },
  maxFileBytes: 8192,
  createStore(config) { calls.push(config); return store; }
});
assert.equal(calls.length, 1);
assert.equal(calls[0].directory, '/srv/hafize/oauth');
assert.equal(calls[0].key.toString('base64'), key);
assert.equal(calls[0].maxFileBytes, 8192);
assert.deepEqual(runtime.status(), { configured: true, storage: 'encrypted-file' });
assert.deepEqual(Object.keys(runtime).sort(), ['load', 'remove', 'save', 'status']);
assert.equal('key' in runtime, false);
assert.equal('directory' in runtime, false);
await runtime.save({ ownerId: 'u1', provider: 'google', tokenRecord: { accessToken: 'x' } });
await runtime.load({ ownerId: 'u1', provider: 'google' });
await runtime.remove({ ownerId: 'u1', provider: 'google', explicitUserIntent: true });
assert.deepEqual(events.map(([name]) => name), ['save', 'load', 'remove']);
assert.deepEqual(OAUTH_TOKEN_STORE_ENV, { key: 'HAFIZE_OAUTH_TOKEN_KEY_B64', directory: 'HAFIZE_OAUTH_TOKEN_STORAGE_DIR' });
for (const env of [
  {},
  { HAFIZE_OAUTH_TOKEN_KEY_B64: 'bad', HAFIZE_OAUTH_TOKEN_STORAGE_DIR: '/tmp' },
  { HAFIZE_OAUTH_TOKEN_KEY_B64: key, HAFIZE_OAUTH_TOKEN_STORAGE_DIR: '' },
  { HAFIZE_OAUTH_TOKEN_KEY_B64: key, HAFIZE_OAUTH_TOKEN_STORAGE_DIR: 'bad\0path' }
]) assert.throws(() => createOAuthTokenStoreRuntime({ env, createStore: () => store }), /INVALID_OAUTH_TOKEN_STORE_RUNTIME/);
assert.throws(() => createOAuthTokenStoreRuntime({ env: { HAFIZE_OAUTH_TOKEN_KEY_B64: key, HAFIZE_OAUTH_TOKEN_STORAGE_DIR: '/tmp' }, createStore: () => ({}) }), /INVALID_OAUTH_TOKEN_STORE_RUNTIME:store/);
console.log('oauth token store runtime tests passed');
