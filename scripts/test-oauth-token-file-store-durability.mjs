import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { createOAuthTokenFileStore } from '../lib/oauth-token-file-store.mjs';

const ROOT = resolve('/tmp/hafize-oauth-durability-test');
const KEY = Buffer.alloc(32, 21);
const RECORD = { accessToken: 'access', refreshToken: 'refresh', tokenType: 'Bearer', expiresAt: 123456 };

function fakeFs({ directorySyncError = null } = {}) {
  const events = [];
  let removed = false;
  const fs = {
    async mkdir(path) { events.push(['mkdir', path]); },
    async chmod(path) { events.push(['chmod', path]); },
    async open(path, flags) {
      events.push(['open', path, flags]);
      if (flags === 'wx') {
        return {
          async writeFile() { events.push(['write-file']); },
          async sync() { events.push(['sync-file']); },
          async close() { events.push(['close-file']); }
        };
      }
      assert.equal(path, ROOT);
      assert.equal(flags, 'r');
      return {
        async sync() {
          events.push(['sync-directory']);
          if (directorySyncError) throw Object.assign(new Error('directory detail'), { code: directorySyncError });
        },
        async close() { events.push(['close-directory']); }
      };
    },
    async rename(from, to) { events.push(['rename', from, to]); },
    async rm(path, options) {
      events.push(['rm', path, options]);
      if (options?.force === false) removed = true;
    },
    async stat() { throw Object.assign(new Error('not found'), { code: 'ENOENT' }); },
    async readFile() { throw new Error('unused'); }
  };
  return { fs, events, removed: () => removed };
}

function storeFor(fake) {
  return createOAuthTokenFileStore({
    directory: ROOT,
    key: KEY,
    fs: fake.fs,
    createNonce: () => Buffer.alloc(8, 2)
  });
}

if (process.platform !== 'win32') {
  {
    const fake = fakeFs();
    const store = storeFor(fake);
    await store.save({ ownerId: 'owner', provider: 'google', tokenRecord: RECORD });
    const names = fake.events.map(([name]) => name);
    const fileSync = names.indexOf('sync-file');
    const rename = names.indexOf('rename');
    const directorySync = names.indexOf('sync-directory');
    assert.ok(fileSync >= 0 && rename > fileSync, 'file data must be synced before atomic rename');
    assert.ok(directorySync > rename, 'parent directory must be synced after rename before save succeeds');
    assert.ok(names.indexOf('close-directory') > directorySync);
  }

  {
    const fake = fakeFs();
    const store = storeFor(fake);
    const result = await store.remove({ ownerId: 'owner', provider: 'google', explicitUserIntent: true });
    assert.equal(result.deleted, true);
    const names = fake.events.map(([name]) => name);
    const unlink = names.indexOf('rm');
    const directorySync = names.indexOf('sync-directory');
    assert.equal(fake.removed(), true);
    assert.ok(directorySync > unlink, 'parent directory must be synced after deletion before remove succeeds');
  }

  for (const operation of ['save', 'remove']) {
    const fake = fakeFs({ directorySyncError: 'EIO' });
    const store = storeFor(fake);
    if (operation === 'save') {
      await assert.rejects(
        () => store.save({ ownerId: 'owner', provider: 'google', tokenRecord: RECORD }),
        /OAUTH_TOKEN_STORE_WRITE_FAILED/
      );
    } else {
      await assert.rejects(
        () => store.remove({ ownerId: 'owner', provider: 'google', explicitUserIntent: true }),
        /OAUTH_TOKEN_STORE_DELETE_FAILED/
      );
    }
    assert.equal(fake.events.some(([name]) => name === 'sync-directory'), true);
  }

  for (const code of ['EINVAL', 'ENOTSUP', 'EOPNOTSUPP']) {
    const fake = fakeFs({ directorySyncError: code });
    const store = storeFor(fake);
    const saved = await store.save({ ownerId: 'owner', provider: 'google', tokenRecord: RECORD });
    assert.equal(saved.stored, true, `${code} is an explicit unsupported-filesystem fallback`);
  }
}

console.log('oauth token file store durability tests passed');
