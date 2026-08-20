import assert from 'node:assert/strict';
import { createGmailReadClient } from '../lib/gmail-read-client.mjs';

const NOW = 1_800_000_000_000;
const ACCESS_TOKEN = 'g'.repeat(48);
const READ_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
const expired = () => ({
  accessToken: ACCESS_TOKEN,
  refreshToken: 'refresh-secret-value',
  tokenType: 'Bearer',
  scopes: [READ_SCOPE],
  expiresAt: NOW + 1_000
});

{
  let rejectRefresh;
  let fetches = 0;
  const controller = new AbortController();
  const client = createGmailReadClient({
    tokenStore: { async load() { return expired(); } },
    refreshAccessToken: async () => await new Promise((_resolve, reject) => { rejectRefresh = reject; }),
    fetchImpl: async () => { fetches += 1; return { ok: true, async json() { return {}; } }; },
    now: () => NOW
  });

  const pending = client.read({ ownerId: 'owner_abort_first', operation: 'profile.get', signal: controller.signal });
  for (let i = 0; i < 8 && typeof rejectRefresh !== 'function'; i += 1) await Promise.resolve();
  assert.equal(typeof rejectRefresh, 'function');
  controller.abort('caller-ended');
  await assert.rejects(pending, (error) => error?.code === 'GMAIL_READ_FAILED:cancelled');
  rejectRefresh(new Error('late refresh failure'));
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(fetches, 0, 'late refresh failure cannot revive or reclassify cancelled read');
}

{
  let rejectRefresh;
  let fetches = 0;
  const controller = new AbortController();
  const client = createGmailReadClient({
    tokenStore: { async load() { return expired(); } },
    refreshAccessToken: async () => await new Promise((_resolve, reject) => { rejectRefresh = reject; }),
    fetchImpl: async () => { fetches += 1; return { ok: true, async json() { return {}; } }; },
    now: () => NOW
  });

  const pending = client.read({ ownerId: 'owner_refresh_first', operation: 'profile.get', signal: controller.signal });
  for (let i = 0; i < 8 && typeof rejectRefresh !== 'function'; i += 1) await Promise.resolve();
  rejectRefresh(new Error('provider refresh failed'));
  await assert.rejects(pending, /GMAIL_READ_REAUTH_REQUIRED/);
  controller.abort('too-late');
  assert.equal(fetches, 0, 'failed refresh never reaches Gmail API');
}

console.log('gmail read refresh race precedence tests passed');