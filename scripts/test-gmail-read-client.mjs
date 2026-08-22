import assert from 'node:assert/strict';
import { createGmailReadClient, GMAIL_READ_OPERATIONS } from '../lib/gmail-read-client.mjs';

const accessToken = 'g'.repeat(48);
const now = 1_800_000_000_000;
const calls = [];
const tokenStore = {
  async load(input) {
    calls.push(['load', input]);
    return {
      accessToken,
      refreshToken: 'refresh-secret',
      tokenType: 'Bearer',
      scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
      expiresAt: now + 300_000
    };
  }
};
const fetchImpl = async (url, init) => {
  calls.push(['fetch', url, init]);
  return { ok: true, async json() { return { messages: [{ id: 'abc', threadId: 't1' }], resultSizeEstimate: 1 }; } };
};
const client = createGmailReadClient({ tokenStore, fetchImpl, now: () => now });

assert.deepEqual(GMAIL_READ_OPERATIONS, ['profile.get', 'message.list', 'message.get']);
const list = await client.read({ ownerId: 'owner_opaque', operation: 'message.list', params: { query: 'is:unread', maxResults: 25, includeSpamTrash: false } });
assert.equal(list.messages[0].id, 'abc');
assert.deepEqual(calls[0], ['load', { ownerId: 'owner_opaque', provider: 'google' }]);
assert.match(calls[1][1], /^https:\/\/gmail\.googleapis\.com\/gmail\/v1\/users\/me\/messages\?/);
assert.match(calls[1][1], /q=is%3Aunread/);
assert.match(calls[1][1], /maxResults=25/);
assert.equal(calls[1][2].method, 'GET');
assert.equal(calls[1][2].redirect, 'error');
assert.equal(calls[1][2].headers.authorization, `Bearer ${accessToken}`);

calls.length = 0;
await client.read({ ownerId: 'owner_opaque', operation: 'message.get', params: { messageId: 'abc_123', format: 'metadata' } });
assert.equal(calls[1][1], 'https://gmail.googleapis.com/gmail/v1/users/me/messages/abc_123?format=metadata');

calls.length = 0;
await client.read({ ownerId: 'owner_opaque', operation: 'profile.get' });
assert.equal(calls[1][1], 'https://gmail.googleapis.com/gmail/v1/users/me/profile');

for (const input of [
  null,
  'owner_opaque',
  [],
  {},
  { ownerId: '../escape', operation: 'profile.get' },
  { ownerId: 'owner_opaque', operation: 'message.delete' },
  { ownerId: 'owner_opaque', operation: 'message.list', params: { maxResults: 501 } },
  { ownerId: 'owner_opaque', operation: 'message.list', params: { url: 'https://evil.example' } },
  { ownerId: 'owner_opaque', operation: 'message.get', params: { messageId: '../bad' } },
  { ownerId: 'owner_opaque', operation: 'message.get', params: { messageId: 'abc', format: 'raw' } }
]) {
  await assert.rejects(() => client.read(input), /INVALID_GMAIL_READ/);
}

const noScope = createGmailReadClient({
  tokenStore: { load: async () => ({ accessToken, tokenType: 'Bearer', scopes: [], expiresAt: now + 300_000 }) },
  fetchImpl,
  now: () => now
});
await assert.rejects(() => noScope.read({ ownerId: 'owner_opaque', operation: 'profile.get' }), /GMAIL_READ_SCOPE_REQUIRED/);
const expired = createGmailReadClient({
  tokenStore: { load: async () => ({ accessToken, tokenType: 'Bearer', scopes: ['https://www.googleapis.com/auth/gmail.readonly'], expiresAt: now + 1_000 }) },
  fetchImpl,
  now: () => now
});
await assert.rejects(() => expired.read({ ownerId: 'owner_opaque', operation: 'profile.get' }), /GMAIL_READ_REAUTH_REQUIRED/);
const echo = createGmailReadClient({
  tokenStore,
  fetchImpl: async () => ({ ok: true, async json() { return { leaked: accessToken }; } }),
  now: () => now
});
await assert.rejects(() => echo.read({ ownerId: 'owner_opaque', operation: 'profile.get' }), /GMAIL_READ_FAILED:response/);
console.log('gmail read client tests passed');