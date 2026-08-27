import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createOAuthTokenFileStore } from '../lib/oauth-token-file-store.mjs';

const root = await mkdtemp(join(tmpdir(), 'hafize-oauth-store-'));
const key = Buffer.alloc(32, 9);
const store = createOAuthTokenFileStore({ directory: root, key, createNonce: () => Buffer.alloc(8, 4) });
const record = { accessToken: 'fixture-a', refreshToken: 'fixture-b', tokenType: 'Bearer', expiresAt: 1234567890 };

assert.deepEqual(await store.save({ ownerId: 'user_01@example.com', provider: 'google', tokenRecord: record }), {
  ownerId: 'user_01@example.com', provider: 'google', stored: true
});
assert.deepEqual(await store.load({ ownerId: 'user_01@example.com', provider: 'google' }), record);
assert.equal(await store.load({ ownerId: 'other-user', provider: 'google' }), null);

const names = await readdir(root);
assert.equal(names.length, 1);
assert.match(names[0], /^[a-f0-9]{64}\.json$/);
assert.equal(names[0].includes('user_01'), false);
assert.equal(names[0].includes('google'), false);
const raw = await readFile(join(root, names[0]), 'utf8');
assert.equal(raw.includes('fixture-a'), false);
assert.equal(raw.includes('fixture-b'), false);
if (process.platform !== 'win32') assert.equal((await stat(join(root, names[0]))).mode & 0o777, 0o600);

await assert.rejects(() => store.remove({ ownerId: 'user_01@example.com', provider: 'google' }), /DELETE_REQUIRES_INTENT/);
assert.equal((await store.remove({ ownerId: 'user_01@example.com', provider: 'google', explicitUserIntent: true })).deleted, true);
assert.equal(await store.load({ ownerId: 'user_01@example.com', provider: 'google' }), null);
assert.equal((await store.remove({ ownerId: 'user_01@example.com', provider: 'google', explicitUserIntent: true })).deleted, false);

for (const bad of [
  { ownerId: '../escape', provider: 'google', tokenRecord: record },
  { ownerId: 'user', provider: '../google', tokenRecord: record },
  { ownerId: 'user', provider: 'GOOGLE', tokenRecord: record },
  { ownerId: '', provider: 'google', tokenRecord: record }
]) await assert.rejects(() => store.save(bad), /INVALID_OAUTH_TOKEN_STORE/);

const tiny = createOAuthTokenFileStore({ directory: join(root, 'tiny'), key, maxFileBytes: 1024 });
await assert.rejects(() => tiny.save({ ownerId: 'user', provider: 'google', tokenRecord: { value: 'x'.repeat(5000) } }), /TOO_LARGE/);

await store.save({ ownerId: 'user', provider: 'google', tokenRecord: record });
const wrongKeyStore = createOAuthTokenFileStore({ directory: root, key: Buffer.alloc(32, 8) });
await assert.rejects(() => wrongKeyStore.load({ ownerId: 'user', provider: 'google' }), /OAUTH_TOKEN_DECRYPT_FAILED/);

// Credential sınırı nesne olmayan girdide ham TypeError yerine sözleşme hatası verir.
for (const malformed of [null, 'user', 12, [{ ownerId: 'user', provider: 'google' }]]) {
  await assert.rejects(() => store.save(malformed), /INVALID_OAUTH_TOKEN_STORE:save/);
  await assert.rejects(() => store.load(malformed), /INVALID_OAUTH_TOKEN_STORE:load/);
  await assert.rejects(() => store.remove(malformed), /INVALID_OAUTH_TOKEN_STORE:remove/);
}

console.log('oauth token file store tests passed');
