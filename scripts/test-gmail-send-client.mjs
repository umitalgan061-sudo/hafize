import assert from 'node:assert/strict';
import { createGmailSendClient, GMAIL_SEND_API_URL } from '../lib/gmail-send-client.mjs';

const ownerId = 'owner_test';
const accessToken = 't'.repeat(40);
const now = 1_800_000_000_000;
const calls = [];
const tokenStore = {
  async load(input) {
    calls.push(['load', input]);
    return {
      tokenType: 'Bearer',
      accessToken,
      expiresAt: now + 120_000,
      scopes: ['https://www.googleapis.com/auth/gmail.send']
    };
  }
};
const fetchImpl = async (url, init) => {
  calls.push(['fetch', url, init]);
  return {
    ok: true,
    async json() { return { id: 'm1', threadId: 't1', labelIds: ['SENT'] }; }
  };
};
const client = createGmailSendClient({ tokenStore, fetchImpl, now: () => now });
const result = await client.send({
  ownerId,
  message: {
    to: ['alice@example.com', 'bob@example.org'],
    subject: 'Durum özeti',
    text: 'Bugünkü rapor hazır.'
  }
});
assert.equal(result.id, 'm1');
assert.deepEqual(calls[0], ['load', { ownerId, provider: 'google' }]);
const [, url, init] = calls[1];
assert.equal(url, GMAIL_SEND_API_URL);
assert.equal(init.method, 'POST');
assert.equal(init.redirect, 'error');
assert.equal(init.headers.authorization, `Bearer ${accessToken}`);
const payload = JSON.parse(init.body);
assert.deepEqual(Object.keys(payload), ['raw']);
const decoded = Buffer.from(payload.raw, 'base64url').toString('utf8');
assert.match(decoded, /^To: alice@example\.com, bob@example\.org\r\n/);
assert.match(decoded, /Subject: =\?UTF-8\?B\?.+\?=\r\n/);
assert.match(decoded, /Content-Type: text\/plain; charset=UTF-8\r\n/);
assert.match(decoded, /\r\n\r\nBugünkü rapor hazır\.$/);
assert.equal(decoded.includes(accessToken), false);

async function expectError(record, pattern, message = { to: ['a@example.com'], subject: 'x', text: 'y' }) {
  const guarded = createGmailSendClient({
    tokenStore: { async load() { return record; } },
    fetchImpl: async () => { throw new Error('FETCH_SHOULD_NOT_RUN'); },
    now: () => now
  });
  await assert.rejects(() => guarded.send({ ownerId, message }), pattern);
}

await expectError(null, /GMAIL_SEND_REAUTH_REQUIRED/);
await expectError({ tokenType: 'Bearer', accessToken, expiresAt: now + 120_000, scopes: [] }, /GMAIL_SEND_SCOPE_REQUIRED/);
await expectError({ tokenType: 'Bearer', accessToken, expiresAt: now + 20_000, scopes: ['https:\/\/www.googleapis.com\/auth\/gmail.send'] }, /GMAIL_SEND_REAUTH_REQUIRED/);
await expectError({ tokenType: 'Basic', accessToken, expiresAt: now + 120_000, scopes: ['https://www.googleapis.com/auth/gmail.send'] }, /INVALID_GMAIL_SEND:token.tokenType/);

for (const message of [
  { to: ['a@example.com\r\nBcc:evil@example.com'], subject: 'x', text: 'y' },
  { to: ['a@example.com'], subject: 'hello\nBcc:evil@example.com', text: 'y' },
  { to: [], subject: 'x', text: 'y' },
  { to: ['a@example.com'], subject: '', text: 'y' },
  { to: ['a@example.com'], subject: 'x', text: '' }
]) {
  await expectError({ tokenType: 'Bearer', accessToken, expiresAt: now + 120_000, scopes: ['https://www.googleapis.com/auth/gmail.send'] }, /INVALID_GMAIL_SEND/, message);
}

const leaking = createGmailSendClient({
  tokenStore,
  fetchImpl: async () => ({ ok: true, async json() { return { id: 'm1', echo: accessToken }; } }),
  now: () => now
});
await assert.rejects(() => leaking.send({ ownerId, message: { to: ['a@example.com'], subject: 'x', text: 'y' } }), /GMAIL_SEND_FAILED:response/);

console.log('gmail send client tests passed');
